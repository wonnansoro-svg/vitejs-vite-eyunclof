import React, { useState, useEffect } from 'react';
import { 
  Users, Sprout, ShoppingCart, TrendingUp, Search,
  Clock, Plus, X, FileSpreadsheet, FileText, 
  Map as MapIcon, CloudRain, Sun, MapPin, Trash2, Crosshair, LogOut, Lock, User,
  Package, ArrowDownToLine, ArrowUpFromLine 
} from 'lucide-react';

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// --- 1. CONFIGURATION FIREBASE ---
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
// NOUVEAU : Importation des outils d'authentification Firebase
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

// Your web app's Firebase configuration
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
// NOUVEAU : Initialisation de l'authentification
const auth = getAuth(app);

// --- TYPES ---
interface Member {
  id: string; 
  nom: string;
  village: string;
  culture: string;
  surface: string;
  statut: string;
  date: string; 
  cout: string; 
  gps?: { lat: number; lng: number }; 
}

interface Order {
  id: string;
  produit: string;
  qte: string;
  date: string; 
  cout: string; 
  statut: string;
}

interface StockTransaction {
  id: string;
  type: 'entree' | 'sortie';
  produit: string;
  qte: string;
  date: string;
  cout: string; 
  acteur: string; 
}

const CoopDashboard: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // Ajout d'un état de chargement pour éviter le "clignotement" de l'écran de connexion
  const [authLoading, setAuthLoading] = useState(true); 
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  // On utilise 'email' au lieu de 'username'
  const [credentials, setCredentials] = useState({ email: '', password: '' });

  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'orders' | 'stock' | 'map'>('overview');
  const [showForm, setShowForm] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [weather, setWeather] = useState<{ temp: number, isSunny: boolean } | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stock, setStock] = useState<StockTransaction[]>([]); 

  const [newMember, setNewMember] = useState<Partial<Member>>({ nom: '', village: '', culture: '', surface: '', date: '', cout: '' });
  const [newOrder, setNewOrder] = useState<Partial<Order>>({ produit: '', qte: '', date: '', cout: '' });
  const [newStock, setNewStock] = useState<Partial<StockTransaction>>({ type: 'entree', produit: '', qte: '', date: '', cout: '', acteur: '' });

  // --- NOUVEAU : SURVEILLANCE DE LA CONNEXION ---
  useEffect(() => {
    // Firebase vérifie automatiquement si vous êtes déjà connecté (même après F5)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
      }
      setAuthLoading(false); // Le chargement est terminé
    });

    return () => unsubscribe(); // Nettoyage
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
      } catch (error) {
        console.error("Erreur de connexion", error);
      }
    };
    
    // On ne charge les données que si l'utilisateur est vraiment connecté
    if (isLoggedIn) fetchDonnees();
  }, [isLoggedIn]);

  // --- NOUVEAU : GESTION DE LA CONNEXION FIREBASE ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (authMode === 'register') {
        // Crée le compte sur les serveurs de Google
        await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
        alert("Inscription réussie ! Vous êtes connecté.");
      } else {
        // Connecte l'utilisateur
        await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      }
      // setIsLoggedIn(true) sera fait automatiquement par le onAuthStateChanged
    } catch (error: any) {
      console.error(error);
      alert("Erreur : " + error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth); // Déconnecte proprement de Firebase
    } catch (error) {
      console.error("Erreur déconnexion", error);
    }
  };

  // ... Reste des fonctions de gestion de données (addMember, addOrder, etc.) ...
  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, "membres"), { ...newMember, statut: "Actif" });
      setMembers([{ id: docRef.id, ...newMember, statut: "Actif" } as Member, ...members]);
      setNewMember({ nom: '', village: '', culture: '', surface: '', date: '', cout: '' });
      setShowForm(false);
    } catch (err) { console.error(err); alert("Erreur membre."); }
  };

  const addOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, "commandes"), { ...newOrder, statut: "En attente" });
      setOrders([{ id: docRef.id, ...newOrder, statut: "En attente" } as Order, ...orders]);
      setNewOrder({ produit: '', qte: '', date: '', cout: '' });
      setShowForm(false);
    } catch (err) { console.error(err); alert("Erreur commande."); }
  };

  const addStockTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, "magasin"), newStock);
      setStock([{ id: docRef.id, ...newStock } as StockTransaction, ...stock]);
      setNewStock({ type: 'entree', produit: '', qte: '', date: '', cout: '', acteur: '' });
      setShowForm(false);
    } catch (err) { console.error(err); alert("Erreur opération magasin."); }
  };

  const deleteDocGen = async <T extends { id: string }>(collectionName: string, id: string, setter: React.Dispatch<React.SetStateAction<T[]>>, state: T[]) => {
    if(window.confirm("Supprimer cet élément ?")) {
      try {
        await deleteDoc(doc(db, collectionName, id));
        setter(state.filter(item => item.id !== id));
      } catch (err) { console.error(err); alert("Erreur suppression."); }
    }
  };

  const captureGPS = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setNewMember({ ...newMember, gps: { lat: pos.coords.latitude, lng: pos.coords.longitude } }); alert("GPS capturé !"); },
        () => alert("Erreur GPS.")
      );
    }
  };

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
      docPDF.text("Coopérative Agricole de Boundiali (Région de la Bagoué)", 14, 22);
      
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

  const filteredMembers = members.filter(m => m.nom.toLowerCase().includes(searchTerm.toLowerCase()) || m.village.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredOrders = orders.filter(o => o.produit.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredStock = stock.filter(s => s.produit.toLowerCase().includes(searchTerm.toLowerCase()) || s.acteur.toLowerCase().includes(searchTerm.toLowerCase()));

  // Écran de chargement pour éviter le clignotement de la page de login
  if (authLoading) {
    return <div className="min-h-screen bg-green-50 flex items-center justify-center"><p className="font-bold text-green-700">Chargement de la Coopérative...</p></div>;
  }

  if (!isLoggedIn) {
    return (
        <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8 border border-green-100">
          <div className="flex justify-center mb-6">
            <div className="bg-green-100 p-4 rounded-full"><Sprout size={48} className="text-green-600" /></div>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">CAB Boundiali</h1>
          <p className="text-center text-gray-500 mb-8 font-medium">{authMode === 'register' ? 'Créer un compte administrateur' : 'Connexion à votre espace'}</p>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-3 text-gray-400" size={20} />
              {/* CORRECTION : L'input est maintenant de type email */}
              <input required type="email" placeholder="Adresse e-mail" className="w-full pl-10 p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={credentials.email} onChange={e => setCredentials({...credentials, email: e.target.value})} />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
              {/* Note: Firebase demande un mot de passe d'au moins 6 caractères */}
              <input required type="password" placeholder="Mot de passe (min. 6 car.)" minLength={6} className="w-full pl-10 p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={credentials.password} onChange={e => setCredentials({...credentials, password: e.target.value})} />
            </div>
            <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-green-700">{authMode === 'register' ? "S'inscrire" : "Se Connecter"}</button>
          </form>
          <p className="text-center mt-6 text-sm text-gray-600"><button onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')} className="text-green-600 font-bold hover:underline">{authMode === 'register' ? "Déjà un compte ? Connectez-vous" : "Inscrivez-vous ici"}</button></p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-green-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 flex justify-between items-center">
          <div>
            <p className="text-green-200 text-sm font-medium">Coopérative Agricole</p>
            <h1 className="text-2xl md:text-3xl font-bold">CAB - Boundiali</h1>
          </div>
          {/* CORRECTION : Utilisation de handleLogout */}
          <button title="Déconnexion" onClick={handleLogout} className="bg-red-500 p-2 rounded-lg hover:bg-red-600 transition flex items-center gap-2 text-sm font-bold"><LogOut size={16} /><span className="hidden md:inline">Déconnexion</span></button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 mt-6">
        <div className="hidden md:flex bg-white rounded-xl shadow-sm mb-6 p-2 border border-gray-100 overflow-x-auto">
          <button onClick={() => setActiveTab('overview')} className={`flex-1 min-w-[120px] py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 ${activeTab === 'overview' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}><TrendingUp size={18}/> Général</button>
          <button onClick={() => setActiveTab('members')} className={`flex-1 min-w-[120px] py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 ${activeTab === 'members' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}><Users size={18}/> Membres</button>
          <button onClick={() => setActiveTab('stock')} className={`flex-1 min-w-[120px] py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 ${activeTab === 'stock' ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-50'}`}><Package size={18}/> Magasin</button>
          <button onClick={() => setActiveTab('orders')} className={`flex-1 min-w-[120px] py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 ${activeTab === 'orders' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}><ShoppingCart size={18}/> Commandes</button>
          <button onClick={() => setActiveTab('map')} className={`flex-1 min-w-[120px] py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 ${activeTab === 'map' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}><MapIcon size={18}/> Carte</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            {activeTab === 'overview' && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"><Users className="text-blue-600 mb-2" size={32} /><p className="text-3xl font-bold">{members.length}</p><p className="text-xs font-medium text-gray-500">Membres</p></div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"><MapIcon className="text-green-600 mb-2" size={32} /><p className="text-3xl font-bold">{members.reduce((acc, curr) => acc + parseInt(curr.surface || '0'), 0)} <span className="text-lg">ha</span></p><p className="text-xs font-medium text-gray-500">Surface</p></div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"><Package className="text-purple-600 mb-2" size={32} /><p className="text-3xl font-bold">{stock.length}</p><p className="text-xs font-medium text-gray-500">Mouvements Stock</p></div>
              </div>
            )}

            {(activeTab === 'members' || activeTab === 'orders' || activeTab === 'stock') && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <h2 className="text-xl font-bold italic text-gray-800">
                    {activeTab === 'members' ? 'Annuaire' : activeTab === 'orders' ? 'Commandes' : 'Gestion du Magasin'}
                  </h2>
                  <div className="relative flex-1 w-full md:max-w-xs">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input type="text" placeholder="Rechercher..." className="w-full pl-10 pr-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={exportToExcel} className="bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-lg text-sm font-bold hover:bg-green-100 flex items-center gap-2"><FileSpreadsheet size={16} /> Excel</button>
                    <button onClick={exportToPDF} className="bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-100 flex items-center gap-2"><FileText size={16} /> PDF</button>
                    <button onClick={() => setShowForm(true)} className={`${activeTab === 'stock' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'} text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold ml-2`}><Plus size={18} /> Nouveau</button>
                  </div>
                </div>

                {activeTab === 'members' && (
                  <div className="grid gap-4">
                    {filteredMembers.map(m => (
                      <div key={m.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center font-bold text-green-800 shrink-0">{m.nom[0]}</div>
                          <div>
                            <p className="font-bold text-gray-800 flex items-center gap-2">{m.nom} {m.gps && <MapPin size={14} className="text-blue-500" />}</p>
                            <p className="text-xs text-gray-500">{m.village} • {m.culture} ({m.surface} ha)</p>
                            <p className="text-xs font-medium text-green-700 mt-1">Date: {m.date} | Frais: {m.cout} FCFA</p>
                          </div>
                        </div>
                        <button title="Supprimer" onClick={() => deleteDocGen("membres", m.id, setMembers, members)} className="text-red-400 hover:text-red-600 self-end md:self-auto"><Trash2 size={18} /></button>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'stock' && (
                  <div className="grid gap-4">
                    {filteredStock.map(s => (
                      <div key={s.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 gap-4">
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
                        <button title="Supprimer l'opération" onClick={() => deleteDocGen("magasin", s.id, setStock, stock)} className="text-red-400 hover:text-red-600 self-end md:self-auto"><Trash2 size={18} /></button>
                      </div>
                    ))}
                    {filteredStock.length === 0 && <p className="text-center text-gray-500">Le magasin est vide.</p>}
                  </div>
                )}

                {activeTab === 'orders' && (
                  <div className="grid gap-4">
                    {filteredOrders.map(o => (
                      <div key={o.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 gap-4">
                        <div>
                          <p className="font-bold text-gray-800">{o.produit} <span className="text-sm font-normal text-gray-500">({o.qte})</span></p>
                          <p className="text-xs font-medium text-blue-700 mt-1">Date: {o.date} | Coût: {o.cout} FCFA</p>
                          <div className="flex items-center gap-2 text-xs font-bold text-green-600 mt-1"><Clock size={14} /> {o.statut}</div>
                        </div>
                        <button title="Supprimer" onClick={() => deleteDocGen("commandes", o.id, setOrders, orders)} className="text-red-400 hover:text-red-600 self-end md:self-auto"><Trash2 size={18} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'map' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-[500px] flex flex-col">
                <h2 className="text-xl font-bold italic mb-4 flex items-center gap-2 text-gray-800"><MapIcon className="text-green-600" /> Carte des Parcelles</h2>
                <div className="flex-1 rounded-xl overflow-hidden border border-gray-200 z-0">
                  <MapContainer center={[9.5222, -6.4869]} zoom={8} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                    {members.filter(m => m.gps).map((m) => (
                      <Marker key={m.id} position={[m.gps!.lat, m.gps!.lng]}>
                        <Popup><strong>{m.nom}</strong><br/>{m.culture} - {m.surface} ha<br/>Inscrit le: {m.date}</Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </div>
            )}
          </div>

          <div className="hidden lg:block space-y-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200">
              <h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2"><CloudRain className="text-blue-600" /> Météo - Bagoué</h3>
              {weather ? (
                <><div className="flex items-center justify-between mb-4"><div><p className="text-4xl font-black text-blue-900">{weather.temp}°C</p><p className="text-sm text-blue-700">Boundiali</p></div>{weather.isSunny ? <Sun size={48} className="text-yellow-500" /> : <CloudRain size={48} className="text-blue-400" />}</div><p className="text-sm text-blue-900 bg-white/60 p-3 rounded-lg">Données satellite en temps réel.</p></>
              ) : (<p className="text-sm text-blue-700">Chargement...</p>)}
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold italic text-gray-800">
                {activeTab === 'members' ? 'Ajouter Membre' : activeTab === 'orders' ? 'Nouvelle Commande' : 'Opération Magasin'}
              </h2>
              <button title="Fermer" onClick={() => setShowForm(false)} className="text-gray-400 bg-gray-100 p-2 rounded-full"><X size={20}/></button>
            </div>

            {activeTab === 'members' && (
              <form onSubmit={addMember} className="space-y-4">
                <input required type="date" title="Date d'inscription" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newMember.date} onChange={e => setNewMember({...newMember, date: e.target.value})} />
                <input required placeholder="Nom complet" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newMember.nom} onChange={e => setNewMember({...newMember, nom: e.target.value})} />
                <input required placeholder="Village" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newMember.village} onChange={e => setNewMember({...newMember, village: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="Culture" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newMember.culture} onChange={e => setNewMember({...newMember, culture: e.target.value})} />
                  <input required type="number" placeholder="Surface (ha)" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newMember.surface} onChange={e => setNewMember({...newMember, surface: e.target.value})} />
                </div>
                <input required type="number" placeholder="Frais d'adhésion (FCFA)" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newMember.cout} onChange={e => setNewMember({...newMember, cout: e.target.value})} />
                
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center justify-between">
                  <div><p className="font-bold text-sm text-blue-800">Position GPS</p><p className="text-blue-600 text-xs">{newMember.gps ? "Capturé" : "Non défini"}</p></div>
                  <button title="Capturer le GPS" type="button" onClick={captureGPS} className="bg-blue-600 text-white p-2 rounded-lg"><Crosshair size={16} /></button>
                </div>
                <button type="submit" className="w-full bg-green-600 text-white py-4 rounded-xl font-bold">Enregistrer</button>
              </form>
            )}

            {activeTab === 'orders' && (
              <form onSubmit={addOrder} className="space-y-4">
                <input required type="date" title="Date de commande" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newOrder.date} onChange={e => setNewOrder({...newOrder, date: e.target.value})} />
                <input required placeholder="Produit demandé" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newOrder.produit} onChange={e => setNewOrder({...newOrder, produit: e.target.value})} />
                <input required placeholder="Quantité" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newOrder.qte} onChange={e => setNewOrder({...newOrder, qte: e.target.value})} />
                <input required type="number" placeholder="Coût estimé (FCFA)" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newOrder.cout} onChange={e => setNewOrder({...newOrder, cout: e.target.value})} />
                <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold">Valider Commande</button>
              </form>
            )}

            {activeTab === 'stock' && (
              <form onSubmit={addStockTransaction} className="space-y-4">
                <select required title="Type d'opération" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none font-bold" value={newStock.type} onChange={e => setNewStock({...newStock, type: e.target.value as 'entree'|'sortie'})}>
                  <option value="entree">Entrée en stock (Fournisseur)</option>
                  <option value="sortie">Sortie de stock (Distribution)</option>
                </select>
                <input required type="date" title="Date de l'opération" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newStock.date} onChange={e => setNewStock({...newStock, date: e.target.value})} />
                <input required placeholder="Nom du Produit" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newStock.produit} onChange={e => setNewStock({...newStock, produit: e.target.value})} />
                <input required placeholder="Quantité (ex: 50 sacs, 10 L)" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newStock.qte} onChange={e => setNewStock({...newStock, qte: e.target.value})} />
                <input required type="number" placeholder="Valeur Total (FCFA)" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newStock.cout} onChange={e => setNewStock({...newStock, cout: e.target.value})} />
                <input required placeholder={newStock.type === 'entree' ? "Nom du Fournisseur" : "Bénéficiaire (Membre)"} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newStock.acteur} onChange={e => setNewStock({...newStock, acteur: e.target.value})} />
                <button type="submit" className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold">Confirmer l'opération</button>
              </form>
            )}
          </div>
        </div>
      )}

      <div className="md:hidden fixed bottom-0 w-full bg-white border-t flex items-center justify-around py-3 px-2 z-[1000] shadow-[0_-5px_15px_rgba(0,0,0,0.1)] overflow-x-auto">
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