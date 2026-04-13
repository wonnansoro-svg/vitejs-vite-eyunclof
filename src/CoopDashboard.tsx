import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Sprout, ShoppingCart, TrendingUp, Search,
  Clock, Plus, X, FileSpreadsheet, FileText, 
  Map as MapIcon, CloudRain, Sun, Trash2, LogOut, Lock, User,
  Package, ArrowDownToLine, ArrowUpFromLine, Check, 
  Play, Square, Undo, Navigation, MapPin
} from 'lucide-react';

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, useMapEvents } from 'react-leaflet';
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

// Composant pour gérer les clics manuels sur la carte (sans forcer le recentrage)
const MapController = ({ onMapClick }: { onMapClick: (p: Point) => void }) => {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });
  return null;
};

const CoopDashboard: React.FC = () => {
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
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2 | 3>(0); 
  const [parcelPoints, setParcelPoints] = useState<Point[]>([]);
  const [currentLocation, setCurrentLocation] = useState<Point | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const trackingWatchId = useRef<number | null>(null);
  
  const [mapRef, setMapRef] = useState<L.Map | null>(null);
  // Référence pour savoir si on a déjà centré la caméra au démarrage
  const initialCenterDone = useRef<boolean>(false);

  const [newMember, setNewMember] = useState<Partial<Member>>({ nom: '', village: '', culture: '', surface: '', date: '', cout: '' });
  const [newOrder, setNewOrder] = useState<Partial<Order>>({ produit: '', qte: '', date: '', cout: '' });
  const [newStock, setNewStock] = useState<Partial<StockTransaction>>({ type: 'entree', produit: '', qte: '', date: '', cout: '', acteur: '' });

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
      } catch (error) { console.error("Erreur", error); }
    };
    if (isLoggedIn) fetchDonnees();
  }, [isLoggedIn]);

  useEffect(() => {
    if (wizardStep === 1) {
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentLocation(newPos);

          // On centre la carte UNE SEULE FOIS quand on capte le GPS au lancement du wizard
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
    setNewMember({ nom: '', village: '', culture: '', surface: '', date: new Date().toISOString().split('T')[0], cout: '5000' });
    initialCenterDone.current = false; // On réinitialise le "premier centrage"
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
    } catch (e) { alert("Erreur géométrique. Les lignes se croisent-elles ?"); }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (authMode === 'register') await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
      else await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
    } catch (error: any) { alert("Erreur : " + error.message); }
  };

  const addMemberFromWizard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, "membres"), { ...newMember, statut: "Actif" });
      setMembers([{ id: docRef.id, ...newMember, statut: "Actif" } as Member, ...members]);
      setWizardStep(0); setActiveTab('members');
      alert("Membre enregistré avec succès !");
    } catch (err) { alert("Erreur."); }
  };

  const addOrder = async (e: React.FormEvent) => { e.preventDefault(); try { const docRef = await addDoc(collection(db, "commandes"), { ...newOrder, statut: "En attente" }); setOrders([{ id: docRef.id, ...newOrder, statut: "En attente" } as Order, ...orders]); setShowForm(false); } catch (err) { alert("Erreur commande."); } };
  const addStockTransaction = async (e: React.FormEvent) => { e.preventDefault(); try { const docRef = await addDoc(collection(db, "magasin"), newStock); setStock([{ id: docRef.id, ...newStock } as StockTransaction, ...stock]); setShowForm(false); } catch (err) { alert("Erreur magasin."); } };
  const deleteDocGen = async <T extends { id: string }>(collectionName: string, id: string, setter: React.Dispatch<React.SetStateAction<T[]>>, state: T[]) => { if(window.confirm("Supprimer ?")) { try { await deleteDoc(doc(db, collectionName, id)); setter(state.filter(item => item.id !== id)); } catch (err) { alert("Erreur."); } } };

  const exportToExcel = () => {
    let dataToExport;
    let fileName = 'Export.xlsx';

    if (activeTab === 'members') {
      dataToExport = members.map(m => ({ Nom: m.nom, Village: m.village, Culture: m.culture, Surface: `${m.surface} ha`, Date: m.date, Frais: `${m.cout} FCFA`, Statut: m.statut }));
      fileName = 'Liste_Membres_CAB.xlsx';
    } else if (activeTab === 'orders') {
      dataToExport = orders.map(o => ({ Produit: o.produit, Quantite: o.qte, Date: o.date, Cout: `${o.cout} FCFA`, Statut: o.statut }));
      fileName = 'Liste_Commandes_CAB.xlsx';
    } else {
      dataToExport = stock.map(s => ({ Type: s.type === 'entree' ? 'Entrée' : 'Sortie', Produit: s.produit, Quantite: s.qte, Date: s.date, Valeur: `${s.cout} FCFA`, Acteur: s.acteur }));
      fileName = 'Historique_Magasin_CAB.xlsx';
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
        title = 'ANNUAIRE DES MEMBRES - CAB';
        fileName = 'Rapport_Membres.pdf';
        tableHeaders = [["Nom", "Village", "Culture", "Date", "Frais", "Statut"]];
        tableData = members.map(m => [m.nom, m.village, m.culture, m.date, `${m.cout} FCFA`, m.statut]);
      } else if (activeTab === 'orders') {
        title = 'SUIVI DES COMMANDES - CAB';
        fileName = 'Rapport_Commandes.pdf';
        tableHeaders = [["Produit", "Quantité", "Date", "Coût", "Statut"]];
        tableData = orders.map(o => [o.produit || "", o.qte || "", o.date || "", `${o.cout} FCFA`, o.statut || ""]);
      } else {
        title = 'HISTORIQUE DU MAGASIN (STOCKS) - CAB';
        fileName = 'Rapport_Magasin.pdf';
        tableHeaders = [["Opération", "Produit", "Quantité", "Date", "Valeur", "Tiers"]];
        tableData = stock.map(s => [s.type === 'entree' ? 'Entrée' : 'Sortie', s.produit, s.qte, s.date, `${s.cout} FCFA`, s.acteur]);
      }

      docPDF.setFontSize(16);
      docPDF.text(title, 14, 15);
      docPDF.setFontSize(10);
      docPDF.text("Coopérative Agricole de NIAKARA (Région du Poro)", 14, 22);
      
      autoTable(docPDF, {
        head: tableHeaders,
        body: tableData,
        startY: 30,
        theme: 'grid',
        headStyles: { fillColor: [22, 163, 74] } 
      });

      docPDF.save(fileName);
    } catch (err) { console.error(err); alert("Erreur PDF."); }
  };

  if (authLoading) return <div className="min-h-screen bg-green-50 flex items-center justify-center"><p className="font-bold text-green-700">Chargement...</p></div>;
  
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8 border border-green-100">
          <div className="flex justify-center mb-6"><div className="bg-green-100 p-4 rounded-full"><Sprout size={48} className="text-green-600" /></div></div>
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">CAB NIAKARA</h1>
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

  // --- WIZARD ETAPES ---
  if (wizardStep === 1) {
    return (
      <div className="fixed inset-0 bg-white z-[200] flex flex-col">
        <div className="bg-green-700 text-white p-4 shadow-md flex justify-between items-center z-[210]">
          <div><h2 className="font-bold text-lg">Relevé de la parcelle</h2><p className="text-green-200 text-xs">{parcelPoints.length} point(s) enregistré(s)</p></div>
          <button onClick={() => setWizardStep(0)} className="bg-green-800 p-2 rounded-full"><X size={20}/></button>
        </div>
        <div className="flex-1 relative">
          <MapContainer ref={setMapRef} center={[9.5222, -6.4869]} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}" maxZoom={20} subdomains={['mt0','mt1','mt2','mt3']} />
            
            {/* Nouveau contrôleur qui gère les clics manuels SANS forcer la caméra */}
            <MapController onMapClick={addManualPoint} />
            
            {currentLocation && <Marker position={[currentLocation.lat, currentLocation.lng]} icon={userLocationIcon} />}
            {parcelPoints.map((p, i) => <Marker key={i} position={[p.lat, p.lng]} icon={vertexIcon} />)}
            {parcelPoints.length > 1 && <Polyline positions={parcelPoints.map(p => [p.lat, p.lng])} color="#16a34a" weight={4} />}
            {parcelPoints.length >= 3 && <Polygon positions={parcelPoints.map(p => [p.lat, p.lng])} pathOptions={{ color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.3 }} />}
          </MapContainer>
          <div className="absolute top-4 left-4 right-4 z-[400] flex justify-between">
            {/* Bouton pour se recentrer manuellement sur sa position GPS si on est perdu */}
            <button onClick={() => { if(currentLocation && mapRef) mapRef.setView([currentLocation.lat, currentLocation.lng], 18, {animate: true}) }} className="bg-white p-3 rounded-full shadow-lg text-blue-600 flex items-center justify-center h-12 w-12"><Navigation size={24} /></button>
            {parcelPoints.length > 0 && <button onClick={undoLastPoint} className="bg-white px-4 py-2 rounded-full shadow-lg text-gray-700 font-bold flex gap-2 items-center h-12"><Undo size={20} /> <span className="text-sm">Annuler point</span></button>}
          </div>
        </div>
        <div className="bg-white rounded-t-3xl shadow-[0_-10px_20px_rgba(0,0,0,0.1)] z-[210] p-4 pb-8">
          <div className="flex gap-2 mb-4">
            <button onClick={() => setIsTracking(!isTracking)} className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-colors ${isTracking ? 'bg-red-50 border-red-500 text-red-600' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
              {isTracking ? <Square size={32} className="mb-2" /> : <Play size={32} className="mb-2 text-green-600" />}
              <span className="font-bold text-sm text-center">{isTracking ? 'Stop Arpentage' : 'Démarrer (Marche)'}</span>
            </button>
            <button onClick={() => { if(currentLocation) addManualPoint(currentLocation) }} disabled={isTracking || !currentLocation} className="flex-1 flex flex-col items-center justify-center p-4 rounded-2xl bg-gray-50 border-2 border-gray-200 text-gray-700 disabled:opacity-50 hover:bg-gray-100">
              <MapPin size={32} className="mb-2 text-blue-600" />
              <span className="font-bold text-sm text-center">Placer un point ici</span>
            </button>
          </div>
          <button onClick={calculateAreaAndProceed} disabled={parcelPoints.length < 3 || isTracking} className="w-full h-14 bg-green-600 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-gray-400">
            <Check size={24} /> Terminer et Calculer
          </button>
        </div>
      </div>
    );
  }

  if (wizardStep === 2) {
    return (
      <div className="fixed inset-0 bg-white z-[200] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6"><MapIcon size={48} /></div>
        <h2 className="text-3xl font-black text-gray-800 mb-2">Surface Estimée</h2>
        <div className="bg-gray-50 border-2 border-green-500 rounded-2xl p-6 w-full max-w-sm mb-8 shadow-inner"><p className="text-6xl font-black text-green-600">{newMember.surface}</p><p className="text-xl font-bold text-gray-500 mt-2">Hectares (ha)</p></div>
        <div className="w-full max-w-sm space-y-4">
          <button onClick={() => setWizardStep(3)} className="w-full h-14 bg-green-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-green-700">Valider cette mesure</button>
          <button onClick={() => setWizardStep(1)} className="w-full h-14 bg-gray-100 text-gray-600 rounded-2xl font-bold text-lg border border-gray-300">Refaire le tracé</button>
        </div>
      </div>
    );
  }

  if (wizardStep === 3) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-[200] overflow-y-auto">
        <div className="bg-green-700 text-white p-4 shadow-md flex justify-between items-center sticky top-0"><h2 className="font-bold text-lg">Informations du Paysan</h2><button onClick={() => setWizardStep(0)} className="text-green-200"><X size={24}/></button></div>
        <div className="p-4 max-w-md mx-auto mt-4">
          <form onSubmit={addMemberFromWizard} className="space-y-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="bg-green-50 p-4 rounded-xl border border-green-200 flex justify-between items-center"><span className="font-bold text-green-800">Superficie tracée :</span><span className="text-xl font-black text-green-700">{newMember.surface} ha</span></div>
            <div className="space-y-1"><label className="text-sm font-bold text-gray-600">Nom Complet</label><input required className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 text-lg" value={newMember.nom} onChange={e => setNewMember({...newMember, nom: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-sm font-bold text-gray-600">Village / Campement</label><input required className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 text-lg" value={newMember.village} onChange={e => setNewMember({...newMember, village: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-sm font-bold text-gray-600">Culture principale</label><input required className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 text-lg" value={newMember.culture} onChange={e => setNewMember({...newMember, culture: e.target.value})} /></div>
            <button type="submit" className="w-full h-14 bg-green-600 text-white rounded-xl font-bold text-lg shadow-lg mt-8">Enregistrer dans la base</button>
          </form>
        </div>
      </div>
    );
  }

  const filteredMembers = members.filter(m => m.nom.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredOrders = orders.filter(o => o.produit.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredStock = stock.filter(s => s.produit.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-green-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div><p className="text-green-200 text-xs md:text-sm font-medium">Coopérative Agricole</p><h1 className="text-xl md:text-3xl font-bold">CAB - NIAKARA</h1></div>
          <button onClick={() => signOut(auth)} className="bg-red-500 p-2 rounded-lg text-sm font-bold flex items-center gap-2"><LogOut size={16} /></button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div className="hidden md:flex bg-white rounded-xl shadow-sm mb-6 p-2 border border-gray-100 overflow-x-auto">
          <button onClick={() => setActiveTab('overview')} className={`flex-1 min-w-[120px] py-3 rounded-lg font-bold flex justify-center items-center gap-2 ${activeTab === 'overview' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}><TrendingUp size={18}/> Général</button>
          <button onClick={() => setActiveTab('members')} className={`flex-1 min-w-[120px] py-3 rounded-lg font-bold flex justify-center items-center gap-2 ${activeTab === 'members' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}><Users size={18}/> Membres</button>
          <button onClick={() => setActiveTab('stock')} className={`flex-1 min-w-[120px] py-3 rounded-lg font-bold flex justify-center items-center gap-2 ${activeTab === 'stock' ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-50'}`}><Package size={18}/> Magasin</button>
          <button onClick={() => setActiveTab('orders')} className={`flex-1 min-w-[120px] py-3 rounded-lg font-bold flex justify-center items-center gap-2 ${activeTab === 'orders' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}><ShoppingCart size={18}/> Commandes</button>
          <button onClick={() => setActiveTab('map')} className={`flex-1 min-w-[120px] py-3 rounded-lg font-bold flex justify-center items-center gap-2 ${activeTab === 'map' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}><MapIcon size={18}/> Carte</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            {activeTab === 'overview' && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"><Users className="text-blue-600 mb-2" size={32} /><p className="text-3xl font-bold">{members.length}</p><p className="text-xs font-medium text-gray-500">Membres</p></div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"><MapIcon className="text-green-600 mb-2" size={32} /><p className="text-3xl font-bold">{members.reduce((acc, curr) => acc + parseFloat(curr.surface || '0'), 0).toFixed(2)} <span className="text-lg">ha</span></p><p className="text-xs font-medium text-gray-500">Surface</p></div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"><Package className="text-purple-600 mb-2" size={32} /><p className="text-3xl font-bold">{stock.length}</p><p className="text-xs font-medium text-gray-500">Mouvements Stock</p></div>
              </div>
            )}

            {(activeTab === 'members' || activeTab === 'orders' || activeTab === 'stock') && (
              <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                  <h2 className="text-xl font-bold text-gray-800">
                    {activeTab === 'members' ? 'Annuaire des Paysans' : activeTab === 'orders' ? 'Suivi des Commandes' : 'Gestion du Magasin'}
                  </h2>
                  <div className="relative flex-1 w-full md:max-w-xs">
                    <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="text" placeholder="Rechercher..." className="w-full pl-10 pr-4 py-2 bg-gray-50 rounded-lg border border-gray-200" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <button onClick={exportToExcel} className="bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-lg text-sm font-bold hover:bg-green-100 flex items-center gap-2"><FileSpreadsheet size={16} /> Excel</button>
                    <button onClick={exportToPDF} className="bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-100 flex items-center gap-2"><FileText size={16} /> PDF</button>
                    
                    {(activeTab === 'orders' || activeTab === 'stock') && (
                       <button onClick={() => setShowForm(true)} className={`${activeTab === 'stock' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'} text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-bold ml-2`}>
                         <Plus size={18} /> Nouveau
                       </button>
                    )}
                  </div>
                </div>

                {activeTab === 'members' && (
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
                )}

                {activeTab === 'stock' && (
                  <div className="grid gap-4">
                    {filteredStock.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-full mt-1 ${s.type === 'entree' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                            {s.type === 'entree' ? <ArrowDownToLine size={20} /> : <ArrowUpFromLine size={20} />}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800">{s.produit} <span className="text-sm font-normal">({s.qte})</span></p>
                            <p className="text-xs text-gray-500 mb-1">{s.type === 'entree' ? 'Fournisseur :' : 'Bénéficiaire :'} <span className="font-bold text-gray-700">{s.acteur}</span></p>
                            <span className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-1 rounded">Date: {s.date} | Val: {s.cout} FCFA</span>
                          </div>
                        </div>
                        <button onClick={() => deleteDocGen("magasin", s.id, setStock, stock)} className="text-red-400 hover:text-red-600"><Trash2 size={20} /></button>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'orders' && (
                  <div className="grid gap-4">
                    {filteredOrders.map(o => (
                      <div key={o.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 gap-4">
                        <div>
                          <p className="font-bold text-gray-800">{o.produit} <span className="text-sm font-normal text-gray-500">({o.qte})</span></p>
                          <p className="text-xs font-medium text-blue-700 mt-1">Date: {o.date} | Coût: {o.cout} FCFA</p>
                          <div className="flex items-center gap-2 text-xs font-bold text-green-600 mt-1"><Clock size={14} /> {o.statut}</div>
                        </div>
                        <button onClick={() => deleteDocGen("commandes", o.id, setOrders, orders)} className="text-red-400 hover:text-red-600"><Trash2 size={20} /></button>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}

            {activeTab === 'map' && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 h-[600px] flex flex-col">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800"><MapIcon className="text-green-600" /> Carte des Parcelles</h2>
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
                          m.gps && <Marker position={[m.gps.lat, m.gps.lng]}><Popup><strong>{m.nom}</strong> - Point simple</Popup></Marker>
                        )}
                      </React.Fragment>
                    ))}
                  </MapContainer>
                </div>
              </div>
            )}
          </div>

          <div className="hidden lg:block space-y-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200">
              <h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2"><CloudRain className="text-blue-600" /> Météo - Poro</h3>
              {weather ? (
                <><div className="flex items-center justify-between mb-4"><div><p className="text-4xl font-black text-blue-900">{weather.temp}°C</p><p className="text-sm text-blue-700">NIAKARA</p></div>{weather.isSunny ? <Sun size={48} className="text-yellow-500" /> : <CloudRain size={48} className="text-blue-400" />}</div></>
              ) : (<p className="text-sm text-blue-700">Chargement...</p>)}
            </div>
          </div>

        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold italic text-gray-800">{activeTab === 'orders' ? 'Nouvelle Commande' : 'Opération Magasin'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 bg-gray-100 p-2 rounded-full"><X size={20}/></button>
            </div>

            {activeTab === 'orders' && (
              <form onSubmit={addOrder} className="space-y-4">
                <input required type="date" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" value={newOrder.date} onChange={e => setNewOrder({...newOrder, date: e.target.value})} />
                <input required placeholder="Produit demandé" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" value={newOrder.produit} onChange={e => setNewOrder({...newOrder, produit: e.target.value})} />
                <input required placeholder="Quantité" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" value={newOrder.qte} onChange={e => setNewOrder({...newOrder, qte: e.target.value})} />
                <input required type="number" placeholder="Coût estimé (FCFA)" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" value={newOrder.cout} onChange={e => setNewOrder({...newOrder, cout: e.target.value})} />
                <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold">Valider Commande</button>
              </form>
            )}

            {activeTab === 'stock' && (
              <form onSubmit={addStockTransaction} className="space-y-4">
                <select required className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 font-bold" value={newStock.type} onChange={e => setNewStock({...newStock, type: e.target.value as 'entree'|'sortie'})}>
                  <option value="entree">Entrée en stock</option>
                  <option value="sortie">Sortie de stock</option>
                </select>
                <input required type="date" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" value={newStock.date} onChange={e => setNewStock({...newStock, date: e.target.value})} />
                <input required placeholder="Nom du Produit" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" value={newStock.produit} onChange={e => setNewStock({...newStock, produit: e.target.value})} />
                <input required placeholder="Quantité (ex: 50 sacs, 10 L)" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" value={newStock.qte} onChange={e => setNewStock({...newStock, qte: e.target.value})} />
                <input required type="number" placeholder="Valeur Total (FCFA)" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" value={newStock.cout} onChange={e => setNewStock({...newStock, cout: e.target.value})} />
                <input required placeholder={newStock.type === 'entree' ? "Fournisseur" : "Bénéficiaire"} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" value={newStock.acteur} onChange={e => setNewStock({...newStock, acteur: e.target.value})} />
                <button type="submit" className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold">Confirmer l'opération</button>
              </form>
            )}
          </div>
        </div>
      )}

      <button 
        onClick={startWizard}
        className="fixed bottom-20 right-4 md:bottom-8 md:right-8 bg-green-600 text-white w-16 h-16 rounded-full shadow-[0_10px_25px_rgba(22,163,74,0.5)] flex items-center justify-center hover:bg-green-700 transition-transform active:scale-95 z-[100]"
      >
        <MapPin size={28} />
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md">+ Nouveau</div>
      </button>

      <div className="md:hidden fixed bottom-0 w-full bg-white border-t flex items-center justify-around py-3 px-2 z-[90] shadow-[0_-5px_15px_rgba(0,0,0,0.05)] overflow-x-auto">
        <button onClick={() => setActiveTab('overview')} className={`flex flex-col items-center flex-1 min-w-[60px] ${activeTab === 'overview' ? 'text-green-600' : 'text-gray-400'}`}><TrendingUp size={20} /><span className="text-[9px] font-bold mt-1">Général</span></button>
        <button onClick={() => setActiveTab('members')} className={`flex flex-col items-center flex-1 min-w-[60px] ${activeTab === 'members' ? 'text-green-600' : 'text-gray-400'}`}><Users size={20} /><span className="text-[9px] font-bold mt-1">Membres</span></button>
        <button onClick={() => setActiveTab('stock')} className={`flex flex-col items-center flex-1 min-w-[60px] ${activeTab === 'stock' ? 'text-purple-600' : 'text-gray-400'}`}><Package size={20} /><span className="text-[9px] font-bold mt-1">Magasin</span></button>
        <button onClick={() => setActiveTab('orders')} className={`flex flex-col items-center flex-1 min-w-[60px] ${activeTab === 'orders' ? 'text-green-600' : 'text-gray-400'}`}><ShoppingCart size={20} /><span className="text-[9px] font-bold mt-1">Achats</span></button>
        <button onClick={() => setActiveTab('map')} className={`flex flex-col items-center flex-1 min-w-[60px] ${activeTab === 'map' ? 'text-green-600' : 'text-gray-400'}`}><MapIcon size={20} /><span className="text-[9px] font-bold mt-1">Carte</span></button>
      </div>

    </div>
  );
};

export default CoopDashboard;