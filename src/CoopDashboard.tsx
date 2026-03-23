import React, { useState } from 'react';
import { 
  Users, Sprout, ShoppingCart, BellRing, TrendingUp, 
  Clock, Plus, X, FileSpreadsheet, FileText, 
  Map as MapIcon, CloudRain, Sun, MapPin
} from 'lucide-react';

// --- IMPORTATIONS POUR L'EXPORTATION ---
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// --- TYPES ---
interface Member {
  id: number;
  nom: string;
  village: string;
  culture: string;
  surface: string;
  statut: string;
}

interface Order {
  id: string;
  produit: string;
  qte: string;
  date: string;
  statut: string;
}

const CoopDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'orders' | 'map'>('overview');
  const [showForm, setShowForm] = useState<boolean>(false);
  
  // --- ÉTATS POUR LES DONNÉES ---
  const [members, setMembers] = useState<Member[]>([
    { id: 1, nom: "Amadou Koné", village: "Kouto", culture: "Coton", surface: "5", statut: "Actif" },
    { id: 2, nom: "Fatouma Sylla", village: "Tengréla", culture: "Anacarde", surface: "12", statut: "Actif" },
    { id: 3, nom: "Seydou Traoré", village: "Boundiali", culture: "Maïs", surface: "3", statut: "En attente" }
  ]);

  const [orders, setOrders] = useState<Order[]>([
    { id: "CMD-089", produit: "Engrais NPK", qte: "50 sacs", date: "Aujourd'hui", statut: "Livré" }
  ]);

  const [newMember, setNewMember] = useState({ nom: '', village: '', culture: '', surface: '' });
  const [newOrder, setNewOrder] = useState({ produit: '', qte: '' });

  // --- FONCTIONS D'AJOUT ---
  const addMember = (e: React.FormEvent) => {
    e.preventDefault();
    const member: Member = { ...newMember, id: Date.now(), statut: "Actif" };
    setMembers([member, ...members]);
    setNewMember({ nom: '', village: '', culture: '', surface: '' });
    setShowForm(false);
  };

  const addOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const order: Order = { 
      ...newOrder, id: `CMD-${Math.floor(Math.random()*1000)}`, date: "Aujourd'hui", statut: "En attente" 
    };
    setOrders([order, ...orders]);
    setNewOrder({ produit: '', qte: '' });
    setShowForm(false);
  };

  // --- FONCTIONS D'EXPORTATION ---
  const exportToExcel = () => {
    const dataToExport = activeTab === 'members' ? members : orders;
    const fileName = activeTab === 'members' ? 'Liste_Membres_CAB.xlsx' : 'Liste_Commandes_CAB.xlsx';
    
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Données");
    XLSX.writeFile(workbook, fileName);
  };

  const exportToPDF = () => {
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

    (doc as any).autoTable({
      head: tableHeaders,
      body: tableData,
      startY: 30,
      theme: 'grid',
      headStyles: { fillStyle: [22, 163, 74] } // Couleur verte Tailwind (green-600)
    });

    doc.save(fileName);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* HEADER */}
      <div className="bg-green-700 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-8 md:py-12 flex justify-between items-center">
          <div>
            <p className="text-green-200 text-sm font-medium">Coopérative Agricole de Boundiali</p>
            <h1 className="text-2xl md:text-4xl font-bold">Tableau de Bord Administratif</h1>
          </div>
          <button className="bg-green-600 p-3 rounded-full hover:bg-green-500 transition relative">
            <BellRing size={24} />
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-green-600"></span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 -mt-8">
        {/* NAVIGATION PC */}
        <div className="hidden md:flex bg-white rounded-xl shadow-sm mb-8 p-2 border border-gray-100">
          <button onClick={() => setActiveTab('overview')} className={`flex-1 py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 ${activeTab === 'overview' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}><TrendingUp size={18}/> Vue Générale</button>
          <button onClick={() => setActiveTab('members')} className={`flex-1 py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 ${activeTab === 'members' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}><Users size={18}/> Membres</button>
          <button onClick={() => setActiveTab('orders')} className={`flex-1 py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 ${activeTab === 'orders' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}><ShoppingCart size={18}/> Commandes</button>
          <button onClick={() => setActiveTab('map')} className={`flex-1 py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 ${activeTab === 'map' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}><MapIcon size={18}/> Carte</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* COLONNE PRINCIPALE */}
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
                {/* En-tête avec les boutons d'export */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <h2 className="text-xl font-bold italic text-gray-800">
                    {activeTab === 'members' ? 'Annuaire des Membres' : 'Suivi des Commandes'}
                  </h2>
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

                {/* Liste des membres */}
                {activeTab === 'members' && (
                  <div className="grid gap-4">
                    {members.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition rounded-xl border border-gray-100">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center font-bold text-green-800 text-lg">{m.nom[0]}</div>
                          <div>
                            <p className="font-bold text-gray-800">{m.nom}</p>
                            <p className="text-sm text-gray-500">{m.village} • {m.culture} ({m.surface} ha)</p>
                          </div>
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full font-bold ${m.statut === 'Actif' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {m.statut}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Liste des commandes */}
                {activeTab === 'orders' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {orders.map(o => (
                      <div key={o.id} className="p-4 border border-gray-100 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                        <div className="flex justify-between mb-2 italic">
                          <span className="font-bold text-blue-600">{o.id}</span>
                          <span className="text-xs text-gray-500">{o.date}</span>
                        </div>
                        <p className="font-bold text-gray-800">{o.produit}</p>
                        <p className="text-sm text-gray-600 mb-3">Quantité : {o.qte}</p>
                        <div className="flex items-center gap-2 text-xs font-bold text-green-600">
                          <Clock size={14} /> {o.statut}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* NOUVEL ONGLET : CARTE DES PARCELLES */}
            {activeTab === 'map' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col h-[500px]">
                <h2 className="text-xl font-bold italic mb-4 flex items-center gap-2 text-gray-800">
                  <MapIcon className="text-green-600" /> Cartographie des Parcelles
                </h2>
                <div className="flex-1 bg-green-50/50 rounded-xl border-2 border-dashed border-green-200 relative overflow-hidden flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                  
                  {/* Marqueurs simulés sur la carte */}
                  <div className="absolute top-1/4 left-1/3 flex flex-col items-center hover:scale-110 transition cursor-pointer group">
                    <MapPin className="text-green-600 drop-shadow-md" size={36} fill="#bbf7d0" />
                    <span className="bg-white px-3 py-1 rounded-lg text-xs font-bold shadow-md mt-1 border border-green-100 group-hover:bg-green-600 group-hover:text-white transition">Amadou K. (5ha)</span>
                  </div>
                  
                  <div className="absolute top-1/2 right-1/4 flex flex-col items-center hover:scale-110 transition cursor-pointer group">
                    <MapPin className="text-orange-600 drop-shadow-md" size={42} fill="#ffedd5" />
                    <span className="bg-white px-3 py-1 rounded-lg text-xs font-bold shadow-md mt-1 border border-orange-100 group-hover:bg-orange-600 group-hover:text-white transition">Fatouma S. (12ha)</span>
                  </div>

                  <div className="absolute bottom-1/3 left-1/4 flex flex-col items-center hover:scale-110 transition cursor-pointer group">
                    <MapPin className="text-blue-600 drop-shadow-md" size={32} fill="#dbeafe" />
                    <span className="bg-white px-3 py-1 rounded-lg text-xs font-bold shadow-md mt-1 border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition">Seydou T. (3ha)</span>
                  </div>

                  <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-sm text-xs font-medium text-gray-600 flex items-center gap-2">
                    <span className="w-3 h-3 bg-green-500 rounded-full inline-block"></span> Coton
                    <span className="w-3 h-3 bg-orange-500 rounded-full inline-block ml-2"></span> Anacarde
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* COLONNE LATÉRALE (MÉTÉO ET INFOS) */}
          <div className="hidden md:block space-y-6">
            
            {/* WIDGET MÉTÉO (Région de la Bagoué) */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl shadow-sm border border-blue-200">
              <h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
                <CloudRain className="text-blue-600" /> Météo - Bagoué
              </h3>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-4xl font-black text-blue-900">32°C</p>
                  <p className="text-sm font-medium text-blue-700 mt-1">Boundiali</p>
                </div>
                <Sun size={48} className="text-yellow-500 drop-shadow-sm" />
              </div>
              <div className="bg-white/60 p-3 rounded-lg text-sm text-blue-900 leading-relaxed border border-blue-100">
                <strong>Prévision :</strong> Ciel dégagé ce matin. Fortes probabilités de pluies isolées dans la soirée. Conditions idéales pour l'épandage d'engrais demain.
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 italic">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Sprout className="text-green-600" /> Infos Agricoles
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                La campagne à Boundiali prévoit une hausse de 12% des rendements grâce aux semences améliorées distribuées le mois dernier.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE SAISIE */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl transform transition-all">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold italic text-gray-800">
                {activeTab === 'members' ? 'Ajouter un Membre' : 'Nouvelle Commande'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-red-500 transition bg-gray-100 p-2 rounded-full"><X size={20}/></button>
            </div>

            {activeTab === 'members' ? (
              <form onSubmit={addMember} className="space-y-4">
                <input required placeholder="Nom complet" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none" value={newMember.nom} onChange={e => setNewMember({...newMember, nom: e.target.value})} />
                <input required placeholder="Village (ex: Kouto, Kolia...)" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none" value={newMember.village} onChange={e => setNewMember({...newMember, village: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="Culture principale" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none" value={newMember.culture} onChange={e => setNewMember({...newMember, culture: e.target.value})} />
                  <input required type="number" placeholder="Surface (ha)" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none" value={newMember.surface} onChange={e => setNewMember({...newMember, surface: e.target.value})} />
                </div>
                <button type="submit" className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-green-700 transition">Enregistrer le Membre</button>
              </form>
            ) : (
              <form onSubmit={addOrder} className="space-y-4">
                <input required placeholder="Nom de l'intrant (ex: Engrais NPK)" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" value={newOrder.produit} onChange={e => setNewOrder({...newOrder, produit: e.target.value})} />
                <input required placeholder="Quantité (ex: 10 sacs)" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none" value={newOrder.qte} onChange={e => setNewOrder({...newOrder, qte: e.target.value})} />
                <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition">Valider la Commande</button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* NAVIGATION MOBILE */}
      <div className="md:hidden fixed bottom-0 w-full bg-white border-t px-2 py-3 flex justify-between items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <button onClick={() => setActiveTab('overview')} className={`flex flex-col items-center flex-1 ${activeTab === 'overview' ? 'text-green-600' : 'text-gray-400'}`}>
          <TrendingUp size={20} /><span className="text-[10px] font-bold mt-1">Général</span>
        </button>
        <button onClick={() => setActiveTab('members')} className={`flex flex-col items-center flex-1 ${activeTab === 'members' ? 'text-green-600' : 'text-gray-400'}`}>
          <Users size={20} /><span className="text-[10px] font-bold mt-1">Membres</span>
        </button>
        <button onClick={() => setActiveTab('orders')} className={`flex flex-col items-center flex-1 ${activeTab === 'orders' ? 'text-green-600' : 'text-gray-400'}`}>
          <ShoppingCart size={20} /><span className="text-[10px] font-bold mt-1">Commandes</span>
        </button>
        <button onClick={() => setActiveTab('map')} className={`flex flex-col items-center flex-1 ${activeTab === 'map' ? 'text-green-600' : 'text-gray-400'}`}>
          <MapIcon size={20} /><span className="text-[10px] font-bold mt-1">Carte</span>
        </button>
      </div>
    </div>
  );
};

export default CoopDashboard;