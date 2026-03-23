import React, { useState } from 'react';
import { 
  Users, 
  Sprout, 
  ShoppingCart, 
  BellRing, 
  TrendingUp, 
  Clock, 
  Plus, 
  X 
} from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'orders'>('overview');
  const [showForm, setShowForm] = useState<boolean>(false);
  
  // --- ÉTATS POUR LES DONNÉES (Saisie en direct) ---
  const [members, setMembers] = useState<Member[]>([
    { id: 1, nom: "Amadou Koné", village: "Kouto", culture: "Coton", surface: "5 ha", statut: "Actif" },
    { id: 2, nom: "Fatouma Sylla", village: "Tengréla", culture: "Anacarde", surface: "12 ha", statut: "Actif" }
  ]);

  const [orders, setOrders] = useState<Order[]>([
    { id: "CMD-089", produit: "Engrais NPK", qte: "50 sacs", date: "23 Mars", statut: "Livré" }
  ]);

  // --- ÉTATS POUR LES FORMULAIRES ---
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
      ...newOrder, 
      id: `CMD-${Math.floor(Math.random()*1000)}`, 
      date: "Aujourd'hui", 
      statut: "En attente" 
    };
    setOrders([order, ...orders]);
    setNewOrder({ produit: '', qte: '' });
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* HEADER RESPONSIVE */}
      <div className="bg-green-700 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-8 md:py-12 flex justify-between items-center">
          <div>
            <p className="text-green-200 text-sm font-medium">Coopérative Agricole de Boundiali</p>
            <h1 className="text-2xl md:text-4xl font-bold">Tableau de Bord Administratif</h1>
          </div>
          <button className="bg-green-600 p-3 rounded-full hover:bg-green-500 transition">
            <BellRing size={24} />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 -mt-8">
        {/* NAVIGATION TABLETTE/PC (Haut) */}
        <div className="hidden md:flex bg-white rounded-xl shadow-sm mb-8 p-2 border border-gray-100">
          <button onClick={() => setActiveTab('overview')} className={`flex-1 py-3 rounded-lg font-bold transition ${activeTab === 'overview' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}>Vue Générale</button>
          <button onClick={() => setActiveTab('members')} className={`flex-1 py-3 rounded-lg font-bold transition ${activeTab === 'members' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}>Membres</button>
          <button onClick={() => setActiveTab('orders')} className={`flex-1 py-3 rounded-lg font-bold transition ${activeTab === 'orders' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}>Commandes</button>
        </div>

        {/* CONTENU DYNAMIQUE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Colonne Principale (S'adapte selon l'onglet) */}
          <div className="md:col-span-2 space-y-6">
            
            {activeTab === 'overview' && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <Users className="text-blue-600 mb-2" />
                  <p className="text-3xl font-bold">{members.length}</p>
                  <p className="text-sm text-gray-500">Membres</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <ShoppingCart className="text-orange-600 mb-2" />
                  <p className="text-3xl font-bold">{orders.length}</p>
                  <p className="text-sm text-gray-500">Commandes</p>
                </div>
              </div>
            )}

            {activeTab === 'members' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold italic">Liste des Membres</h2>
                  <button onClick={() => setShowForm(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700">
                    <Plus size={18} /> Nouveau Membre
                  </button>
                </div>
                <div className="grid gap-4">
                  {members.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center font-bold text-green-800">{m.nom[0]}</div>
                        <div>
                          <p className="font-bold">{m.nom}</p>
                          <p className="text-sm text-gray-500">{m.village} • {m.culture}</p>
                        </div>
                      </div>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">{m.statut}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold italic">Commandes d'Intrants</h2>
                  <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
                    <Plus size={18} /> Nouvelle Commande
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {orders.map(o => (
                    <div key={o.id} className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                      <div className="flex justify-between mb-2 italic">
                        <span className="font-bold text-blue-600">{o.id}</span>
                        <span className="text-xs text-gray-400">{o.date}</span>
                      </div>
                      <p className="font-medium">{o.produit}</p>
                      <p className="text-sm text-gray-500 mb-2">Quantité : {o.qte}</p>
                      <div className="flex items-center gap-2 text-xs font-bold text-orange-600">
                        <Clock size={14} /> {o.statut}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Colonne Latérale (Visible sur PC) */}
          <div className="hidden md:block space-y-6 italic">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Sprout className="text-green-600" /> Infos Récolte
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                La campagne cotonnière à Boundiali prévoit une hausse de 12% cette année grâce aux pluies précoces.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE SAISIE (Formulaire) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold italic">
                {activeTab === 'members' ? 'Ajouter un Membre' : 'Nouvelle Commande'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X /></button>
            </div>

            {activeTab === 'members' ? (
              <form onSubmit={addMember} className="space-y-4">
                <input required placeholder="Nom complet" className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-green-500" value={newMember.nom} onChange={e => setNewMember({...newMember, nom: e.target.value})} />
                <input required placeholder="Village" className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-green-500" value={newMember.village} onChange={e => setNewMember({...newMember, village: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="Culture" className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-green-500" value={newMember.culture} onChange={e => setNewMember({...newMember, culture: e.target.value})} />
                  <input required placeholder="Surface (ha)" className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-green-500" value={newMember.surface} onChange={e => setNewMember({...newMember, surface: e.target.value})} />
                </div>
                <button type="submit" className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-green-700 transition">Enregistrer le Membre</button>
              </form>
            ) : (
              <form onSubmit={addOrder} className="space-y-4">
                <input required placeholder="Nom de l'intrant (ex: Engrais)" className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-blue-500" value={newOrder.produit} onChange={e => setNewOrder({...newOrder, produit: e.target.value})} />
                <input required placeholder="Quantité (ex: 10 sacs)" className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-blue-500" value={newOrder.qte} onChange={e => setNewOrder({...newOrder, qte: e.target.value})} />
                <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition">Valider la Commande</button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* NAVIGATION MOBILE (Fixe en bas) */}
      <div className="md:hidden fixed bottom-0 w-full bg-white border-t px-6 py-3 flex justify-between items-center z-50">
        <button onClick={() => setActiveTab('overview')} className={`flex flex-col items-center ${activeTab === 'overview' ? 'text-green-600' : 'text-gray-400'}`}>
          <TrendingUp size={24} /><span className="text-[10px] font-bold">Général</span>
        </button>
        <button onClick={() => setActiveTab('members')} className={`flex flex-col items-center ${activeTab === 'members' ? 'text-green-600' : 'text-gray-400'}`}>
          <Users size={24} /><span className="text-[10px] font-bold">Membres</span>
        </button>
        <button onClick={() => setActiveTab('orders')} className={`flex flex-col items-center ${activeTab === 'orders' ? 'text-green-600' : 'text-gray-400'}`}>
          <ShoppingCart size={24} /><span className="text-[10px] font-bold">Commandes</span>
        </button>
      </div>
    </div>
  );
};

export default CoopDashboard;