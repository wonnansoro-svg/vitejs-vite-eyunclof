import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Sprout, ShoppingCart, TrendingUp, Search,
  Clock, Plus, X, FileSpreadsheet, FileText, 
  Map as MapIcon, CloudRain, Sun, Trash2, LogOut, Lock, User,
  Package, ArrowDownToLine, ArrowUpFromLine, Check, 
  Play, Square, Undo, Navigation, MapPin, AlertTriangle
} from 'lucide-react';

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';

// Configuration des icônes Leaflet
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

// --- 1. CONFIGURATION FIREBASE ---
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
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

// --- TYPES ---
interface Point { lat: number; lng: number }

interface Member {
  id: string; 
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

interface Order { id: string; produit: string; qte: string; date: string; cout: string; statut: string; }
interface StockTransaction { id: string; type: 'entree' | 'sortie'; produit: string; qte: string; date: string; cout: string; acteur: string; }

// ============================================================================
// COMPOSANTS ASSISTANT (WIZARD) POUR LE TRACÉ MOBILE
// ============================================================================

// Composant pour recentrer la carte et gérer les clics manuels
const MapController = ({ onMapClick, centerPos }: { onMapClick: (p: Point) => void, centerPos: Point | null }) => {
  const map = useMap();
  
  useEffect(() => {
    if (centerPos) {
      map.setView([centerPos.lat, centerPos.lng], 18, { animate: true });
    }
  }, [centerPos, map]);

  useMapEvents({
    click(e) { onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }); }
  });

  return null;
};

const CoopDashboard: React.FC = () => {
  // --- ÉTATS GLOBAUX ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true); 
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [credentials, setCredentials] = useState({ email: '', password: '' });

  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'orders' | 'stock' | 'map'>('overview');
  const [showForm, setShowForm] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [weather, setWeather] = useState<{ temp: number, isSunny: boolean } | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stock, setStock] = useState<StockTransaction[]>([]); 

  // --- ÉTATS DU WIZARD DE TRACÉ ---
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2 | 3>(0); // 0: off, 1: map, 2: validation, 3: form
  const [parcelPoints, setParcelPoints] = useState<Point[]>([]);
  const [currentLocation, setCurrentLocation] = useState<Point | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const trackingWatchId = useRef<number | null>(null);

  const [newMember, setNewMember] = useState<Partial<Member>>({ nom: '', village: '', culture: '', surface: '', date: '', cout: '' });
  const [newOrder, setNewOrder] = useState<Partial<Order>>({ produit: '', qte: '', date: '', cout: '' });
  const [newStock, setNewStock] = useState<Partial<StockTransaction>>({ type: 'entree', produit: '', qte: '', date: '', cout: '', acteur: '' });

  // --- EFFETS ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=9.5222&longitude=-6.4869&current_weather=true")
      .then(res => res.json())
      .then(data => setWeather({ temp: data.current_weather.temperature, isSunny: data.current_weather.weathercode < 3 }))
      .catch(err => console.error("Erreur météo", err));

    const fetchDonnees = async () => {
      try {
        const mSnap = await getDocs(collection(db, "membres"));
        setMembers(mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Member)));
        const oSnap = await getDocs(collection(db, "commandes"));
        setOrders(oSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
        const sSnap = await getDocs(collection(db, "magasin"));
        setStock(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as StockTransaction)));
      } catch (error) { console.error("Erreur de connexion", error); }
    };
    if (isLoggedIn) fetchDonnees();
  }, [isLoggedIn]);

  // --- GESTION GPS & TRACKING (MODE MARCHE) ---
  useEffect(() => {
    // Suit en permanence la position de l'utilisateur s'il est dans le wizard
    if (wizardStep === 1) {
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentLocation(newPos);
          
          // Si le mode "Arpentage" (tracking) est activé, on enregistre automatiquement les points
          if (isTracking) {
            setParcelPoints(prev => {
              // On évite d'ajouter un point s'il est trop proche du précédent (filtre anti-bruit GPS)
              if (prev.length > 0) {
                const last = prev[prev.length - 1];
                const from = turf.point([last.lng, last.lat]);
                const to = turf.point([newPos.lng, newPos.lat]);
                const distance = turf.distance(from, to, { units: 'meters' });
                if (distance < 2) return prev; // Ne pas ajouter si on a bougé de moins de 2 mètres
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

    return () => {
      if (trackingWatchId.current !== null) {
        navigator.geolocation.clearWatch(trackingWatchId.current);
      }
    };
  }, [wizardStep, isTracking]);

  // --- FONCTIONS DU WIZARD ---
  const startWizard = () => {
    setParcelPoints([]);
    setNewMember({ nom: '', village: '', culture: '', surface: '', date: new Date().toISOString().split('T')[0], cout: '5000' });
    setWizardStep(1);
  };

  const undoLastPoint = () => setParcelPoints(prev => prev.slice(0, -1));

  const addManualPoint = (p: Point) => {
    if (!isTracking) setParcelPoints(prev => [...prev, p]);
  };

  const calculateAreaAndProceed = () => {
    if (parcelPoints.length < 3) {
      alert("Il faut au moins 3 points pour former une parcelle.");
      return;
    }

    try {
      // Préparation des coordonnées pour Turf (Turf demande un polygone fermé [lng, lat])
      const coords = parcelPoints.map(p => [p.lng, p.lat]);
      coords.push([parcelPoints[0].lng, parcelPoints[0].lat]); // Fermeture

      const polygon = turf.polygon([coords]);
      const areaInSqMeters = turf.area(polygon);
      const areaInHa = (areaInSqMeters / 10000).toFixed(2);
      
      const center = turf.centerOfMass(polygon);

      setNewMember(prev => ({
        ...prev,
        surface: areaInHa,
        parcelle: parcelPoints,
        gps: { lat: center.geometry.coordinates[1], lng: center.geometry.coordinates[0] }
      }));

      setWizardStep(2); // Passage à la validation
    } catch (e) {
      alert("Erreur géométrique. Les lignes de votre champ se croisent-elles ?");
    }
  };

  // --- ACTIONS BASE DE DONNEES ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (authMode === 'register') {
        await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
      } else {
        await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      }
    } catch (error: any) { alert("Erreur : " + error.message); }
  };

  const addMemberFromWizard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, "membres"), { ...newMember, statut: "Actif" });
      setMembers([{ id: docRef.id, ...newMember, statut: "Actif" } as Member, ...members]);
      setWizardStep(0); // Ferme le wizard
      setActiveTab('members');
      alert("Membre et parcelle enregistrés avec succès !");
    } catch (err) { alert("Erreur lors de l'enregistrement."); }
  };

  const addOrder = async (e: React.FormEvent) => { /* ... même logique ... */ e.preventDefault(); try { const docRef = await addDoc(collection(db, "commandes"), { ...newOrder, statut: "En attente" }); setOrders([{ id: docRef.id, ...newOrder, statut: "En attente" } as Order, ...orders]); setShowForm(false); } catch (err) { alert("Erreur commande."); } };
  const addStockTransaction = async (e: React.FormEvent) => { /* ... même logique ... */ e.preventDefault(); try { const docRef = await addDoc(collection(db, "magasin"), newStock); setStock([{ id: docRef.id, ...newStock } as StockTransaction, ...stock]); setShowForm(false); } catch (err) { alert("Erreur magasin."); } };
  
  const deleteDocGen = async <T extends { id: string }>(collectionName: string, id: string, setter: React.Dispatch<React.SetStateAction<T[]>>, state: T[]) => {
    if(window.confirm("Supprimer cet élément ?")) {
      try { await deleteDoc(doc(db, collectionName, id)); setter(state.filter(item => item.id !== id)); } catch (err) { alert("Erreur suppression."); }
    }
  };

  // --- RENDUS SPÉCIFIQUES ---
  if (authLoading) return <div className="min-h-screen bg-green-50 flex items-center justify-center"><p className="font-bold text-green-700">Chargement...</p></div>;
  
  if (!isLoggedIn) {
    // ... ÉCRAN DE CONNEXION (Identique au précédent) ...
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8 border border-green-100">
          <div className="flex justify-center mb-6"><div className="bg-green-100 p-4 rounded-full"><Sprout size={48} className="text-green-600" /></div></div>
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">CAB KORHOGO</h1>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="relative"><User className="absolute left-3 top-3 text-gray-400" size={20} /><input required type="email" placeholder="Adresse e-mail" className="w-full pl-10 p-3 bg-gray-50 rounded-xl border border-gray-200" value={credentials.email} onChange={e => setCredentials({...credentials, email: e.target.value})} /></div>
            <div className="relative"><Lock className="absolute left-3 top-3 text-gray-400" size={20} /><input required type="password" placeholder="Mot de passe" className="w-full pl-10 p-3 bg-gray-50 rounded-xl border border-gray-200" value={credentials.password} onChange={e => setCredentials({...credentials, password: e.target.value})} /></div>
            <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">{authMode === 'register' ? "S'inscrire" : "Se Connecter"}</button>
          </form>
          <p className="text-center mt-6 text-sm"><button onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')} className="text-green-600 font-bold">{authMode === 'register' ? "Déjà un compte ?" : "Inscrivez-vous"}</button></p>
        </div>
      </div>
    );
  }

  // ==========================================
  // VUES DU WIZARD (PLEIN ECRAN MOBILE)
  // ==========================================
  
  // ETAPE 1 : LA CARTE ET LE TRACÉ
  if (wizardStep === 1) {
    return (
      <div className="fixed inset-0 bg-white z-[200] flex flex-col">
        {/* En-tête de la carte */}
        <div className="bg-green-700 text-white p-4 shadow-md flex justify-between items-center z-[210]">
          <div>
            <h2 className="font-bold text-lg">Relevé de la parcelle</h2>
            <p className="text-green-200 text-xs">{parcelPoints.length} point(s) enregistré(s)</p>
          </div>
          <button onClick={() => setWizardStep(0)} className="bg-green-800 p-2 rounded-full"><X size={20}/></button>
        </div>

        {/* Zone de la carte */}
        <div className="flex-1 relative">
          <MapContainer center={[9.5222, -6.4869]} zoom={16} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}" maxZoom={20} subdomains={['mt0','mt1','mt2','mt3']} /> {/* Vue Satellite Google (Idéale pour les champs) */}
            
            <MapController onMapClick={addManualPoint} centerPos={currentLocation} />

            {/* Affichage de la position en temps réel */}
            {currentLocation && <Marker position={[currentLocation.lat, currentLocation.lng]} icon={userLocationIcon} />}

            {/* Affichage des points tracés */}
            {parcelPoints.map((p, i) => (
              <Marker key={i} position={[p.lat, p.lng]} icon={vertexIcon} />
            ))}

            {/* Affichage des lignes reliant les points */}
            {parcelPoints.length > 1 && (
              <Polyline positions={parcelPoints.map(p => [p.lat, p.lng])} color="#16a34a" weight={4} />
            )}
            
            {/* Si au moins 3 points, on ferme visuellement le polygone pour aider l'utilisateur */}
            {parcelPoints.length >= 3 && (
               <Polygon positions={parcelPoints.map(p => [p.lat, p.lng])} pathOptions={{ color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.3 }} />
            )}
          </MapContainer>

          {/* HUD (Heads Up Display) par dessus la carte */}
          <div className="absolute top-4 left-4 right-4 z-[400] flex justify-between">
            <button onClick={() => { if(currentLocation) map.setView([currentLocation.lat, currentLocation.lng], 18) }} className="bg-white p-3 rounded-full shadow-lg text-blue-600">
              <Navigation size={24} />
            </button>
            {parcelPoints.length > 0 && (
              <button onClick={undoLastPoint} className="bg-white p-3 rounded-full shadow-lg text-gray-700 font-bold flex gap-2 items-center">
                <Undo size={20} /> <span className="text-sm">Annuler</span>
              </button>
            )}
          </div>
        </div>

        {/* Panneau de contrôle du bas (Zone du pouce) */}
        <div className="bg-white rounded-t-3xl shadow-[0_-10px_20px_rgba(0,0,0,0.1)] z-[210] p-4 pb-8">
          
          <div className="flex gap-2 mb-4">
            {/* Bouton Arpentage */}
            <button 
              onClick={() => setIsTracking(!isTracking)}
              className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-colors ${isTracking ? 'bg-red-50 border-red-500 text-red-600' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
            >
              {isTracking ? <Square size={32} className="mb-2" /> : <Play size={32} className="mb-2 text-green-600" />}
              <span className="font-bold text-sm text-center">{isTracking ? 'Stop Arpentage' : 'Démarrer (Marche)'}</span>
            </button>

            {/* Bouton Manuel */}
            <button 
              onClick={() => { if(currentLocation) addManualPoint(currentLocation) }}
              disabled={isTracking || !currentLocation}
              className="flex-1 flex flex-col items-center justify-center p-4 rounded-2xl bg-gray-50 border-2 border-gray-200 text-gray-700 disabled:opacity-50"
            >
              <MapPin size={32} className="mb-2 text-blue-600" />
              <span className="font-bold text-sm text-center">Placer un point ici</span>
            </button>
          </div>

          <button 
            onClick={calculateAreaAndProceed}
            disabled={parcelPoints.length < 3 || isTracking}
            className="w-full h-14 bg-green-600 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-gray-400"
          >
            <Check size={24} /> Terminer et Calculer
          </button>
        </div>
      </div>
    );
  }

  // ETAPE 2 : VALIDATION DE LA SURFACE
  if (wizardStep === 2) {
    return (
      <div className="fixed inset-0 bg-white z-[200] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <MapIcon size={48} />
        </div>
        <h2 className="text-3xl font-black text-gray-800 mb-2">Surface Estimée</h2>
        <div className="bg-gray-50 border-2 border-green-500 rounded-2xl p-6 w-full max-w-sm mb-8 shadow-inner">
          <p className="text-6xl font-black text-green-600">{newMember.surface}</p>
          <p className="text-xl font-bold text-gray-500 mt-2">Hectares (ha)</p>
        </div>
        
        <div className="w-full max-w-sm space-y-4">
          <button onClick={() => setWizardStep(3)} className="w-full h-14 bg-green-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-green-700">
            Valider cette mesure
          </button>
          <button onClick={() => setWizardStep(1)} className="w-full h-14 bg-gray-100 text-gray-600 rounded-2xl font-bold text-lg border border-gray-300">
            Refaire le tracé
          </button>
        </div>
      </div>
    );
  }

  // ETAPE 3 : FORMULAIRE FINAL DU MEMBRE
  if (wizardStep === 3) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-[200] overflow-y-auto">
        <div className="bg-green-700 text-white p-4 shadow-md flex justify-between items-center sticky top-0">
          <h2 className="font-bold text-lg">Informations du Paysan</h2>
          <button onClick={() => setWizardStep(0)} className="text-green-200"><X size={24}/></button>
        </div>
        <div className="p-4 max-w-md mx-auto mt-4">
          <form onSubmit={addMemberFromWizard} className="space-y-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            
            {/* Champ bloqué pour la surface */}
            <div className="bg-green-50 p-4 rounded-xl border border-green-200 flex justify-between items-center">
               <span className="font-bold text-green-800">Superficie tracée :</span>
               <span className="text-xl font-black text-green-700">{newMember.surface} ha</span>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-gray-600">Nom Complet</label>
              <input required className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 text-lg" value={newMember.nom} onChange={e => setNewMember({...newMember, nom: e.target.value})} />
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-bold text-gray-600">Village / Campement</label>
              <input required className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 text-lg" value={newMember.village} onChange={e => setNewMember({...newMember, village: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-gray-600">Culture principale</label>
              <input required placeholder="ex: Cacao, Anacarde..." className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 text-lg" value={newMember.culture} onChange={e => setNewMember({...newMember, culture: e.target.value})} />
            </div>

            <button type="submit" className="w-full h-14 bg-green-600 text-white rounded-xl font-bold text-lg shadow-lg mt-8">
              Enregistrer dans la base
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // TABLEAU DE BORD PRINCIPAL (DESKTOP / LISTES)
  // ==========================================

  // ... (Garde le filtrage)
  const filteredMembers = members.filter(m => m.nom.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* HEADER */}
      <div className="bg-green-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div><p className="text-green-200 text-xs md:text-sm font-medium">Coopérative Agricole</p><h1 className="text-xl md:text-3xl font-bold">CAB - KORHOGO</h1></div>
          <button onClick={() => signOut(auth)} className="bg-red-500 p-2 rounded-lg text-sm font-bold flex items-center gap-2"><LogOut size={16} /></button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        
        {/* TABS (Desktop) */}
        <div className="hidden md:flex bg-white rounded-xl shadow-sm mb-6 p-2 border border-gray-100">
          {/* ... Tabs similaires au code précédent ... */}
          <button onClick={() => setActiveTab('members')} className={`flex-1 py-3 rounded-lg font-bold flex justify-center gap-2 ${activeTab === 'members' ? 'bg-green-100 text-green-700' : 'text-gray-500'}`}><Users size={18}/> Membres</button>
          {/* On masque les autres tabs pour alléger le code ici, mais vous pouvez les remettre */}
          <button onClick={() => setActiveTab('map')} className={`flex-1 py-3 rounded-lg font-bold flex justify-center gap-2 ${activeTab === 'map' ? 'bg-green-100 text-green-700' : 'text-gray-500'}`}><MapIcon size={18}/> Carte</button>
        </div>

        {/* CONTENU MEMBRES */}
        {activeTab === 'members' && (
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
              <h2 className="text-xl font-bold text-gray-800">Annuaire des Paysans</h2>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                <input type="text" placeholder="Rechercher..." className="w-full pl-10 p-2 bg-gray-50 rounded-lg border border-gray-200" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4">
              {filteredMembers.map(m => (
                <div key={m.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center font-bold text-green-800 shrink-0">{m.nom[0]}</div>
                    <div>
                      <p className="font-bold text-gray-800 flex items-center gap-2">{m.nom} {m.parcelle && <MapIcon size={14} className="text-green-600" />}</p>
                      <p className="text-xs text-gray-500">{m.village} • {m.culture} • <strong className="text-green-700">{m.surface} ha</strong></p>
                    </div>
                  </div>
                  <button onClick={() => deleteDocGen("membres", m.id, setMembers, members)} className="text-red-400 hover:text-red-600"><Trash2 size={20} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONTENU CARTE GLOBALE */}
        {activeTab === 'map' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 h-[600px] flex flex-col">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800"><MapIcon className="text-green-600" /> Carte des Parcelles de la Coopérative</h2>
            <div className="flex-1 rounded-xl overflow-hidden border border-gray-200 z-0">
              <MapContainer center={[9.5222, -6.4869]} zoom={10} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}" maxZoom={20} subdomains={['mt0','mt1','mt2','mt3']} />
                
                {members.map((m) => (
                  <React.Fragment key={m.id}>
                    {m.parcelle && m.parcelle.length > 0 ? (
                      <Polygon positions={m.parcelle.map(p => [p.lat, p.lng])} pathOptions={{ color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.6 }}>
                        <Popup><strong>{m.nom}</strong><br/>{m.village}<br/>{m.culture} - {m.surface} ha</Popup>
                      </Polygon>
                    ) : (
                      m.gps && (
                        <Marker position={[m.gps.lat, m.gps.lng]}>
                          <Popup><strong>{m.nom}</strong><br/>{m.culture} - {m.surface} ha (Point simple)</Popup>
                        </Marker>
                      )
                    )}
                  </React.Fragment>
                ))}
              </MapContainer>
            </div>
          </div>
        )}
      </div>

      {/* BOUTON FLOTTANT (FAB) POUR DEMARRER LE WIZARD (MOBILE FIRST) */}
      <button 
        onClick={startWizard}
        className="fixed bottom-20 right-4 md:bottom-8 md:right-8 bg-green-600 text-white w-16 h-16 rounded-full shadow-[0_10px_25px_rgba(22,163,74,0.5)] flex items-center justify-center hover:bg-green-700 transition-transform active:scale-95 z-[100]"
      >
        <MapPin size={28} />
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md">+ Nouveau</div>
      </button>

      {/* NAVIGATION MOBILE EN BAS */}
      <div className="md:hidden fixed bottom-0 w-full bg-white border-t flex items-center justify-around py-3 px-2 z-[90] shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
        <button onClick={() => setActiveTab('members')} className={`flex flex-col items-center flex-1 ${activeTab === 'members' ? 'text-green-600' : 'text-gray-400'}`}><Users size={24} /><span className="text-[10px] font-bold mt-1">Membres</span></button>
        <button onClick={() => setActiveTab('map')} className={`flex flex-col items-center flex-1 ${activeTab === 'map' ? 'text-green-600' : 'text-gray-400'}`}><MapIcon size={24} /><span className="text-[10px] font-bold mt-1">Carte</span></button>
      </div>

    </div>
  );
};

export default CoopDashboard;