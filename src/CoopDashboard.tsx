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
  ChevronRight 
} from 'lucide-react';

// --- 1. DÉFINITION DES TYPES (La puissance de TypeScript) ---
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
  type: 'Météo' | 'Santé Plante' | 'Paiement';
  message: string;
  date: string;
}

// --- 2. COMPOSANT PRINCIPAL ---
const CoopDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'orders'>('overview');

  // Fausse base de données pour visualiser l'interface
  const coopName = "Coopérative Agricole de Boundiali (CAB)";
  
  const stats: CoopStat[] = [
    { title: "Membres Actifs", value: 142, subtitle: "+5 ce mois", icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { title: "Surface Totale", value: "350 Ha", subtitle: "Maïs, Coton, Anacarde", icon: Tractor, color: "text-green-600", bg: "bg-green-100" },
    { title: "Prévision Récolte", value: "850 T", subtitle: "Campagne 2026", icon: TrendingUp, color: "text-orange-600", bg: "bg-orange-100" },
    { title: "Commandes Groupées", value: "2.4M F", subtitle: "Engrais & Semences", icon: ShoppingCart, color: "text-purple-600", bg: "bg-purple-100" }
  ];

  const recentAlerts: Alert[] = [
    { id: 1, member: "Mamadou Koné", type: "Santé Plante", message: "Baisse de NDVI détectée sur la parcelle Maïs (Chenilles possibles).", date: "Aujourd'hui, 08:30" },
    { id: 2, member: "Awa Traoré", type: "Météo", message: "Risque d'inondation sur les parcelles en bordure de rivière.", date: "Hier, 14:15" }
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      
      {/* EN-TÊTE DE LA COOPÉRATIVE */}
      <div className="bg-gradient-to-r from-green-700 to-green-600 p-6 pb-8 rounded-b-[40px] text-white shadow-lg flex-shrink-0">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
              <Sprout size={28} className="text-white" />
            </div>
            <div>
              <p className="text-green-100 text-xs font-bold uppercase tracking-wider">Espace Gestionnaire</p>
              <h1 className="text-xl font-black truncate max-w-[200px]">{coopName}</h1>
            </div>
          </div>
          <button className="relative p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
            <BellRing size={24} />
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-green-600 rounded-full"></span>
          </button>
        </div>

        {/* BARRE DE RECHERCHE GLOBALE */}
        <div className="relative">
          <input 
            type="text" 
            placeholder="Rechercher un membre, une parcelle..." 
            className="w-full bg-white/20 border border-white/30 text-white placeholder-white/70 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-white focus:bg-white focus:text-gray-800 focus:placeholder-gray-400 transition-all shadow-inner"
          />
          <Search size={20} className="absolute left-4 top-3.5 text-white/70" />
        </div>
      </div>

      {/* CONTENU DÉFILANT */}
      <div className="flex-grow overflow-y-auto p-4 -mt-4 z-10 space-y-6 pb-24">
        
        {/* GRILLE DES STATISTIQUES */}
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex justify-between items-start mb-2">
                <div className={`p-2 rounded-xl ${stat.bg}`}>
                  <stat.icon size={20} className={stat.color} />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-gray-800">{stat.value}</h3>
                <p className="text-xs font-bold text-gray-800 mt-1">{stat.title}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{stat.subtitle}</p>
              </div>
            </div>
          ))}
        </div>

        {/* SECTION : ALERTES DES MEMBRES */}
        <div>
          <div className="flex justify-between items-center mb-4 px-1">
            <h2 className="text-lg font-black text-gray-800 flex items-center">
              <BellRing className="mr-2 text-red-500" size={20}/> Urgences Terrains
            </h2>
            <button className="text-green-600 text-sm font-bold hover:underline">Voir tout</button>
          </div>
          
          <div className="space-y-3">
            {recentAlerts.map(alert => (
              <div key={alert.id} className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-red-500 flex items-start space-x-3">
                <div className="bg-red-50 p-2 rounded-full flex-shrink-0">
                  <MapPin size={18} className="text-red-500" />
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-sm text-gray-800">{alert.member}</h4>
                    <span className="text-[10px] text-gray-400">{alert.date}</span>
                  </div>
                  <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded my-1">
                    {alert.type}
                  </span>
                  <p className="text-xs text-gray-600 leading-tight">{alert.message}</p>
                </div>
                <ChevronRight size={16} className="text-gray-400 self-center" />
              </div>
            ))}
          </div>
        </div>

        {/* SECTION : ACTIONS RAPIDES */}
        <div>
          <h2 className="text-lg font-black text-gray-800 mb-4 px-1">Actions Rapides</h2>
          <div className="grid grid-cols-2 gap-3">
            <button className="bg-green-50 border border-green-100 p-4 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-green-100 transition-colors">
              <div className="bg-white p-2 rounded-full shadow-sm mb-2">
                <Users size={20} className="text-green-600" />
              </div>
              <span className="text-xs font-bold text-green-800">Ajouter un membre</span>
            </button>
            <button className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-orange-100 transition-colors">
              <div className="bg-white p-2 rounded-full shadow-sm mb-2">
                <ShoppingCart size={20} className="text-orange-600" />
              </div>
              <span className="text-xs font-bold text-orange-800">Lancer une commande</span>
            </button>
          </div>
        </div>

      </div>

      {/* MENU DE NAVIGATION BAS (STYLE COOPÉRATIVE) */}
      <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 px-6 py-3 flex justify-between items-center z-50 pb-safe">
        <button onClick={() => setActiveTab('overview')} className={`flex flex-col items-center ${activeTab === 'overview' ? 'text-green-600' : 'text-gray-400'}`}>
          <TrendingUp size={24} className={activeTab === 'overview' ? 'drop-shadow-md' : ''} />
          <span className="text-[10px] font-bold mt-1">Général</span>
        </button>
        <button onClick={() => setActiveTab('members')} className={`flex flex-col items-center ${activeTab === 'members' ? 'text-green-600' : 'text-gray-400'}`}>
          <Users size={24} />
          <span className="text-[10px] font-bold mt-1">Membres</span>
        </button>
        <div className="relative -top-5">
          <button className="bg-green-600 text-white p-4 rounded-full shadow-xl flex items-center justify-center border-4 border-gray-50">
            <Search size={24} />
          </button>
        </div>
        <button onClick={() => setActiveTab('orders')} className={`flex flex-col items-center ${activeTab === 'orders' ? 'text-green-600' : 'text-gray-400'}`}>
          <ShoppingCart size={24} />
          <span className="text-[10px] font-bold mt-1">Commandes</span>
        </button>
        <button className="flex flex-col items-center text-gray-400">
          <BellRing size={24} />
          <span className="text-[10px] font-bold mt-1">Message</span>
        </button>
      </div>

    </div>
  );
};

export default CoopDashboard;