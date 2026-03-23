import React, { useState } from 'react';
import { 
  Users, 
  Tractor, 
  Sprout, 
  ShoppingCart, 
  BellRing, 
  TrendingUp, 
  MapPin, 
  Search, 
  ChevronRight,
  Package,
  CheckCircle2,
  Clock
} from 'lucide-react';

// --- 1. DÉFINITION DES TYPES ---
interface CoopStat {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

interface Alert {
  id: number;
  member: string;
  type: string;
  message: string;
  date: string;
}

// --- 2. VRAIES DONNÉES (Simulées) ---
const mockMembers = [
  { id: 1, nom: "Amadou Koné", village: "Kouto", culture: "Coton", surface: "5 ha", statut: "Actif" },
  { id: 2, nom: "Fatouma Sylla", village: "Tengréla", culture: "Anacarde", surface: "12 ha", statut: "Actif" },
  { id: 3, nom: "Seydou Traoré", village: "Boundiali", culture: "Maïs", surface: "3 ha", statut: "En attente" },
  { id: 4, nom: "Mariam Ouattara", village: "Kolia", culture: "Coton", surface: "8 ha", statut: "Actif" },
];

const mockOrders = [
  { id: "CMD-089", produit: "Engrais NPK 15-15-15", qte: "50 sacs", date: "Aujourd'hui", statut: "Livré" },
  { id: "CMD-090", produit: "Semences de Maïs", qte: "20 kg", date: "Hier", statut: "En préparation" },
  { id: "CMD-091", produit: "Produit Phytosanitaire", qte: "10 litres", date: "12 Mars", statut: "En attente" },
];

// --- 3. COMPOSANT PRINCIPAL ---
const CoopDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'orders'>('overview');
  const coopName = "Coopérative Agricole de Boundiali (CAB)";
  
  const stats: CoopStat[] = [
    { title: "Membres Actifs", value: 142, subtitle: "+5 ce mois", icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { title: "Récolte Prévue", value: "850 T", subtitle: "Coton & Anacarde", icon: Sprout, color: "text-green-600", bg: "bg-green-100" },
    { title: "Commandes", value: 24, subtitle: "Intrants en cours", icon: ShoppingCart, color: "text-orange-600", bg: "bg-orange-100" },
    { title: "Matériel", value: 8, subtitle: "Tracteurs dispo.", icon: Tractor, color: "text-purple-600", bg: "bg-purple-100" }
  ];

  const alerts: Alert[] = [
    { id: 1, member: "Zone Nord (Kouto)", type: "Météo", message: "Risque de fortes pluies demain", date: "Il y a 2h" },
    { id: 2, member: "Amadou K.", type: "Paiement", message: "Cotisation annuelle reçue", date: "Il y a 5h" },
  ];

  // --- VUE: GÉNÉRAL (L'accueil) ---
  const renderOverview = () => (
    <>
      <div className="grid grid-cols-2 gap-4 mb-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stat.bg} ${stat.color} mb-3`}>
              <stat.icon size={20} />
            </div>
            <h3 className="text-2xl font-bold text-gray-800">{stat.value}</h3>
            <p className="text-sm font-medium text-gray-600">{stat.title}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.subtitle}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-800">Alertes Récentes</h2>
          <button className="text-green-600 text-sm font-medium">Voir tout</button>
        </div>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{alert.type} • {alert.member}</p>
                  <p className="text-xs text-gray-500">{alert.message}</p>
                </div>
              </div>
              <span className="text-xs text-gray-400">{alert.date}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  // --- VUE: MEMBRES ---
  const renderMembers = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Annuaire des Membres</h2>
      <div className="space-y-4">
        {mockMembers.map((member) => (
          <div key={member.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">
                {member.nom.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">{member.nom}</p>
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                  <MapPin size={12} /> {member.village} • {member.culture} ({member.surface})
                </div>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>
        ))}
      </div>
    </div>
  );

  // --- VUE: COMMANDES ---
  const renderOrders = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Suivi des Intrants</h2>
      <div className="space-y-4">
        {mockOrders.map((order) => (
          <div key={order.id} className="p-4 border border-gray-100 rounded-xl">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-blue-500" />
                <span className="text-sm font-bold text-gray-800">{order.id}</span>
              </div>
              <span className="text-xs font-medium text-gray-500">{order.date}</span>
            </div>
            <p className="text-sm text-gray-800 mb-1">{order.produit}</p>
            <p className="text-xs text-gray-500 mb-3">Quantité: {order.qte}</p>
            <div className="flex items-center gap-1">
              {order.statut === "Livré" ? <CheckCircle2 size={14} className="text-green-500" /> : <Clock size={14} className="text-orange-500" />}
              <span className={`text-xs font-bold ${order.statut === "Livré" ? "text-green-600" : "text-orange-600"}`}>
                {order.statut}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full relative bg-gray-50 max-w-md mx-auto shadow-2xl overflow-hidden">
      
      {/* Header fixe */}
      <div className="bg-green-700 text-white px-6 pt-12 pb-6 rounded-b-3xl shadow-lg z-10">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-green-200 text-sm font-medium mb-1">Espace Adhérent</p>
            <h1 className="text-xl font-bold">{coopName}</h1>
          </div>
          <div className="relative">
            <div className="bg-green-600 p-2 rounded-full">
              <BellRing size={20} className="text-white" />
            </div>
            <span className="absolute -top-1 -right-1 bg-red-500 w-3 h-3 rounded-full border-2 border-green-700"></span>
          </div>
        </div>
      </div>

      {/* Contenu dynamique au centre */}
      <div className="flex-1 overflow-y-auto px-4 -mt-4 pt-8 pb-24 z-0">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'members' && renderMembers()}
        {activeTab === 'orders' && renderOrders()}
      </div>

      {/* Barre de navigation fixe en bas */}
      <div className="absolute bottom-0 w-full bg-white border-t border-gray-200 px-6 py-3 flex justify-between items-center z-50">
        <button onClick={() => setActiveTab('overview')} className={`flex flex-col items-center transition-colors ${activeTab === 'overview' ? 'text-green-600' : 'text-gray-400 hover:text-green-500'}`}>
          <TrendingUp size={24} className={activeTab === 'overview' ? 'drop-shadow-md' : ''} />
          <span className="text-[10px] font-bold mt-1">Général</span>
        </button>
        <button onClick={() => setActiveTab('members')} className={`flex flex-col items-center transition-colors ${activeTab === 'members' ? 'text-green-600' : 'text-gray-400 hover:text-green-500'}`}>
          <Users size={24} />
          <span className="text-[10px] font-bold mt-1">Membres</span>
        </button>
        <div className="relative -top-5">
          <button className="bg-green-600 text-white p-4 rounded-full shadow-xl flex items-center justify-center border-4 border-gray-50 hover:bg-green-700 transition">
            <Search size={24} />
          </button>
        </div>
        <button onClick={() => setActiveTab('orders')} className={`flex flex-col items-center transition-colors ${activeTab === 'orders' ? 'text-green-600' : 'text-gray-400 hover:text-green-500'}`}>
          <ShoppingCart size={24} />
          <span className="text-[10px] font-bold mt-1">Commandes</span>
        </button>
      </div>
    </div>
  );
};

export default CoopDashboard;