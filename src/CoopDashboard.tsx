import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, ShoppingCart, TrendingUp, Search,
  Clock, Plus, X, FileSpreadsheet, FileText, 
  Map as MapIcon, CloudRain, Sun, Trash2, LogOut, Lock, User,
  Package, ArrowDownToLine, ArrowUpFromLine, Check, 
  Play, Square, Undo, Navigation, MapPin, 
  Settings, Banknote, Target, MapPin as MapPinDrop,
  Wheat, Coins, Leaf, QrCode, Scan, Printer, KeyRound, AlertTriangle, Copy, WifiOff
} from 'lucide-react';

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polygon, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';

// --- CONFIGURATION LEAFLET ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const userLocationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const vertexIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// --- CONFIGURATION FIREBASE ---
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc, updateDoc, query, where, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDwmx-PEtPgd4BMefKxHDnhoYc_9cIZCOY",
  authDomain: "gescoop-52793.firebaseapp.com",
  projectId: "gescoop-52793",
  storageBucket: "gescoop-52793.firebasestorage.app",
  messagingSenderId: "295844170073",
  appId: "1:295844170073:web:360a2958d979878202a448"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ACTIVATION DU MODE HORS LIGNE (PERSISTANCE)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn("La persistance hors ligne ne peut être activée que dans un seul onglet à la fois.");
  } else if (err.code === 'unimplemented') {
    console.warn("Le navigateur actuel ne supporte pas la persistance hors ligne.");
  }
});

// --- TYPES ---
interface Point { lat: number; lng: number }

interface AppUser {
  uid: string;
  email: string;
  role: 'admin' | 'agent';
  coopId: string;
}

interface CropConfig {
  nom: string;
  rendementHa: number;
  prixTonne: number;   
}

interface CoopProfile {
  id: string;
  nom: string;
  lat: number;
  lng: number;
  cultures: CropConfig[];
}

interface Member {
  id: string; 
  coopId: string;
  nom: string;
  village: string;
  culture: string;
  surface: string;
  statut: string;
  date: string; 
  cout: string; 
  gps?: Point; 
  parcelle?: Point[];
}

interface Order { id: string; coopId: string; produit: string; qte: string; date: string; cout: string; statut: string; }
interface StockTransaction { id: string; coopId: string; type: 'entree' | 'sortie'; produit: string; qte: string; date: string; cout: string; acteur: string; }
interface Harvest { id: string; coopId: string; type: 'recolte' | 'vente'; culture: string; qte: number; date: string; montant?: number; acteur?: string; }

interface WeatherAlert { date: string; prob: number; sum: number; }
interface WeatherData { temp: number; isSunny: boolean; locationName: string; alerts: WeatherAlert[]; }

// --- COMPOSANTS DE CARTE ---
const AutoFitBounds = ({ members, defaultCenter }: { members: Member[], defaultCenter: Point }) => {
  const map = useMap();
  useEffect(() => {
    if (!members || members.length === 0) {
      map.setView([defaultCenter.lat, defaultCenter.lng], 10);
      return;
    }
    const bounds = new L.LatLngBounds([]);
    let hasValidPoints = false;
    members.forEach(m => {
      if (m.parcelle && m.parcelle.length > 0) {
        m.parcelle.forEach(p => { if (p && p.lat && p.lng) { bounds.extend([p.lat, p.lng]); hasValidPoints = true; } });
      } else if (m.gps && m.gps.lat && m.gps.lng) {
        bounds.extend([m.gps.lat, m.gps.lng]); hasValidPoints = true;
      }
    });
    if (hasValidPoints) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
  }, [members, map, defaultCenter]);
  return null;
};

const MapController = ({ onMapClick }: { onMapClick: (p: Point) => void }) => {
  useMapEvents({ click(e) { onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  return null;
};

const MapInvalidator = () => {
  const map = useMap();
  useEffect(() => {
    const timeout = setTimeout(() => { map.invalidateSize(); }, 200);
    return () => clearTimeout(timeout);
  }, [map]);
  return null;
};

// --- COMPOSANT PRINCIPAL ---
const CoopDashboard: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true); 
  const [authMode, setAuthMode] = useState<'login' | 'register_admin' | 'register_agent'>('login');
  
  // GESTION DU RÉSEAU (HORS LIGNE)
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({ nomCoop: '', coopIdToJoin: '', lat: 9.5222, lng: -6.4869 });
  const [isLocating, setIsLocating] = useState(false);

  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [coopProfile, setCoopProfile] = useState<CoopProfile | null>(null);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'orders' | 'stock' | 'harvests' | 'map' | 'settings'>('overview');
  const [showForm, setShowForm] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState(false);
  const [copied, setCopied] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stock, setStock] = useState<StockTransaction[]>([]); 
  const [harvests, setHarvests] = useState<Harvest[]>([]); 

  const [wizardStep, setWizardStep] = useState<0 | 1 | 2 | 3>(0); 
  const [parcelPoints, setParcelPoints] = useState<Point[]>([]);
  const [currentLocation, setCurrentLocation] = useState<Point | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const trackingWatchId = useRef<number | null>(null);
  const [mapRef, setMapRef] = useState<L.Map | null>(null);
  const initialCenterDone = useRef<boolean>(false);

  const [receiptMember, setReceiptMember] = useState<Member | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanData, setScanData] = useState('');

  const [newMember, setNewMember] = useState<Partial<Member>>({ nom: '', village: '', culture: '', surface: '', date: '', cout: '' });
  const [isCustomCulture, setIsCustomCulture] = useState(false);

  const [newOrder, setNewOrder] = useState<Partial<Order>>({ produit: '', qte: '', date: '', cout: '' });
  const [newStock, setNewStock] = useState<Partial<StockTransaction>>({ type: 'entree', produit: '', qte: '', date: '', cout: '', acteur: '' });
  const [newCrop, setNewCrop] = useState<CropConfig>({ nom: '', rendementHa: 0, prixTonne: 0 });
  const [newHarvest, setNewHarvest] = useState<Partial<Harvest>>({ type: 'recolte', culture: '', qte: 0, date: new Date().toISOString().split('T')[0], montant: 0, acteur: '' });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            setAppUser(userDoc.data() as AppUser);
          } else {
            const legacyUser: AppUser = { uid: user.uid, email: user.email || '', role: 'admin', coopId: user.uid };
            await setDoc(doc(db, "users", user.uid), legacyUser);
            setAppUser(legacyUser);
          }
          setIsLoggedIn(true);
        } catch (e) {
          console.error("Lecture de l'utilisateur impossible (probablement hors ligne sans cache initial)", e);
          setIsLoggedIn(true); 
        }
      } else {
        setIsLoggedIn(false);
        setAppUser(null);
        setCoopProfile(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isLoggedIn && appUser) {
      const fetchData = async () => {
        try {
          const profileSnap = await getDoc(doc(db, "cooperatives", appUser.coopId));
          if (profileSnap.exists()) {
            const currentProfile = { id: profileSnap.id, ...profileSnap.data() } as CoopProfile;
            setCoopProfile(currentProfile);

            if (!isOffline) {
              try {
                const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${currentProfile.lat}&longitude=${currentProfile.lng}&current_weather=true&daily=precipitation_probability,precipitation_sum&timezone=Africa%2FAbidjan&forecast_days=3`);
                const wData = await weatherRes.json();

                let locName = "Localité";
                try {
                  const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${currentProfile.lat}&lon=${currentProfile.lng}`);
                  const geoData = await geoRes.json();
                  if (geoData && geoData.address) {
                    locName = geoData.address.city || geoData.address.town || geoData.address.village || geoData.address.county || geoData.address.state || "Côte d'Ivoire";
                  }
                } catch(e) {
                   console.warn("Erreur géocodage inversé.");
                }

                const alerts = wData.daily.time.map((t: string, i: number) => ({
                  date: t,
                  prob: wData.daily.precipitation_probability[i] || 0,
                  sum: wData.daily.precipitation_sum[i] || 0
                }));

                setWeather({
                  temp: wData.current_weather.temperature,
                  isSunny: wData.current_weather.weathercode <= 3,
                  locationName: locName,
                  alerts
                });
                setWeatherError(false);
              } catch(e) {
                 console.error("Erreur API Météo", e);
                 setWeatherError(true);
              }
            } else {
              setWeatherError(true);
            }
          }

          const qMembres = query(collection(db, "membres"), where("coopId", "==", appUser.coopId));
          const mSnap = await getDocs(qMembres);
          setMembers(mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Member)));
          
          const qCommandes = query(collection(db, "commandes"), where("coopId", "==", appUser.coopId));
          const oSnap = await getDocs(qCommandes);
          setOrders(oSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
          
          const qMagasin = query(collection(db, "magasin"), where("coopId", "==", appUser.coopId));
          const sSnap = await getDocs(qMagasin);
          setStock(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as StockTransaction)));
          
          const qRecoltes = query(collection(db, "recoltes"), where("coopId", "==", appUser.coopId));
          const hSnap = await getDocs(qRecoltes);
          setHarvests(hSnap.docs.map(d => ({ id: d.id, ...d.data() } as Harvest)));

        } catch (error) { 
          console.error("Erreur de chargement des données (Cache vide ?)", error); 
        }
      };
      fetchData();
    }
  }, [isLoggedIn, appUser, isOffline]);

  const calculateProjections = () => {
    if (!coopProfile) return { totalRendement: 0, totalRevenu: 0 };
    let totalRendement = 0;
    let totalRevenu = 0;
    members.forEach(m => {
      const surface = parseFloat(m.surface || '0');
      const cropConfig = coopProfile.cultures.find(c => c.nom.toLowerCase() === m.culture?.toLowerCase());
      if (cropConfig && surface > 0) {
        const prod = surface * cropConfig.rendementHa;
        totalRendement += prod;
        totalRevenu += (prod * cropConfig.prixTonne);
      }
    });
    return { totalRendement, totalRevenu };
  };

  const projections = calculateProjections();
  const realHarvests = harvests.filter(h => h.type === 'recolte').reduce((sum, h) => sum + h.qte, 0);
  const realSales = harvests.filter(h => h.type === 'vente').reduce((sum, h) => sum + (h.montant || 0), 0);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline) {
      alert("La première connexion ou la création de compte nécessite une connexion internet. Veuillez vous connecter au réseau.");
      return;
    }
    
    try {
      if (authMode === 'register_admin') {
        const userCred = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
        const newCoopId = "COOP-" + Math.random().toString(36).substr(2, 9).toUpperCase();
        
        await setDoc(doc(db, "cooperatives", newCoopId), {
          nom: registerData.nomCoop || "Ma Coopérative",
          lat: registerData.lat,
          lng: registerData.lng,
          cultures: [
            { nom: "Cacao", rendementHa: 0.5, prixTonne: 1500000 },
            { nom: "Anacarde", rendementHa: 0.8, prixTonne: 400000 },
            { nom: "Hévéa", rendementHa: 1.5, prixTonne: 300000 },
            { nom: "Café", rendementHa: 0.4, prixTonne: 1200000 },
            { nom: "Coton", rendementHa: 1.2, prixTonne: 300000 },
            { nom: "Palmier à huile", rendementHa: 10, prixTonne: 50000 },
            { nom: "Maïs", rendementHa: 2, prixTonne: 150000 },
            { nom: "Riz", rendementHa: 3, prixTonne: 300000 },
            { nom: "Manioc", rendementHa: 15, prixTonne: 25000 },
            { nom: "Igname", rendementHa: 10, prixTonne: 200000 }
          ] 
        });
        
        await setDoc(doc(db, "users", userCred.user.uid), {
          uid: userCred.user.uid,
          email: credentials.email,
          role: 'admin',
          coopId: newCoopId
        });

      } else if (authMode === 'register_agent') {
        if (!registerData.coopIdToJoin) return alert("Veuillez entrer le Code de la coopérative.");
        const coopDoc = await getDoc(doc(db, "cooperatives", registerData.coopIdToJoin));
        if (!coopDoc.exists()) return alert("Code coopérative introuvable !");

        const userCred = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
        await setDoc(doc(db, "users", userCred.user.uid), {
          uid: userCred.user.uid,
          email: credentials.email,
          role: 'agent',
          coopId: registerData.coopIdToJoin
        });

      } else {
        await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      }
    } catch (error: unknown) { 
        const msg = error instanceof Error ? error.message : "Erreur inconnue";
        alert("Erreur : " + msg); 
    }
  };

  const getLocationForRegistration = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRegisterData(prev => ({ ...prev, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        setIsLocating(false);
      },
      (err) => { 
        console.error(err);
        alert("Impossible d'obtenir la position. Vérifiez vos autorisations GPS."); 
        setIsLocating(false); 
      }
    );
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = members.find(m => m.id === scanData);
    if (found) {
      setSearchTerm(found.nom);
      setShowScanner(false);
      setScanData('');
    } else {
      alert("Code QR non reconnu dans votre base de données.");
    }
  };

  const copyToClipboard = () => {
    if (appUser?.coopId) {
      navigator.clipboard.writeText(appUser.coopId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const addNewCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coopProfile || !appUser) return;
    if (!newCrop.nom) return alert("Le nom est requis.");
    
    const updatedCultures = [...coopProfile.cultures, newCrop];
    try {
      await updateDoc(doc(db, "cooperatives", appUser.coopId), { cultures: updatedCultures });
      setCoopProfile({ ...coopProfile, cultures: updatedCultures });
      setNewCrop({ nom: '', rendementHa: 0, prixTonne: 0 });
      alert("Paramètres mis à jour !");
    } catch (err) { 
        console.error(err);
        alert("Erreur. Si vous êtes hors ligne, l'ajout se synchronisera plus tard."); 
    }
  };

  const removeCrop = async (index: number) => {
    if (!coopProfile || !appUser) return;
    if (window.confirm("Supprimer cette culture ?")) {
      const updatedCultures = coopProfile.cultures.filter((_, i) => i !== index);
      try {
        await updateDoc(doc(db, "cooperatives", appUser.coopId), { cultures: updatedCultures });
        setCoopProfile({ ...coopProfile, cultures: updatedCultures });
      } catch (err) { 
        console.error(err);
      }
    }
  };

  useEffect(() => {
    if (wizardStep === 1) {
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentLocation(newPos);
          if (!initialCenterDone.current && mapRef) {
            mapRef.setView([newPos.lat, newPos.lng], 16, { animate: true });
            initialCenterDone.current = true;
          }
          if (isTracking) {
            setParcelPoints(prev => {
              if (prev.length > 0) {
                const last = prev[prev.length - 1];
                const from = turf.point([last.lng, last.lat]);
                const to = turf.point([newPos.lng, newPos.lat]);
                if (turf.distance(from, to, { units: 'meters' }) < 2) return prev;
              }
              return [...prev, newPos];
            });
          }
        },
        (err) => console.warn(err),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 5000 }
      );
      trackingWatchId.current = id;
    }
    return () => { if (trackingWatchId.current !== null) navigator.geolocation.clearWatch(trackingWatchId.current); };
  }, [wizardStep, isTracking, mapRef]);

  const startWizard = () => {
    setParcelPoints([]);
    setIsCustomCulture(false);
    setNewMember({ 
      nom: '', village: '', 
      culture: coopProfile?.cultures.length ? coopProfile.cultures[0].nom : '', 
      surface: '', date: new Date().toISOString().split('T')[0], cout: '5000' 
    });
    initialCenterDone.current = false;
    setWizardStep(1);
  };

  const undoLastPoint = () => setParcelPoints(prev => prev.slice(0, -1));
  const addManualPoint = (p: Point) => { if (!isTracking) setParcelPoints(prev => [...prev, p]); };

  const calculateAreaAndProceed = () => {
    if (parcelPoints.length < 3) { alert("Il faut au moins 3 points."); return; }
    try {
      const coords = parcelPoints.map(p => [p.lng, p.lat]);
      coords.push([parcelPoints[0].lng, parcelPoints[0].lat]);
      const polygon = turf.polygon([coords]);
      const areaInHa = (turf.area(polygon) / 10000).toFixed(2);
      const center = turf.centerOfMass(polygon);
      setNewMember(prev => ({ ...prev, surface: areaInHa, parcelle: parcelPoints, gps: { lat: center.geometry.coordinates[1], lng: center.geometry.coordinates[0] } }));
      setWizardStep(2);
    } catch (e) { 
        console.error(e);
        alert("Erreur géométrique. Les lignes se croisent-elles ?"); 
    }
  };

  const addMemberFromWizard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser) return;
    try {
      const memberToSave = { ...newMember, coopId: appUser.coopId, statut: "Actif" };
      const docRef = await addDoc(collection(db, "membres"), memberToSave);
      
      const completeMember = { id: docRef.id, ...memberToSave } as Member;
      setMembers([completeMember, ...members]);
      setWizardStep(0); 
      setActiveTab('members');
      setReceiptMember(completeMember);
    } catch (err) { 
        console.error(err);
        alert("Erreur d'enregistrement."); 
    }
  };

  const addOrder = async (e: React.FormEvent) => { e.preventDefault(); if(!appUser) return; try { const docRef = await addDoc(collection(db, "commandes"), { ...newOrder, coopId: appUser.coopId, statut: "En attente" }); setOrders([{ id: docRef.id, ...newOrder, coopId: appUser.coopId, statut: "En attente" } as Order, ...orders]); setShowForm(false); } catch (err) { console.error(err); alert("Erreur commande."); } };
  const addStockTransaction = async (e: React.FormEvent) => { e.preventDefault(); if(!appUser) return; try { const docRef = await addDoc(collection(db, "magasin"), { ...newStock, coopId: appUser.coopId}); setStock([{ id: docRef.id, ...newStock, coopId: appUser.coopId } as StockTransaction, ...stock]); setShowForm(false); } catch (err) { console.error(err); alert("Erreur magasin."); } };
  const addHarvestTransaction = async (e: React.FormEvent) => { e.preventDefault(); if(!appUser) return; try { const docRef = await addDoc(collection(db, "recoltes"), { ...newHarvest, coopId: appUser.coopId}); setHarvests([{ id: docRef.id, ...newHarvest, coopId: appUser.coopId } as Harvest, ...harvests]); setShowForm(false); } catch (err) { console.error(err); alert("Erreur récolte/vente."); } };
  
  const deleteDocGen = async <T extends { id: string }>(collectionName: string, id: string, setter: React.Dispatch<React.SetStateAction<T[]>>, state: T[]) => { if(window.confirm("Supprimer définitivement ?")) { try { await deleteDoc(doc(db, collectionName, id)); setter(state.filter(item => item.id !== id)); } catch (err) { console.error(err); alert("Erreur. La suppression se fera au retour du réseau."); } } };

  const exportToExcel = () => {
    let dataToExport;
    let fileName = 'Export.xlsx';

    if (activeTab === 'members') {
      dataToExport = members.map(m => ({ Nom: m.nom, Village: m.village, Culture: m.culture, Surface: `${m.surface} ha`, Date: m.date, Frais: `${m.cout} FCFA`, Statut: m.statut }));
      fileName = 'Liste_Membres.xlsx';
    } else if (activeTab === 'orders') {
      dataToExport = orders.map(o => ({ Produit: o.produit, Quantite: o.qte, Date: o.date, Cout: `${o.cout} FCFA`, Statut: o.statut }));
      fileName = 'Liste_Commandes.xlsx';
    } else if (activeTab === 'harvests') {
      dataToExport = harvests.map(h => ({ Type: h.type === 'recolte' ? 'Récolte' : 'Vente', Culture: h.culture, Quantite: `${h.qte} T`, Date: h.date, Montant: h.type === 'vente' ? `${h.montant} FCFA` : '-', Acteur: h.acteur || '-' }));
      fileName = 'Suivi_Recoltes_Ventes.xlsx';
    } else {
      dataToExport = stock.map(s => ({ Type: s.type === 'entree' ? 'Entrée' : 'Sortie', Produit: s.produit, Quantite: s.qte, Date: s.date, Valeur: `${s.cout} FCFA`, Acteur: s.acteur }));
      fileName = 'Historique_Magasin.xlsx';
    }
    
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Données");
    XLSX.writeFile(workbook, fileName);
  };

  const exportToPDF = () => {
    try {
      const docPDF = new jsPDF();
      let title = '';
      let tableHeaders: string[][] = [];
      let tableData: string[][] = [];
      let fileName = 'Rapport.pdf';

      if (activeTab === 'members') {
        title = 'ANNUAIRE DES PAYSANS';
        fileName = 'Rapport_Membres.pdf';
        tableHeaders = [["Nom", "Village", "Culture", "Date", "Frais", "Statut"]];
        tableData = members.map(m => [m.nom, m.village, m.culture, m.date, `${m.cout} FCFA`, m.statut]);
      } else if (activeTab === 'orders') {
        title = 'SUIVI DES ACHATS';
        fileName = 'Rapport_Commandes.pdf';
        tableHeaders = [["Produit", "Quantité", "Date", "Coût", "Statut"]];
        tableData = orders.map(o => [o.produit || "", o.qte || "", o.date || "", `${o.cout} FCFA`, o.statut || ""]);
      } else if (activeTab === 'harvests') {
        title = 'SUIVI DES RÉCOLTES & VENTES';
        fileName = 'Rapport_Recoltes.pdf';
        tableHeaders = [["Opération", "Culture", "Quantité (T)", "Date", "Montant (FCFA)", "Tiers"]];
        tableData = harvests.map(h => [h.type === 'recolte' ? 'Récolte' : 'Vente', h.culture, h.qte.toString(), h.date, h.type === 'vente' ? h.montant?.toString() || "0" : "-", h.acteur || "-"]);
      } else {
        title = 'HISTORIQUE DU MAGASIN (STOCKS)';
        fileName = 'Rapport_Magasin.pdf';
        tableHeaders = [["Opération", "Produit", "Quantité", "Date", "Valeur", "Tiers"]];
        tableData = stock.map(s => [s.type === 'entree' ? 'Entrée' : 'Sortie', s.produit, s.qte, s.date, `${s.cout} FCFA`, s.acteur]);
      }

      docPDF.setFontSize(16);
      docPDF.text(title, 14, 15);
      docPDF.setFontSize(10);
      docPDF.text(coopProfile?.nom || "Coopérative", 14, 22);
      
      autoTable(docPDF, { head: tableHeaders, body: tableData, startY: 30, theme: 'grid', headStyles: { fillColor: [27, 67, 50] } });
      docPDF.save(fileName);
    } catch (err) { 
      console.error(err); 
      alert("Erreur PDF."); 
    }
  };

  if (authLoading) return <div className="min-h-screen bg-[#EAE6DF] flex items-center justify-center"><p className="font-medium text-stone-600 animate-pulse">Chargement de votre espace...</p></div>;
  
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#EAE6DF] flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] w-full max-w-md p-10 border border-stone-100">
          <div className="flex justify-center mb-6"><div className="bg-emerald-50 p-5 rounded-full"><Leaf size={40} className="text-emerald-700" /></div></div>
          <h1 className="text-3xl font-black text-center text-stone-800 mb-2 tracking-tight">Gescoop Pro</h1>
          <p className="text-center text-stone-500 mb-8 font-medium">Logiciel de gestion pour coopératives</p>
          
          {isOffline && (
            <div className="bg-amber-100 text-amber-800 p-4 rounded-2xl mb-6 text-sm font-bold flex items-center gap-2">
              <WifiOff size={20} className="shrink-0" /> Impossible de se connecter ou de créer un compte hors ligne. Rapprochez-vous d'une zone couverte.
            </div>
          )}

          {!isOffline && authMode !== 'login' && (
            <div className="flex gap-2 mb-6 bg-stone-100 p-1 rounded-2xl">
              <button onClick={() => setAuthMode('register_admin')} className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${authMode === 'register_admin' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'}`}>Créer Coop</button>
              <button onClick={() => setAuthMode('register_agent')} className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${authMode === 'register_agent' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'}`}>Rejoindre Équipe</button>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            
            {authMode === 'register_admin' && !isOffline && (
              <div className="space-y-4 bg-emerald-50/50 p-5 rounded-3xl border border-emerald-100 mb-6">
                <div className="relative">
                  <Target className="absolute left-4 top-4 text-emerald-600" size={20} />
                  <input required type="text" aria-label="Nom de la Coopérative" placeholder="Nom de votre coopérative" className="w-full pl-12 p-4 bg-white rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-emerald-500 transition-all font-medium" value={registerData.nomCoop} onChange={e => setRegisterData({...registerData, nomCoop: e.target.value})} />
                </div>
                <button type="button" aria-label="Obtenir la position GPS" onClick={getLocationForRegistration} className={`w-full flex items-center justify-center gap-2 p-4 rounded-2xl font-bold transition-all ${isLocating ? 'bg-blue-50 text-blue-600' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'}`}>
                  <MapPinDrop size={18} /> {isLocating ? 'Recherche du signal GPS...' : 'Capter le siège par GPS'}
                </button>
              </div>
            )}

            {authMode === 'register_agent' && !isOffline && (
              <div className="relative mb-6">
                <KeyRound className="absolute left-4 top-4 text-amber-500" size={20} />
                <input required type="text" aria-label="Code Coopérative" placeholder="Code Coopérative (Ex: COOP-123)" className="w-full pl-12 p-4 bg-amber-50 rounded-2xl border border-amber-200 focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all font-bold text-amber-900 placeholder-amber-300 uppercase" value={registerData.coopIdToJoin} onChange={e => setRegisterData({...registerData, coopIdToJoin: e.target.value.toUpperCase()})} />
              </div>
            )}

            <div className="relative"><User className="absolute left-4 top-4 text-stone-400" size={20} /><input required aria-label="Adresse e-mail" type="email" placeholder="Adresse e-mail" disabled={isOffline && authMode !== 'login'} className="w-full pl-12 p-4 bg-stone-50 rounded-2xl border border-stone-100 focus:bg-white focus:ring-2 focus:ring-[#1b4332] transition-all font-medium disabled:opacity-50" value={credentials.email} onChange={e => setCredentials({...credentials, email: e.target.value})} /></div>
            <div className="relative"><Lock className="absolute left-4 top-4 text-stone-400" size={20} /><input required aria-label="Mot de passe" type="password" placeholder="Mot de passe secret" disabled={isOffline && authMode !== 'login'} className="w-full pl-12 p-4 bg-stone-50 rounded-2xl border border-stone-100 focus:bg-white focus:ring-2 focus:ring-[#1b4332] transition-all font-medium disabled:opacity-50" value={credentials.password} onChange={e => setCredentials({...credentials, password: e.target.value})} /></div>
            <button type="submit" disabled={isOffline && authMode !== 'login'} className="w-full bg-[#1b4332] text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all mt-4 disabled:opacity-50">{authMode === 'login' ? "Entrer dans l'espace" : "Créer mon compte"}</button>
          </form>

          {!isOffline && (
            <div className="mt-8 pt-6 border-t border-stone-100 text-center space-y-3">
              {authMode !== 'login' ? (
                  <button onClick={() => setAuthMode('login')} className="text-stone-500 font-bold hover:text-[#1b4332] transition-colors">J'ai déjà un compte, me connecter.</button>
              ) : (
                  <button onClick={() => setAuthMode('register_agent')} className="text-stone-500 font-bold hover:text-[#1b4332] transition-colors">Je n'ai pas de compte. S'inscrire.</button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- RENDUS WIZARD (TRACÉ GPS) ---
  if (wizardStep === 1) { 
    return ( 
      <div className="fixed inset-0 bg-[#EAE6DF] z-[200] flex flex-col">
        <div className="bg-[#1b4332] text-white p-5 shadow-md flex justify-between items-center z-[210] rounded-b-3xl">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              Tracé de la parcelle 
              {isOffline && <span title="Hors Ligne"><WifiOff size={16} className="text-amber-400" /></span>}
            </h2>
            <p className="text-emerald-200 text-sm font-medium">{parcelPoints.length} point(s) enregistré(s)</p>
          </div>
          <button onClick={() => setWizardStep(0)} aria-label="Fermer" className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"><X size={24}/></button>
        </div>
        
        {isOffline && (
          <div className="bg-amber-100 text-amber-800 p-2 text-xs font-bold text-center z-[210] flex justify-center items-center gap-2">
            <WifiOff size={14}/> Fond de carte satellite indisponible hors ligne. Le GPS fonctionne toujours.
          </div>
        )}

        <div className="flex-1 relative mt-[-1rem] rounded-3xl overflow-hidden z-[200]">
          <MapContainer ref={setMapRef} center={coopProfile ? [coopProfile.lat, coopProfile.lng] : [9.5222, -6.4869]} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}" maxZoom={20} subdomains={['mt0','mt1','mt2','mt3']} />
            <MapController onMapClick={addManualPoint} />
            {currentLocation && <Marker position={[currentLocation.lat, currentLocation.lng]} icon={userLocationIcon} />}
            {parcelPoints.map((p, i) => <Marker key={i} position={[p.lat, p.lng]} icon={vertexIcon} />)}
            {parcelPoints.length > 1 && <Polyline positions={parcelPoints.map(p => [p.lat, p.lng])} color="#10b981" weight={5} />}
            {parcelPoints.length >= 3 && <Polygon positions={parcelPoints.map(p => [p.lat, p.lng])} pathOptions={{ color: '#10b981', fillColor: '#34d399', fillOpacity: 0.4 }} />}
          </MapContainer>
          <div className="absolute top-8 left-4 right-4 z-[400] flex justify-between">
            <button aria-label="Recentrer la carte" onClick={() => { if(currentLocation && mapRef) mapRef.setView([currentLocation.lat, currentLocation.lng], 18, {animate: true}) }} className="bg-white p-4 rounded-full shadow-xl text-blue-600 flex items-center justify-center hover:scale-105 transition-transform"><Navigation size={24} /></button>
            {parcelPoints.length > 0 && <button aria-label="Annuler le dernier point" onClick={undoLastPoint} className="bg-white px-5 py-3 rounded-full shadow-xl text-stone-700 font-bold flex gap-2 items-center hover:bg-stone-50 transition-colors"><Undo size={20} /> <span className="text-sm">Effacer</span></button>}
          </div>
        </div>
        <div className="bg-white rounded-t-[2.5rem] shadow-[0_-15px_30px_rgba(0,0,0,0.05)] z-[210] p-6 pb-10">
          <div className="flex gap-3 mb-5">
            <button aria-label="Démarrer ou arrêter l'enregistrement GPS" onClick={() => setIsTracking(!isTracking)} className={`flex-1 flex flex-col items-center justify-center p-5 rounded-3xl border-2 transition-all ${isTracking ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-inner' : 'bg-[#EAE6DF] border-stone-100 text-stone-700 hover:border-emerald-200'}`}>
              {isTracking ? <Square size={32} className="mb-2" /> : <Play size={32} className="mb-2 text-emerald-600" />}
              <span className="font-bold text-sm text-center">{isTracking ? 'Arrêter la marche' : 'Arpenter à pied'}</span>
            </button>
            <button aria-label="Placer un point manuel" onClick={() => { if(currentLocation) addManualPoint(currentLocation) }} disabled={isTracking || !currentLocation} className="flex-1 flex flex-col items-center justify-center p-5 rounded-3xl bg-[#EAE6DF] border-2 border-stone-100 text-stone-700 disabled:opacity-40 hover:border-blue-200 transition-all">
              <MapPin size={32} className="mb-2 text-blue-500" />
              <span className="font-bold text-sm text-center">Placer un point</span>
            </button>
          </div>
          <button onClick={calculateAreaAndProceed} disabled={parcelPoints.length < 3 || isTracking} className="w-full h-16 bg-[#1b4332] text-white rounded-3xl font-black text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-stone-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
            <Check size={24} /> Calculer la surface
          </button>
        </div>
      </div> 
    ); 
  }
  
  if (wizardStep === 2) { 
    return ( 
      <div className="fixed inset-0 bg-[#EAE6DF] z-[200] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-28 h-28 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mb-8 shadow-inner"><MapIcon size={56} strokeWidth={1.5} /></div>
        <h2 className="text-3xl font-black text-stone-800 mb-3 tracking-tight">Superbe parcelle !</h2>
        <p className="text-stone-500 font-medium mb-8">Voici la taille exacte calculée par satellite :</p>
        <div className="bg-white border-2 border-emerald-100 rounded-[2.5rem] p-8 w-full max-w-sm mb-10 shadow-xl shadow-emerald-900/5">
          <p className="text-6xl font-black text-emerald-600 tracking-tighter">{newMember.surface}</p>
          <p className="text-xl font-bold text-stone-400 mt-2">Hectares (ha)</p>
        </div>
        <div className="w-full max-w-sm space-y-4">
          <button onClick={() => setWizardStep(3)} className="w-full h-16 bg-[#1b4332] text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all">C'est parfait, on valide</button>
          <button onClick={() => setWizardStep(1)} className="w-full h-16 bg-white text-stone-600 rounded-2xl font-bold text-lg border-2 border-stone-100 hover:bg-stone-50 transition-all">Je veux refaire le tracé</button>
        </div>
      </div> 
    ); 
  }
  
  if (wizardStep === 3) { 
    return ( 
      <div className="fixed inset-0 bg-[#EAE6DF] z-[200] overflow-y-auto">
        <div className="bg-[#1b4332] text-white p-5 shadow-md flex justify-between items-center sticky top-0 z-10 rounded-b-3xl">
          <h2 className="font-bold text-lg">Profil du producteur</h2>
          <button aria-label="Fermer" onClick={() => setWizardStep(0)} className="bg-white/10 p-2 rounded-full"><X size={24}/></button>
        </div>
        <div className="p-4 max-w-md mx-auto mt-6">
          <form onSubmit={addMemberFromWizard} className="space-y-5 bg-white p-8 rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-stone-100">
            <div className="bg-stone-50 p-5 rounded-2xl border border-stone-100 flex justify-between items-center mb-4">
              <span className="font-bold text-stone-600">Surface retenue :</span>
              <span className="text-2xl font-black text-emerald-600">{newMember.surface} ha</span>
            </div>
            <div className="space-y-2">
              <label htmlFor="nomComplet" className="text-sm font-bold text-stone-500 px-2">Comment s'appelle ce paysan ?</label>
              <input id="nomComplet" required placeholder="Nom complet..." className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-lg text-stone-800" value={newMember.nom} onChange={e => setNewMember({...newMember, nom: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label htmlFor="village" className="text-sm font-bold text-stone-500 px-2">Dans quel campement/village ?</label>
              <input id="village" required placeholder="Son village..." className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-lg text-stone-800" value={newMember.village} onChange={e => setNewMember({...newMember, village: e.target.value})} />
            </div>
            
            <div className="space-y-2">
              <label aria-label="Sélection culture" className="text-sm font-bold text-stone-500 px-2">Quelle est sa culture principale ?</label>
              <select required className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-lg text-stone-800" 
                value={isCustomCulture ? 'autre' : newMember.culture} 
                onChange={e => {
                  if (e.target.value === 'autre') {
                    setIsCustomCulture(true);
                    setNewMember({...newMember, culture: ''});
                  } else {
                    setIsCustomCulture(false);
                    setNewMember({...newMember, culture: e.target.value});
                  }
                }}>
                <option value="" disabled>Choisir dans la liste...</option>
                {coopProfile?.cultures.map((c, idx) => (<option key={idx} value={c.nom}>{c.nom}</option>))}
                <option value="autre" className="font-bold text-emerald-700">➕ Autre (Préciser...)</option>
              </select>
            </div>

            {isCustomCulture && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <label className="text-sm font-bold text-emerald-600 px-2">Précisez la culture</label>
                <input required placeholder="Ex: Cacao, Tomate, etc." className="w-full p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-lg text-emerald-900" value={newMember.culture} onChange={e => setNewMember({...newMember, culture: e.target.value})} />
                <p className="text-xs font-medium text-amber-600 px-2 flex items-center gap-1 mt-1"><AlertTriangle size={12}/> Pensez à ajouter cette culture dans "Paramètres" plus tard pour vos calculs financiers.</p>
              </div>
            )}

            <button type="submit" className="w-full h-16 bg-[#1b4332] text-white rounded-2xl font-black text-lg shadow-lg mt-8 hover:shadow-xl hover:-translate-y-0.5 transition-all">Enregistrer ce profil</button>
          </form>
        </div>
      </div> 
    ); 
  }

  const filteredMembers = members.filter(m => m.nom.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredOrders = orders.filter(o => o.produit.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredStock = stock.filter(s => s.produit.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredHarvests = harvests.filter(h => h.culture.toLowerCase().includes(searchTerm.toLowerCase()) || (h.acteur && h.acteur.toLowerCase().includes(searchTerm.toLowerCase())));
  
  return (
    <div className="min-h-screen bg-[#EAE6DF] pb-28 font-sans">
      
      {/* MODAL DE REÇU AVEC QR CODE */}
      {receiptMember && (
        <div className="fixed inset-0 bg-stone-900/80 flex items-center justify-center p-4 z-[500] backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative">
            <div className="bg-[#1b4332] p-6 text-center relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-10"><MapIcon size={100} /></div>
              <h3 className="font-black text-2xl text-white relative z-10">{coopProfile?.nom}</h3>
              <p className="text-emerald-200/80 text-xs font-bold uppercase tracking-widest mt-1">Reçu d'enregistrement</p>
            </div>
            
            <div className="p-8 flex flex-col items-center border-b border-dashed border-stone-200">
              <div className="p-4 bg-white border-4 border-emerald-100 rounded-3xl shadow-sm mb-6">
                 <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${receiptMember.id}&margin=0`} alt="Code QR Producteur" className="w-32 h-32 md:w-40 md:h-40" />
              </div>
              <h4 className="text-2xl font-black text-stone-800 text-center leading-tight mb-2">{receiptMember.nom}</h4>
              <p className="text-stone-500 font-medium text-center">{receiptMember.village}</p>
            </div>

            <div className="p-6 bg-stone-50 grid grid-cols-2 gap-4 text-center">
               <div><p className="text-xs font-bold text-stone-400 uppercase tracking-wide">Culture</p><p className="font-bold text-stone-800 text-lg mt-1">{receiptMember.culture}</p></div>
               <div><p className="text-xs font-bold text-stone-400 uppercase tracking-wide">Surface</p><p className="font-bold text-emerald-600 text-lg mt-1">{receiptMember.surface} ha</p></div>
            </div>

            <div className="p-4 bg-white flex gap-2">
              <button onClick={() => window.print()} className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 py-4 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors"><Printer size={18} /> Imprimer</button>
              <button onClick={() => setReceiptMember(null)} className="flex-1 bg-[#1b4332] text-white py-4 rounded-xl font-bold shadow-md hover:bg-emerald-800 transition-colors">Terminer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SCANNER QR */}
      {showScanner && (
        <div className="fixed inset-0 bg-stone-900/80 flex items-center justify-center p-4 z-[500] backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center shadow-2xl">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600"><Scan size={40} /></div>
            <h2 className="text-2xl font-black text-stone-800 mb-2">Scanner le reçu</h2>
            <p className="text-stone-500 text-sm font-medium mb-8 leading-relaxed">Placez le curseur dans le champ ci-dessous et utilisez votre douchette QR USB.</p>
            
            <form onSubmit={handleScanSubmit}>
              <input type="text" autoFocus required aria-label="Code scanné" placeholder="En attente du scanner..." className="w-full p-4 bg-stone-100 rounded-2xl border-2 border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 text-center font-mono font-bold text-stone-800 mb-6 transition-all" value={scanData} onChange={e => setScanData(e.target.value)} />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowScanner(false)} className="flex-1 bg-stone-100 text-stone-600 py-4 rounded-xl font-bold">Annuler</button>
                <button type="submit" className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-bold">Chercher</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* En-tête Organique */}
      <div className="bg-[#1b4332] text-white shadow-md rounded-b-[2.5rem] pb-10 pt-8 mb-[-2rem] relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <p className="text-emerald-300 text-sm font-bold tracking-wider uppercase">{appUser?.role === 'admin' ? "Espace Administrateur" : "Espace Agent"}</p>
              {isOffline && <span className="bg-amber-500 text-amber-950 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1"><WifiOff size={12}/> HORS LIGNE</span>}
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">👋 Bonjour, <br className="md:hidden" />{coopProfile?.nom || "l'équipe"} !</h1>
            <p className="text-emerald-100/80 mt-2 font-medium max-w-md">Voici un coup d'œil sur la situation de vos membres et de vos finances aujourd'hui.</p>
          </div>
          <button aria-label="Se déconnecter" onClick={() => signOut(auth)} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl text-sm font-bold flex items-center transition-colors"><LogOut size={20} /></button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-6 relative z-20">
        
        {/* Navigation Desktop */}
        <div className="hidden md:flex bg-white/80 backdrop-blur-md rounded-2xl shadow-sm mb-8 p-2 border border-white overflow-x-auto gap-2 max-w-fit mx-auto">
          <button onClick={() => setActiveTab('overview')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${activeTab === 'overview' ? 'bg-[#1b4332] text-white shadow-md' : 'text-stone-500 hover:bg-stone-100'}`}><TrendingUp size={18}/> Résumé</button>
          <button onClick={() => setActiveTab('members')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${activeTab === 'members' ? 'bg-[#1b4332] text-white shadow-md' : 'text-stone-500 hover:bg-stone-100'}`}><Users size={18}/> Producteurs</button>
          <button onClick={() => setActiveTab('harvests')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${activeTab === 'harvests' ? 'bg-amber-500 text-white shadow-md' : 'text-stone-500 hover:bg-stone-100'}`}><Wheat size={18}/> Récoltes & Ventes</button>
          <button onClick={() => setActiveTab('stock')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${activeTab === 'stock' ? 'bg-purple-600 text-white shadow-md' : 'text-stone-500 hover:bg-stone-100'}`}><Package size={18}/> Magasin</button>
          <button onClick={() => setActiveTab('orders')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${activeTab === 'orders' ? 'bg-[#1b4332] text-white shadow-md' : 'text-stone-500 hover:bg-stone-100'}`}><ShoppingCart size={18}/> Achats</button>
          <button onClick={() => setActiveTab('map')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${activeTab === 'map' ? 'bg-blue-600 text-white shadow-md' : 'text-stone-500 hover:bg-stone-100'}`}><MapIcon size={18}/> Cartographie</button>
          <button onClick={() => setActiveTab('settings')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${activeTab === 'settings' ? 'bg-stone-800 text-white shadow-md' : 'text-stone-500 hover:bg-stone-100'}`}><Settings size={18}/> Profil & Config</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">

            {activeTab === 'overview' && (
              <div className="space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-white p-6 rounded-3xl shadow-[0_10px_20px_-10px_rgba(0,0,0,0.05)] border border-stone-100">
                    <div className="bg-blue-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4"><Users className="text-blue-600" size={24} /></div>
                    <p className="text-4xl font-black text-stone-800 tracking-tight">{members.length}</p>
                    <p className="text-sm font-bold text-stone-400 mt-1">Producteurs</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl shadow-[0_10px_20px_-10px_rgba(0,0,0,0.05)] border border-stone-100">
                    <div className="bg-emerald-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4"><MapIcon className="text-emerald-600" size={24} /></div>
                    <p className="text-4xl font-black text-stone-800 tracking-tight">{members.reduce((acc, curr) => acc + parseFloat(curr.surface || '0'), 0).toFixed(2)} <span className="text-lg text-stone-500 font-bold">ha</span></p>
                    <p className="text-sm font-bold text-stone-400 mt-1">Surface Sécurisée</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl shadow-[0_10px_20px_-10px_rgba(0,0,0,0.05)] border border-stone-100 col-span-2 md:col-span-1">
                    <div className="bg-amber-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4"><Coins className="text-amber-500" size={24} /></div>
                    <p className="text-3xl font-black text-stone-800 tracking-tight">{realSales.toLocaleString()} <span className="text-sm text-stone-500 font-bold">FCFA</span></p>
                    <p className="text-sm font-bold text-stone-400 mt-1">Ventes réalisées</p>
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-stone-100 overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/3"></div>
                  
                  <h3 className="font-black text-2xl text-stone-800 mb-6 flex items-center gap-3"><Target className="text-[#1b4332]" size={28} /> Suivi des Objectifs Annuels</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <p className="text-stone-500 font-bold text-sm uppercase tracking-wider">Volume de Récolte</p>
                      <div className="bg-stone-50 p-5 rounded-3xl border border-stone-100">
                        <div className="flex justify-between items-end mb-2">
                          <div><p className="text-xs font-bold text-emerald-600 mb-1">RÉALISÉ</p><p className="text-3xl font-black text-stone-800">{realHarvests.toLocaleString()} <span className="text-base text-stone-400">Tonnes</span></p></div>
                          <div className="text-right"><p className="text-xs font-bold text-stone-400 mb-1">PRÉVU</p><p className="text-xl font-bold text-stone-400">{projections.totalRendement.toLocaleString()} <span className="text-sm">T</span></p></div>
                        </div>
                        <div className="h-3 w-full bg-stone-200 rounded-full overflow-hidden mt-4"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, projections.totalRendement > 0 ? (realHarvests / projections.totalRendement) * 100 : 0)}%` }}></div></div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <p className="text-stone-500 font-bold text-sm uppercase tracking-wider">Finances & Chiffre d'affaires</p>
                      <div className="bg-stone-50 p-5 rounded-3xl border border-stone-100">
                        <div className="flex justify-between items-end mb-2">
                          <div><p className="text-xs font-bold text-amber-600 mb-1">ENCAISSÉ</p><p className="text-3xl font-black text-stone-800">{realSales.toLocaleString()} <span className="text-base text-stone-400">FCFA</span></p></div>
                          <div className="text-right"><p className="text-xs font-bold text-stone-400 mb-1">POTENTIEL</p><p className="text-xl font-bold text-stone-400">{projections.totalRevenu.toLocaleString()} <span className="text-sm">FCFA</span></p></div>
                        </div>
                        <div className="h-3 w-full bg-stone-200 rounded-full overflow-hidden mt-4"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, projections.totalRevenu > 0 ? (realSales / projections.totalRevenu) * 100 : 0)}%` }}></div></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(activeTab === 'members' || activeTab === 'orders' || activeTab === 'stock' || activeTab === 'harvests') && (
              <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-stone-100">
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-8 gap-6">
                  <div>
                    <h2 className="text-2xl font-black text-stone-800 tracking-tight">
                      {activeTab === 'members' ? 'Vos Producteurs' : activeTab === 'orders' ? 'Dépenses & Achats' : activeTab === 'harvests' ? 'Récoltes & Ventes' : 'Magasin & Intrants'}
                    </h2>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    {activeTab === 'members' && (
                      <button onClick={() => setShowScanner(true)} className="bg-emerald-100 text-emerald-800 p-3 rounded-2xl hover:bg-emerald-200 transition-all font-bold flex items-center gap-2 shadow-sm" title="Scanner un Reçu">
                        <Scan size={20} className="text-emerald-600" /> Scanner
                      </button>
                    )}

                    <div className="relative w-full md:w-auto md:min-w-[200px]">
                      <Search className="absolute left-4 top-3.5 text-stone-400" size={18} />
                      <input type="text" aria-label="Rechercher" placeholder="Chercher..." className="w-full pl-11 pr-4 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-[#1b4332] font-medium transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    
                    <button aria-label="Export Excel" onClick={exportToExcel} className="bg-stone-50 text-emerald-700 p-3 rounded-2xl hover:bg-emerald-100 transition-colors border border-stone-100" title="Télécharger Excel"><FileSpreadsheet size={20} /></button>
                    <button aria-label="Export PDF" onClick={exportToPDF} className="bg-stone-50 text-rose-700 p-3 rounded-2xl hover:bg-rose-100 transition-colors border border-stone-100" title="Télécharger PDF"><FileText size={20} /></button>
                    
                    {(activeTab === 'orders' || activeTab === 'stock' || activeTab === 'harvests') && (
                       <button onClick={() => setShowForm(true)} className={`px-5 py-3 rounded-2xl flex items-center justify-center gap-2 font-black shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all ${activeTab === 'stock' ? 'bg-purple-600 text-white' : activeTab === 'harvests' ? 'bg-amber-500 text-white' : 'bg-[#1b4332] text-white'}`}>
                         <Plus size={20} /> Nouveau
                       </button>
                    )}
                  </div>
                </div>

                {/* LISTE DES MEMBRES */}
                {activeTab === 'members' && (
                  <div className="grid gap-4">
                    {filteredMembers.length === 0 ? <p className="text-center text-stone-400 py-10 font-medium">Aucun producteur trouvé.</p> : null}
                    {filteredMembers.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-5 bg-stone-50 rounded-3xl border border-stone-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group">
                        <div className="flex gap-5 items-center">
                          <div className="w-14 h-14 bg-emerald-100 rounded-[1rem] flex items-center justify-center font-black text-emerald-800 text-xl shrink-0">{m.nom[0]}</div>
                          <div>
                            <p className="font-black text-stone-800 text-lg flex items-center gap-2">{m.nom} {m.parcelle && <span title="Parcelle tracée"><MapIcon size={16} className="text-emerald-500" /></span>}</p>
                            <p className="text-sm font-medium text-stone-500">{m.village} • {m.culture} • <strong className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md ml-1">{m.surface} ha</strong></p>
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button aria-label="Voir le code QR" onClick={() => setReceiptMember(m)} className="text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 p-3 rounded-2xl transition-all" title="Afficher le reçu"><QrCode size={20} /></button>
                          {appUser?.role === 'admin' && <button aria-label="Supprimer" onClick={() => deleteDocGen("membres", m.id, setMembers, members)} className="text-stone-300 hover:text-rose-500 hover:bg-rose-50 p-3 rounded-2xl transition-all"><Trash2 size={20} /></button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* AUTRES LISTES (Identiques) */}
                {activeTab === 'harvests' && (
                  <div className="grid gap-4">
                     {filteredHarvests.length === 0 ? <p className="text-center text-stone-400 py-10 font-medium">Aucune récolte ou vente enregistrée.</p> : null}
                     {filteredHarvests.map(h => (
                      <div key={h.id} className="flex items-center justify-between p-5 bg-stone-50 rounded-3xl border border-stone-100 gap-4 hover:bg-white hover:shadow-md transition-all">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-2xl mt-1 ${h.type === 'recolte' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>{h.type === 'recolte' ? <Wheat size={24} /> : <Coins size={24} />}</div>
                          <div>
                            <p className="font-black text-stone-800 text-lg">{h.type === 'recolte' ? 'Récolte enregistrée' : 'Vente conclue'}</p>
                            <p className="text-sm font-medium text-stone-500 mb-2">{h.culture} • <strong className="text-stone-700">{h.qte} Tonnes</strong> {h.acteur && `• ${h.type === 'recolte' ? 'Par :' : 'À :'} ${h.acteur}`}</p>
                            <div className="flex gap-2"><span className="text-xs font-bold text-stone-500 bg-stone-200 px-2 py-1 rounded-lg">📅 {h.date}</span>{h.type === 'vente' && <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg">💰 {h.montant?.toLocaleString()} FCFA</span>}</div>
                          </div>
                        </div>
                        {appUser?.role === 'admin' && <button onClick={() => deleteDocGen("recoltes", h.id, setHarvests, harvests)} aria-label="Supprimer" className="text-stone-300 hover:text-rose-500 hover:bg-rose-50 p-3 rounded-2xl transition-all"><Trash2 size={20} /></button>}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'stock' && (
                  <div className="grid gap-4">
                    {filteredStock.length === 0 ? <p className="text-center text-stone-400 py-10 font-medium">Le magasin est vide.</p> : null}
                    {filteredStock.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-5 bg-stone-50 rounded-3xl border border-stone-100 gap-4 hover:bg-white hover:shadow-md transition-all">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-2xl mt-1 ${s.type === 'entree' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>{s.type === 'entree' ? <ArrowDownToLine size={24} /> : <ArrowUpFromLine size={24} />}</div>
                          <div>
                            <p className="font-black text-stone-800 text-lg">{s.produit} <span className="text-base font-bold text-stone-400 ml-1">({s.qte})</span></p>
                            <p className="text-sm font-medium text-stone-500 mb-2">{s.type === 'entree' ? 'Fourni par :' : 'Remis à :'} <span className="font-bold text-stone-700">{s.acteur}</span></p>
                            <div className="flex gap-2"><span className="text-xs font-bold text-stone-500 bg-stone-200 px-2 py-1 rounded-lg">📅 {s.date}</span><span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-1 rounded-lg">🏷️ {s.cout} FCFA</span></div>
                          </div>
                        </div>
                        {appUser?.role === 'admin' && <button onClick={() => deleteDocGen("magasin", s.id, setStock, stock)} aria-label="Supprimer" className="text-stone-300 hover:text-rose-500 hover:bg-rose-50 p-3 rounded-2xl transition-all"><Trash2 size={20} /></button>}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'orders' && (
                  <div className="grid gap-4">
                    {filteredOrders.length === 0 ? <p className="text-center text-stone-400 py-10 font-medium">Aucune dépense enregistrée.</p> : null}
                    {filteredOrders.map(o => (
                      <div key={o.id} className="flex items-center justify-between p-5 bg-stone-50 rounded-3xl border border-stone-100 gap-4 hover:bg-white hover:shadow-md transition-all">
                        <div>
                          <p className="font-black text-stone-800 text-lg">{o.produit} <span className="text-base font-bold text-stone-400 ml-1">({o.qte})</span></p>
                          <p className="text-sm font-bold text-emerald-700 mt-1 mb-2">{o.cout} FCFA</p>
                          <div className="flex items-center gap-3 text-xs font-bold"><span className="text-stone-500 bg-stone-200 px-2 py-1 rounded-lg">📅 {o.date}</span><span className="text-amber-600 bg-amber-100 px-2 py-1 rounded-lg flex items-center gap-1"><Clock size={12} /> {o.statut}</span></div>
                        </div>
                        {appUser?.role === 'admin' && <button onClick={() => deleteDocGen("commandes", o.id, setOrders, orders)} aria-label="Supprimer" className="text-stone-300 hover:text-rose-500 hover:bg-rose-50 p-3 rounded-2xl transition-all"><Trash2 size={20} /></button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                
                {appUser?.role === 'admin' && (
                  <div className="bg-emerald-50 rounded-[2.5rem] p-8 border border-emerald-200 flex flex-col md:flex-row gap-6 items-center justify-between shadow-sm">
                    <div>
                      <h3 className="text-xl font-black text-emerald-900 mb-2">Code d'invitation de la Coopérative</h3>
                      <p className="text-sm text-emerald-700 font-medium">Donnez ce code unique à vos agents. Lorsqu'ils créeront leur compte via "Rejoindre Équipe", ils accéderont directement à votre base de données de manière sécurisée.</p>
                    </div>
                    <div className="bg-white px-6 py-4 rounded-2xl border-2 border-emerald-500 text-2xl font-mono font-black text-emerald-600 shadow-md whitespace-nowrap">
                      {appUser.coopId}
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-stone-100">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600"><Target size={28}/></div>
                    <div>
                      <h2 className="text-2xl font-black text-stone-800 tracking-tight">Profil de la Coopérative</h2>
                      <p className="text-sm font-medium text-stone-500">Informations générales de votre espace de travail</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100">
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Nom de la Coopérative</p>
                      <p className="text-xl font-black text-stone-800">{coopProfile?.nom}</p>
                    </div>
                    
                    <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 relative overflow-hidden">
                      <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Code d'invitation (Coop ID)</p>
                      <div className="flex items-center justify-between">
                        <p className="text-2xl font-mono font-black text-emerald-800">{appUser?.coopId}</p>
                        <button onClick={copyToClipboard} className="p-2 bg-white rounded-xl shadow-sm text-emerald-600 hover:bg-emerald-600 hover:text-white transition-colors" title="Copier le code">
                          {copied ? <Check size={20} /> : <Copy size={20} />}
                        </button>
                      </div>
                      <p className="text-xs font-medium text-emerald-700/80 mt-2">Partagez ce code pour inviter de nouveaux agents.</p>
                    </div>

                    <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100">
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Votre Rôle</p>
                      <p className="text-lg font-bold text-stone-700 capitalize">{appUser?.role === 'admin' ? '👑 Administrateur' : '👤 Agent / Utilisateur'}</p>
                    </div>

                    <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100">
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Siège (Coordonnées GPS)</p>
                      <p className="text-lg font-bold text-stone-700">{coopProfile?.lat?.toFixed(4)}, {coopProfile?.lng?.toFixed(4)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-stone-100">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="p-3 bg-stone-100 rounded-2xl text-stone-600"><Settings size={28}/></div>
                    <h2 className="text-2xl font-black text-stone-800 tracking-tight">Cultures & Rendements</h2>
                  </div>
                  <p className="text-base font-medium text-stone-500 mb-8 max-w-xl">Définissez les cultures gérées par votre coopérative et estimez leurs rendements pour que l'outil puisse calculer vos prévisions financières annuelles.</p>
                  
                  {appUser?.role === 'admin' ? (
                    <form onSubmit={addNewCrop} className="bg-stone-50 p-6 rounded-3xl border border-stone-100 flex flex-col md:flex-row gap-5 mb-8">
                      <div className="flex-1"><label htmlFor="nomCulture" className="text-sm font-bold text-stone-600 px-2">Nom (ex: Anacarde)</label><input id="nomCulture" required placeholder="Tapez ici..." className="w-full p-4 bg-white rounded-2xl border-none shadow-sm mt-2 focus:ring-2 focus:ring-emerald-500 transition-all font-medium" value={newCrop.nom} onChange={e=>setNewCrop({...newCrop, nom: e.target.value})} /></div>
                      <div className="flex-1"><label htmlFor="rendementCulture" className="text-sm font-bold text-stone-600 px-2">Rendement (Tonnes/Ha)</label><input id="rendementCulture" required type="number" step="0.1" placeholder="Ex: 0.8" className="w-full p-4 bg-white rounded-2xl border-none shadow-sm mt-2 focus:ring-2 focus:ring-emerald-500 transition-all font-medium" value={newCrop.rendementHa || ''} onChange={e=>setNewCrop({...newCrop, rendementHa: parseFloat(e.target.value)})} /></div>
                      <div className="flex-1"><label htmlFor="prixCulture" className="text-sm font-bold text-stone-600 px-2">Prix estimé (FCFA/Tonne)</label><input id="prixCulture" required type="number" placeholder="Ex: 400000" className="w-full p-4 bg-white rounded-2xl border-none shadow-sm mt-2 focus:ring-2 focus:ring-emerald-500 transition-all font-medium" value={newCrop.prixTonne || ''} onChange={e=>setNewCrop({...newCrop, prixTonne: parseFloat(e.target.value)})} /></div>
                      <button type="submit" className="bg-[#1b4332] text-white px-6 py-4 rounded-2xl font-black self-end md:mb-[2px] shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex gap-2 items-center"><Plus size={20}/> Ajouter</button>
                    </form>
                  ) : (
                    <div className="bg-blue-50 text-blue-700 p-4 rounded-2xl mb-8 font-medium text-sm">Seul l'administrateur peut ajouter ou modifier les cultures de la coopérative.</div>
                  )}

                  <div className="grid gap-4">
                    {coopProfile?.cultures.map((c, idx) => (
                      <div key={idx} className="flex justify-between items-center p-5 border border-stone-100 rounded-3xl bg-white hover:border-emerald-200 transition-colors">
                        <div>
                          <p className="font-black text-xl text-stone-800 mb-1">{c.nom}</p>
                          <div className="flex gap-3">
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">🌱 Rendement attendu : {c.rendementHa} T/ha</span>
                            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg">🏷️ Prix marché : {c.prixTonne.toLocaleString()} FCFA/T</span>
                          </div>
                        </div>
                        {appUser?.role === 'admin' && <button aria-label="Supprimer cette culture" onClick={() => removeCrop(idx)} className="text-stone-300 p-3 hover:bg-rose-50 hover:text-rose-500 rounded-2xl transition-colors"><Trash2 size={24}/></button>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'map' && (
              <div className="bg-white rounded-[2.5rem] p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-stone-100 h-[650px] flex flex-col relative overflow-hidden">
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 rounded-2xl text-blue-600"><MapIcon size={24}/></div>
                    <h2 className="text-2xl font-black text-stone-800 tracking-tight">Cadastre</h2>
                  </div>
                  {isOffline && <div className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-2 rounded-xl flex items-center gap-2"><WifiOff size={14}/> Carte HD bloquée en hors-ligne</div>}
                </div>
                
                <div key={`map-container-${activeTab}`} className="flex-1 rounded-[2rem] overflow-hidden border-2 border-stone-100 z-0 relative shadow-inner">
                  {coopProfile && (
                    <MapContainer center={[coopProfile.lat, coopProfile.lng]} zoom={10} style={{ height: '100%', width: '100%' }}>
                      <TileLayer url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}" maxZoom={20} subdomains={['mt0','mt1','mt2','mt3']} />
                      
                      <MapInvalidator />
                      <AutoFitBounds members={members} defaultCenter={{lat: coopProfile.lat, lng: coopProfile.lng}} />
                      
                      {members.map((m) => (
                        <React.Fragment key={m.id}>
                          {m.parcelle && m.parcelle.length > 0 ? (
                            <Polygon positions={m.parcelle.map(p => [p.lat, p.lng])} pathOptions={{ color: '#10b981', fillColor: '#34d399', fillOpacity: 0.5 }}>
                              <Tooltip permanent direction="center" className="bg-white/95 border-none rounded-xl px-3 py-2 shadow-lg text-xs font-bold text-[#1b4332] text-center backdrop-blur-sm">{m.nom} <br/> <span className="text-emerald-600">{m.surface} ha</span></Tooltip>
                              <Popup>
                                <div className="text-sm min-w-[160px] p-1 font-sans">
                                  <strong className="text-xl font-black text-stone-800 block mb-2">{m.nom}</strong>
                                  <div className="space-y-1.5 text-stone-600 font-medium">
                                    <p className="flex justify-between"><span>Village:</span> <strong className="text-stone-800">{m.village}</strong></p>
                                    <p className="flex justify-between"><span>Culture:</span> <strong className="text-stone-800">{m.culture}</strong></p>
                                    <p className="flex justify-between items-center mt-2 pt-2 border-t border-stone-100"><span>Surface:</span> <strong className="text-emerald-600 text-lg bg-emerald-50 px-2 rounded-md">{m.surface} ha</strong></p>
                                  </div>
                                </div>
                              </Popup>
                            </Polygon>
                          ) : (
                            m.gps && (
                              <Marker position={[m.gps.lat, m.gps.lng]} icon={userLocationIcon}>
                                <Tooltip permanent direction="top" offset={[0, -20]} className="bg-white/95 border-none rounded-xl px-3 py-2 shadow-lg text-xs font-bold text-blue-800 text-center backdrop-blur-sm">{m.nom}</Tooltip>
                                <Popup>
                                  <div className="text-sm min-w-[160px] p-1 font-sans">
                                    <strong className="text-xl font-black text-stone-800 block mb-2">{m.nom}</strong>
                                    <p className="mb-1 text-stone-600 font-medium"><strong>Village :</strong> {m.village}</p>
                                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg font-bold text-center mt-3">📍 Coordonnées GPS simples (Aucun tracé)</p>
                                  </div>
                                </Popup>
                              </Marker>
                            )
                          )}
                        </React.Fragment>
                      ))}
                    </MapContainer>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* LA COLONNE DE DROITE (BARRE LATÉRALE) */}
          <div className="space-y-8 mt-4 lg:mt-0">
            
            {/* Widget Météo Complet avec Alertes 3 jours */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-[2.5rem] border border-blue-100 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4"></div>
              
              <h3 className="font-black text-blue-900 mb-6 flex items-center gap-3 text-lg"><CloudRain className="text-blue-500" size={24}/> La météo locale</h3>
              
              {isOffline ? (
                <div className="bg-white/60 p-4 rounded-3xl backdrop-blur-sm border border-amber-100 text-amber-700 text-sm font-bold flex flex-col items-center text-center gap-2">
                  <WifiOff size={24} className="text-amber-500"/> Météo indisponible hors ligne. Synchronisation à votre retour au bureau.
                </div>
              ) : weatherError ? (
                <div className="bg-white/60 p-4 rounded-3xl backdrop-blur-sm border border-red-100 text-red-600 text-sm font-bold text-center">
                  Impossible de charger la météo actuellement.
                </div>
              ) : weather ? (
                <>
                  <div className="flex items-center justify-between relative z-10 mb-6">
                    <div>
                      <p className="text-5xl font-black text-blue-950 tracking-tighter">{weather.temp}°<span className="text-3xl text-blue-800/60">C</span></p>
                      <p className="text-sm font-bold text-blue-600 uppercase mt-2 tracking-wider line-clamp-2" title={weather.locationName}>{weather.locationName}</p>
                    </div>
                    <div className="bg-white/60 p-4 rounded-3xl backdrop-blur-sm shadow-sm border border-white">
                      {weather.isSunny ? <Sun size={56} strokeWidth={1.5} className="text-amber-500" /> : <CloudRain size={56} strokeWidth={1.5} className="text-blue-400" />}
                    </div>
                  </div>

                  <div className="pt-5 border-t border-blue-200/50">
                    <p className="text-xs font-bold text-blue-800 mb-3 uppercase tracking-wider flex items-center gap-2"><AlertTriangle size={14} className="text-amber-500"/> Alertes Pluie (3 jours)</p>
                    <div className="space-y-2">
                      {weather.alerts.map((a, i) => (
                        <div key={i} className="flex justify-between items-center bg-white/40 px-3 py-2.5 rounded-xl text-sm font-medium text-blue-900 border border-white/50">
                          <span className="capitalize">{new Date(a.date).toLocaleDateString('fr-FR', {weekday: 'short', day: 'numeric'})}</span>
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 font-bold text-blue-700">{a.prob}% <CloudRain size={12} className="opacity-70"/></span>
                            <span className="text-xs text-blue-500/80 bg-white/50 px-2 py-0.5 rounded-md min-w-[50px] text-center">{a.sum} mm</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm font-medium text-blue-600 animate-pulse text-center py-4">Observation du ciel en cours...</p>
              )}
            </div>
            
            {/* NOUVEAU: Widget Cartographie (Remplace Prêts & Financements) */}
            <div className="bg-white rounded-[2.5rem] p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-stone-100 flex flex-col relative overflow-hidden h-[450px]">
              <div className="flex items-center justify-between mb-4 relative z-10">
                <h3 className="font-black text-stone-800 flex items-center gap-2 text-lg"><MapIcon size={20} className="text-emerald-500"/> Aperçu des parcelles</h3>
                {isOffline && <span title="Hors Ligne"><WifiOff size={14} className="text-amber-500" /></span>}
              </div>
              <div className="flex-1 rounded-[1.5rem] overflow-hidden border border-stone-100 z-0 relative shadow-inner">
                {coopProfile && (
                  <MapContainer center={[coopProfile.lat, coopProfile.lng]} zoom={10} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}" maxZoom={20} subdomains={['mt0','mt1','mt2','mt3']} />
                    <MapInvalidator />
                    <AutoFitBounds members={members} defaultCenter={{lat: coopProfile.lat, lng: coopProfile.lng}} />
                    {members.map((m) => (
                      <React.Fragment key={`mini-${m.id}`}>
                        {m.parcelle && m.parcelle.length > 0 ? (
                          <Polygon positions={m.parcelle.map(p => [p.lat, p.lng])} pathOptions={{ color: '#10b981', fillColor: '#34d399', fillOpacity: 0.5 }}>
                            <Tooltip permanent direction="center" className="bg-white/95 border-none rounded-xl px-2 py-1 shadow-lg text-[10px] font-bold text-[#1b4332] text-center backdrop-blur-sm">{m.nom}</Tooltip>
                            <Popup>
                              <div className="text-sm min-w-[150px] p-1 font-sans">
                                <strong className="text-lg font-black text-stone-800 block mb-1">{m.nom}</strong>
                                <p className="text-stone-600 font-medium mb-1">{m.village} • {m.culture}</p>
                                <p className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-md inline-block">{m.surface} ha</p>
                              </div>
                            </Popup>
                          </Polygon>
                        ) : (
                          m.gps && (
                            <Marker position={[m.gps.lat, m.gps.lng]} icon={userLocationIcon}>
                              <Tooltip permanent direction="top" offset={[0, -20]} className="bg-white/95 border-none rounded-xl px-2 py-1 shadow-lg text-[10px] font-bold text-blue-800 text-center backdrop-blur-sm">{m.nom}</Tooltip>
                              <Popup>
                                <div className="text-sm min-w-[150px] p-1 font-sans">
                                  <strong className="text-lg font-black text-stone-800 block mb-1">{m.nom}</strong>
                                  <p className="text-stone-600 font-medium">{m.village} • {m.culture}</p>
                                </div>
                              </Popup>
                            </Marker>
                          )
                        )}
                      </React.Fragment>
                    ))}
                  </MapContainer>
                )}
              </div>
              <p className="text-xs text-stone-400 font-medium text-center mt-3">Toutes les parcelles enregistrées de la coopérative.</p>
            </div>
            
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-[100] backdrop-blur-md overflow-y-auto font-sans">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl my-8 border border-stone-100">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-stone-800 tracking-tight">
                {activeTab === 'orders' ? 'Nouvelle Dépense' : activeTab === 'harvests' ? 'Enregistrer une Récolte/Vente' : 'Mouvement de stock'}
              </h2>
              <button onClick={() => setShowForm(false)} aria-label="Fermer le formulaire" className="text-stone-400 bg-stone-100 hover:bg-stone-200 hover:text-stone-600 p-3 rounded-full transition-colors"><X size={20}/></button>
            </div>

            {activeTab === 'harvests' && (
              <form onSubmit={addHarvestTransaction} className="space-y-5">
                <div className="flex gap-2 p-1 bg-stone-100 rounded-2xl mb-6">
                  <button type="button" onClick={() => setNewHarvest({...newHarvest, type: 'recolte'})} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${newHarvest.type === 'recolte' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>🌾 J'ai récolté</button>
                  <button type="button" onClick={() => setNewHarvest({...newHarvest, type: 'vente'})} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${newHarvest.type === 'vente' ? 'bg-white text-amber-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>💰 J'ai vendu</button>
                </div>

                <div className="space-y-2"><label className="text-sm font-bold text-stone-500 px-2">Date de l'opération</label><input required aria-label="Date de l'opération" type="date" className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-amber-500 font-medium text-stone-800" value={newHarvest.date} onChange={e => setNewHarvest({...newHarvest, date: e.target.value})} /></div>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-500 px-2">Quelle culture ?</label>
                  <select required aria-label="Sélectionner la culture" className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-amber-500 font-medium text-stone-800" value={newHarvest.culture} onChange={e => setNewHarvest({...newHarvest, culture: e.target.value})}>
                    <option value="" disabled>Choisir dans la liste...</option>
                    {coopProfile?.cultures.map((c, idx) => <option key={idx} value={c.nom}>{c.nom}</option>)}
                  </select>
                </div>
                
                <div className="space-y-2"><label className="text-sm font-bold text-stone-500 px-2">Volume (en Tonnes)</label><input required aria-label="Volume en tonnes" type="number" step="0.1" placeholder="Ex: 12.5" className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-amber-500 font-medium text-stone-800" value={newHarvest.qte || ''} onChange={e => setNewHarvest({...newHarvest, qte: parseFloat(e.target.value)})} /></div>
                
                {newHarvest.type === 'vente' && (
                  <div className="space-y-2"><label className="text-sm font-bold text-stone-500 px-2">Montant total reçu (FCFA)</label><input required aria-label="Montant en FCFA" type="number" placeholder="Ex: 1500000" className="w-full p-4 bg-amber-50 rounded-2xl border-none focus:ring-2 focus:ring-amber-500 font-bold text-amber-900" value={newHarvest.montant || ''} onChange={e => setNewHarvest({...newHarvest, montant: parseFloat(e.target.value)})} /></div>
                )}
                
                <div className="space-y-2"><label className="text-sm font-bold text-stone-500 px-2">{newHarvest.type === 'recolte' ? "Quel producteur ? (Optionnel)" : "Qui est l'acheteur ? (Optionnel)"}</label><input aria-label="Nom de l'acteur" placeholder="Nom..." className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-amber-500 font-medium text-stone-800" value={newHarvest.acteur} onChange={e => setNewHarvest({...newHarvest, acteur: e.target.value})} /></div>
                
                <button type="submit" className="w-full bg-amber-500 text-white py-5 rounded-2xl font-black text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 mt-4 transition-all">Valider l'opération</button>
              </form>
            )}

            {activeTab === 'orders' && (
              <form onSubmit={addOrder} className="space-y-5">
                <div className="space-y-2"><label className="text-sm font-bold text-stone-500 px-2">Date de l'achat</label><input required aria-label="Date" type="date" className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-[#1b4332] font-medium" value={newOrder.date} onChange={e => setNewOrder({...newOrder, date: e.target.value})} /></div>
                <div className="space-y-2"><label className="text-sm font-bold text-stone-500 px-2">Qu'avez-vous acheté ?</label><input required aria-label="Produit" placeholder="Ex: Engrais NPK..." className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-[#1b4332] font-medium" value={newOrder.produit} onChange={e => setNewOrder({...newOrder, produit: e.target.value})} /></div>
                <div className="space-y-2"><label className="text-sm font-bold text-stone-500 px-2">Combien ?</label><input required aria-label="Quantité" placeholder="Ex: 50 sacs" className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-[#1b4332] font-medium" value={newOrder.qte} onChange={e => setNewOrder({...newOrder, qte: e.target.value})} /></div>
                <div className="space-y-2"><label className="text-sm font-bold text-stone-500 px-2">Combien ça a coûté ? (FCFA)</label><input required aria-label="Montant en FCFA" type="number" placeholder="Montant total..." className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-[#1b4332] font-medium" value={newOrder.cout} onChange={e => setNewOrder({...newOrder, cout: e.target.value})} /></div>
                <button type="submit" className="w-full bg-[#1b4332] text-white py-5 rounded-2xl font-black text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 mt-4 transition-all">Enregistrer la dépense</button>
              </form>
            )}

            {activeTab === 'stock' && (
              <form onSubmit={addStockTransaction} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-500 px-2">Que se passe-t-il ?</label>
                  <select required aria-label="Type d'opération" className="w-full p-4 bg-purple-50 rounded-2xl border-none focus:ring-2 focus:ring-purple-500 font-bold text-purple-900" value={newStock.type} onChange={e => setNewStock({...newStock, type: e.target.value as 'entree'|'sortie'})}>
                    <option value="entree">📥 Ça rentre dans le magasin</option>
                    <option value="sortie">📤 Ça sort du magasin</option>
                  </select>
                </div>
                <div className="space-y-2"><label className="text-sm font-bold text-stone-500 px-2">Aujourd'hui, le :</label><input required aria-label="Date" type="date" className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-purple-500 font-medium" value={newStock.date} onChange={e => setNewStock({...newStock, date: e.target.value})} /></div>
                <div className="space-y-2"><label className="text-sm font-bold text-stone-500 px-2">Quoi exactement ?</label><input required aria-label="Produit" placeholder="Nom de l'article" className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-purple-500 font-medium" value={newStock.produit} onChange={e => setNewStock({...newStock, produit: e.target.value})} /></div>
                <div className="space-y-2"><label className="text-sm font-bold text-stone-500 px-2">Combien ?</label><input required aria-label="Quantité" placeholder="Ex: 10 Bidons" className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-purple-500 font-medium" value={newStock.qte} onChange={e => setNewStock({...newStock, qte: e.target.value})} /></div>
                <div className="space-y-2"><label className="text-sm font-bold text-stone-500 px-2">Valeur de la marchandise (FCFA)</label><input required aria-label="Montant en FCFA" type="number" placeholder="Valeur estimée..." className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-purple-500 font-medium" value={newStock.cout} onChange={e => setNewStock({...newStock, cout: e.target.value})} /></div>
                <div className="space-y-2"><label className="text-sm font-bold text-stone-500 px-2">{newStock.type === 'entree' ? "Fourni par qui ?" : "Donné à qui ?"}</label><input required aria-label="Nom de la personne liée" placeholder="Nom de la personne" className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-purple-500 font-medium" value={newStock.acteur} onChange={e => setNewStock({...newStock, acteur: e.target.value})} /></div>
                <button type="submit" className="w-full bg-purple-600 text-white py-5 rounded-2xl font-black text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 mt-4 transition-all">Mettre à jour le stock</button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* BOUTON FLOTTANT ACTION RAPIDE */}
      <button aria-label="Tracer une parcelle" onClick={startWizard} className="fixed bottom-24 right-6 md:bottom-10 md:right-10 bg-emerald-500 text-white w-16 h-16 rounded-[1.2rem] shadow-[0_15px_30px_rgba(16,185,129,0.4)] flex items-center justify-center hover:bg-emerald-400 transition-all hover:scale-110 active:scale-95 z-[90] border-2 border-emerald-400 rotate-3 hover:rotate-0">
        <MapPin size={28} />
      </button>

      {/* NAVIGATION MOBILE */}
      <div className="md:hidden fixed bottom-0 w-full bg-white/90 backdrop-blur-xl border-t border-stone-100 flex items-center justify-around py-3 px-2 z-[80] shadow-[0_-15px_40px_rgba(0,0,0,0.05)] overflow-x-auto pb-safe">
        <button onClick={() => setActiveTab('overview')} className={`flex flex-col items-center flex-1 min-w-[60px] transition-colors ${activeTab === 'overview' ? 'text-[#1b4332]' : 'text-stone-400'}`}><TrendingUp size={22} /><span className="text-[10px] font-bold mt-1.5">Résumé</span></button>
        <button onClick={() => setActiveTab('members')} className={`flex flex-col items-center flex-1 min-w-[60px] transition-colors ${activeTab === 'members' ? 'text-[#1b4332]' : 'text-stone-400'}`}><Users size={22} /><span className="text-[10px] font-bold mt-1.5">Paysans</span></button>
        <button onClick={() => setActiveTab('harvests')} className={`flex flex-col items-center flex-1 min-w-[60px] transition-colors ${activeTab === 'harvests' ? 'text-amber-500' : 'text-stone-400'}`}><Wheat size={22} /><span className="text-[10px] font-bold mt-1.5">Récoltes</span></button>
        <button onClick={() => setActiveTab('stock')} className={`flex flex-col items-center flex-1 min-w-[60px] transition-colors ${activeTab === 'stock' ? 'text-purple-600' : 'text-stone-400'}`}><Package size={22} /><span className="text-[10px] font-bold mt-1.5">Magasin</span></button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center flex-1 min-w-[60px] transition-colors ${activeTab === 'settings' ? 'text-stone-800' : 'text-stone-400'}`}><Settings size={22} /><span className="text-[10px] font-bold mt-1.5">Profil</span></button>
      </div>

    </div>
  );
};

export default CoopDashboard;