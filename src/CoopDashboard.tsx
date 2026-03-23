import React, { useState, useEffect } from 'react';
import { 
  Users, Sprout, ShoppingCart, TrendingUp, Search,
  Clock, Plus, X, FileSpreadsheet, FileText, 
  Map as MapIcon, CloudRain, Sun, MapPin, Trash2, Crosshair, LogOut, Lock, User
} from 'lucide-react';

// --- IMPORTATIONS EXPORT ---
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 

// --- IMPORTATIONS CARTE (LEAFLET) ---
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Correction de l'icône par défaut de Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// --- 1. CONFIGURATION FIREBASE ---
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // Remplacez ces valeurs par celles de votre compte Firebase
  apiKey: "VOTRE_API_KEY",
  authDomain: "votre-projet.firebaseapp.com",
  projectId: "votre-projet",
  storageBucket: "votre-projet.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

// L'astuce "export" empêche TypeScript de dire que ce n'est pas utilisé !
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// --- TYPES ---
interface Member {
  id: number;
  nom: string;
  village: string;
  culture: string;
  surface: string;
  statut: string;
  gps?: { lat: number; lng: number }; 
}

interface Order {
  id: string;
  produit: string;
  qte: string;
  date: string;
  statut: string;
}

const CoopDashboard: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [registeredUser, setRegisteredUser] = useState({ username: 'admin', password: '123' }); 

  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'orders' | 'map'>('overview');
  const [showForm, setShowForm] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [weather, setWeather] = useState<{ temp: number, isSunny: boolean } | null>(null);

  const [members, setMembers] = useState<Member[]>([
    { id: 1, nom: "Amadou Koné", village: "Kouto", culture: "Coton", surface: "5", statut: "Actif", gps: { lat: 9.88, lng: -6.41 } },
    { id: 2, nom: "Fatouma Sylla", village: "Tengréla", culture: "Anacarde", surface: "12", statut: "Actif", gps: { lat: 10.48, lng: -6.40 } }
  ]);

  const [orders, setOrders] = useState<Order[]>([
    { id: "CMD-089", produit: "Engrais NPK", qte: "50 sacs", date: "Aujourd'hui", statut: "Livré" }
  ]);

  const [newMember, setNewMember] = useState<Partial<Member>>({ nom: '', village: '', culture: '', surface: '' });
  const [newOrder, setNewOrder] = useState({ produit: '', qte: '' });

  useEffect(() => {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=9.5222&longitude=-6.4869&current_weather=true")
      .then(res => res.json())
      .then(data => {
        setWeather({ temp: data.current_weather.temperature, isSunny: data.current_weather.weathercode < 3 });
      })
      .catch(err => console.log("Erreur météo", err));
  }, []);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'register') {
      setRegisteredUser({ username: credentials.username, password: credentials.password });
      alert("Inscription réussie ! Vous pouvez vous connecter.");
      setAuthMode('login');
      setCredentials({ username: '', password: '' });
    } else {
      if (credentials.username === registeredUser.username && credentials.password === registeredUser.password) {
        setIsLoggedIn(true);
      } else {
        alert("Login ou mot de passe incorrect !");
      }
    }
  };

  const addMember = (e: React.FormEvent) => {
    e.preventDefault();
    const member = { ...newMember, id: Date.now(), statut: "Actif" } as Member;
    setMembers([member, ...members]);
    setNewMember({ nom: '', village: '', culture: '', surface: '' });
    setShowForm(false);
  };

  const deleteMember = (id: number) => {
    if(window.confirm("Supprimer ce membre ?")) setMembers(members.filter(m => m.id !== id));
  };

  const addOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const order: Order = { ...newOrder, id: `CMD-${Math.floor(Math.random()*1000)}`, date: "Aujourd'hui", statut: "En attente" };
    setOrders([order, ...orders]);
    setNewOrder({ produit: '', qte: '' });
    setShowForm(false);
  };

  const deleteOrder = (id: string) => {
    if(window.confirm("Supprimer cette commande ?")) setOrders(orders.filter(o => o.id !== id));
  };

  const captureGPS = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setNewMember({ ...newMember, gps: { lat: position.coords.latitude, lng: position.coords.longitude } });
          alert("Position GPS capturée !");
        },
        () => alert("Erreur GPS: Veuillez autoriser la localisation.")
      );
    }
  };

  // --- FONCTIONS D'EXPORTATION RESTAURÉES ---
  const exportToExcel = () => {
    const dataToExport = activeTab === 'members' 
      ? members.map(m => ({ Nom: m.nom, Village: m.village, Culture: m.culture, Surface: `${m.surface} ha`, Statut: m.statut, GPS: m.gps ? `${m.gps.lat}, ${m.gps.lng}` : 'Non défini' }))
      : orders;
    const fileName = activeTab === 'members' ? 'Liste_Membres_CAB.xlsx' : 'Liste_Commandes_CAB.xlsx';
    
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Données");
    XLSX.writeFile(workbook, fileName);
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      const title = activeTab === 'members' ? 'ANNUAIRE DES MEMBRES - CAB' : 'SUIVI DES COMMANDES - CAB';
      const fileName = activeTab === 'members' ? 'Rapport_Membres.pdf' : 'Rapport_Commandes.pdf';

      doc.setFontSize(16);
      doc.text(title, 14, 15);
      doc.setFontSize(10);
      doc.text("Coopérative Agricole de Boundiali (Région de la Bagoué)", 14, 22);
      
      const tableData = activeTab === 'members' 
        ? members.map(m => [m.nom, m.village, m.culture, `${m.surface} ha`, m.statut])
        : orders.map(o => [o.id, o.produit, o.qte, o.date, o.statut]);

      const tableHeaders = activeTab === 'members'
        ? [["Nom", "Village", "Culture", "Surface", "Statut"]]
        : [["ID", "Produit", "Quantité", "Date", "Statut"]];

      autoTable(doc, {
        head: tableHeaders,
        body: tableData,
        startY: 30,
        theme: 'grid',
        headStyles: { fillColor: [22, 163, 74] } 
      });

      doc.save(fileName);
    } catch (err) {
      console.error("Erreur PDF", err);
      alert("Erreur lors de la création du PDF.");
    }
  };

  const filteredMembers = members.filter(m => 
    m.nom.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.village.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOrders = orders.filter(o => 
    o.produit.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isLoggedIn) {
    return (
        <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8 border border-green-100">
          <div className="flex justify-center mb-6">
            <div className="bg-green-100 p-4 rounded-full"><Sprout size={48} className="text-green-600" /></div>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">CAB Boundiali</h1>
          <p className="text-center text-gray-500 mb-8 font-medium">
            {authMode === 'register' ? 'Créez votre compte administrateur' : 'Connectez-vous à votre espace'}
          </p>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-3 text-gray-400" size={20} />
              <input required type="text" placeholder="Nom d'utilisateur" className="w-full pl-10 p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none" 
                value={credentials.username} onChange={e => setCredentials({...credentials, username: e.target.value})} />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
              <input required type="password" placeholder="Mot de passe" className="w-full pl-10 p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none" 
                value={credentials.password} onChange={e => setCredentials({...credentials, password: e.target.value})} />
            </div>
            <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-green-700 transition">
              {authMode === 'register' ? "S'inscrire" : "Se Connecter"}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-gray-600">
            {authMode === 'register' ? "Déjà un compte ? " : "Pas encore de compte ? "}
            <button onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')} className="text-green-600 font-bold hover:underline">
              {authMode === 'register' ? "Connectez-vous" : "Inscrivez-vous"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-green-700 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-8 flex justify-between items-center">
          <div>
            <p className="text-green-200 text-sm font-medium">Coopérative Agricole de Boundiali</p>
            <h1 className="text-2xl md:text-3xl font-bold">Tableau de Bord Administratif</h1>
          </div>
          <button onClick={() => setIsLoggedIn(false)} className="bg-red-500 p-2 rounded-lg hover:bg-red-600 transition flex items-center gap-2 text-sm font-bold">
            <LogOut size={16} /> <span className="hidden md:inline">Déconnexion</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 mt-6">
        <div className="hidden md:flex bg-white rounded-xl shadow-sm mb-6 p-2 border border-gray-100">
          <button onClick={() => setActiveTab('overview')} className={`flex-1 py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 ${activeTab === 'overview' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}><TrendingUp size={18}/> Vue Générale</button>
          <button onClick={() => setActiveTab('members')} className={`flex-1 py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 ${activeTab === 'members' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}><Users size={18}/> Membres</button>
          <button onClick={() => setActiveTab('orders')} className={`flex-1 py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 ${activeTab === 'orders' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}><ShoppingCart size={18}/> Commandes</button>
          <button onClick={() => setActiveTab('map')} className={`flex-1 py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 ${activeTab === 'map' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}><MapIcon size={18}/> Carte</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            
            {activeTab === 'overview' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <Users className="text-blue-600 mb-2" size={32} />
                  <p className="text-4xl font-bold text-gray-800">{members.length}</p>
                  <p className="text-sm font-medium text-gray-500 mt-1">Agriculteurs actifs</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <MapIcon className="text-green-600 mb-2" size={32} />
                  <p className="text-4xl font-bold text-gray-800">
                    {members.reduce((acc, curr) => acc + parseInt(curr.surface || '0'), 0)} <span className="text-xl">ha</span>
                  </p>
                  <p className="text-sm font-medium text-gray-500 mt-1">Surface totale cultivée</p>
                </div>
              </div>
            )}

            {(activeTab === 'members' || activeTab === 'orders') && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <h2 className="text-xl font-bold italic text-gray-800">
                    {activeTab === 'members' ? 'Annuaire' : 'Commandes'}
                  </h2>
                  
                  <div className="relative flex-1 md:max-w-xs">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Rechercher..." 
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  {/* BOUTONS D'EXPORTATION RESTAURÉS */}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={exportToExcel} className="bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-lg text-sm font-bold hover:bg-green-100 transition flex items-center gap-2">
                      <FileSpreadsheet size={16} /> Excel
                    </button>
                    <button onClick={exportToPDF} className="bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-100 transition flex items-center gap-2">
                      <FileText size={16} /> PDF
                    </button>
                    <button onClick={() => setShowForm(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 font-bold ml-2">
                      <Plus size={18} /> Nouveau
                    </button>
                  </div>
                </div>

                {activeTab === 'members' && (
                  <div className="grid gap-4">
                    {filteredMembers.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center font-bold text-green-800">{m.nom[0]}</div>
                          <div>
                            <p className="font-bold text-gray-800 flex items-center gap-2">{m.nom} {m.gps && <span title="GPS Enregistré"><MapPin size={14} className="text-blue-500" /></span>}</p>
                            <p className="text-sm text-gray-500">{m.village} • {m.culture} ({m.surface} ha)</p>
                          </div>
                        </div>
                        <button onClick={() => deleteMember(m.id)} className="text-red-400 hover:text-red-600"><Trash2 size={18} /></button>
                      </div>
                    ))}
                    {filteredMembers.length === 0 && <p className="text-center text-gray-500 py-4">Aucun résultat trouvé.</p>}
                  </div>
                )}

                {activeTab === 'orders' && (
                  <div className="grid grid-cols-1 gap-4">
                    {filteredOrders.map(o => (
                      <div key={o.id} className="p-4 border border-gray-100 rounded-xl bg-gray-50 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-800">{o.produit} <span className="text-sm text-gray-500">({o.qte})</span></p>
                          <p className="text-xs text-blue-600 font-bold mb-1">{o.id}</p>
                          {/* ICÔNE HORLOGE RESTAURÉE */}
                          <div className="flex items-center gap-2 text-xs font-bold text-green-600 mt-1">
                            <Clock size={14} /> {o.statut} • {o.date}
                          </div>
                        </div>
                        <button onClick={() => deleteOrder(o.id)} className="text-red-400 hover:text-red-600"><Trash2 size={18} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'map' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col h-[500px]">
                <h2 className="text-xl font-bold italic mb-4 flex items-center gap-2 text-gray-800">
                  <MapIcon className="text-green-600" /> Carte Interactive (Région des Savanes)
                </h2>
                <div className="flex-1 rounded-xl overflow-hidden border border-gray-200 z-0">
                  <MapContainer center={[9.5222, -6.4869]} zoom={8} style={{ height: '100%', width: '100%' }}>
                    <TileLayer 
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    {members.filter(m => m.gps).map((m) => (
                      <Marker key={m.id} position={[m.gps!.lat, m.gps!.lng]}>
                        <Popup>
                          <strong>{m.nom}</strong><br/>
                          {m.culture} - {m.surface} ha<br/>
                          Village: {m.village}
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </div>
            )}
          </div>

          <div className="hidden md:block space-y-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200">
              <h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2"><CloudRain className="text-blue-600" /> Météo en direct</h3>
              {weather ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-4xl font-black text-blue-900">{weather.temp}°C</p>
                      <p className="text-sm text-blue-700">Boundiali</p>
                    </div>
                    {weather.isSunny ? <Sun size={48} className="text-yellow-500" /> : <CloudRain size={48} className="text-blue-400" />}
                  </div>
                  <p className="text-sm text-blue-900 bg-white/60 p-3 rounded-lg">
                    {weather.isSunny ? "Ciel plutôt dégagé." : "Risque de précipitations."} Données actualisées en temps réel.
                  </p>
                </>
              ) : (
                <p className="text-sm text-blue-700">Chargement de la météo...</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold italic text-gray-800">{activeTab === 'members' ? 'Ajouter' : 'Commande'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 bg-gray-100 p-2 rounded-full"><X size={20}/></button>
            </div>
            {activeTab === 'members' ? (
              <form onSubmit={addMember} className="space-y-4">
                <input required placeholder="Nom complet" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newMember.nom} onChange={e => setNewMember({...newMember, nom: e.target.value})} />
                <input required placeholder="Village" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newMember.village} onChange={e => setNewMember({...newMember, village: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="Culture" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newMember.culture} onChange={e => setNewMember({...newMember, culture: e.target.value})} />
                  <input required type="number" placeholder="Surface (ha)" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newMember.surface} onChange={e => setNewMember({...newMember, surface: e.target.value})} />
                </div>
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center justify-between">
                  <div className="text-sm">
                    <p className="font-bold text-blue-800">Localisation</p>
                    <p className="text-blue-600 text-xs">{newMember.gps ? "OK" : "Non définie"}</p>
                  </div>
                  <button type="button" onClick={captureGPS} className="bg-blue-600 text-white p-2 rounded-lg font-bold"><Crosshair size={16} /></button>
                </div>
                <button type="submit" className="w-full bg-green-600 text-white py-4 rounded-xl font-bold">Enregistrer</button>
              </form>
            ) : (
              <form onSubmit={addOrder} className="space-y-4">
                <input required placeholder="Produit" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newOrder.produit} onChange={e => setNewOrder({...newOrder, produit: e.target.value})} />
                <input required placeholder="Quantité" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" value={newOrder.qte} onChange={e => setNewOrder({...newOrder, qte: e.target.value})} />
                <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold">Valider</button>
              </form>
            )}
          </div>
        </div>
      )}

      <div className="md:hidden fixed bottom-0 w-full bg-white border-t px-2 py-3 flex justify-between items-center z-[1000]">
        <button onClick={() => setActiveTab('overview')} className={`flex flex-col items-center flex-1 ${activeTab === 'overview' ? 'text-green-600' : 'text-gray-400'}`}>
          <TrendingUp size={20} /><span className="text-[10px] font-bold mt-1">Général</span>
        </button>
        <button onClick={() => setActiveTab('members')} className={`flex flex-col items-center flex-1 ${activeTab === 'members' ? 'text-green-600' : 'text-gray-400'}`}>
          <Users size={20} /><span className="text-[10px] font-bold mt-1">Membres</span>
        </button>
        <button onClick={() => setActiveTab('map')} className={`flex flex-col items-center flex-1 ${activeTab === 'map' ? 'text-green-600' : 'text-gray-400'}`}>
          <MapIcon size={20} /><span className="text-[10px] font-bold mt-1">Carte</span>
        </button>
      </div>
    </div>
  );
};

export default CoopDashboard;