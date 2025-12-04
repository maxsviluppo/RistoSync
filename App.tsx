import React, { useState, useEffect } from 'react';
import KitchenDisplay from './components/KitchenDisplay';
import WaiterPad from './components/WaiterPad';
import { ChefHat, Smartphone, User, Settings, Database, Bell, Utensils, X, Save, Plus, Trash2, Edit2 } from 'lucide-react';
import { getWaiterName, saveWaiterName, getMenuItems, addMenuItem, updateMenuItem, deleteMenuItem, getNotificationSettings, saveNotificationSettings, NotificationSettings } from './services/storageService';
import { MenuItem, Category } from './types';

const App: React.FC = () => {
  const [role, setRole] = useState<'kitchen' | 'waiter' | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [waiterNameInput, setWaiterNameInput] = useState('');
  
  // Admin State
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState<'db' | 'menu' | 'notif'>('menu');
  
  // Menu Manager State
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<MenuItem>>({});

  // Settings State
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({ kitchenSound: true, waiterSound: true, pushEnabled: false });

  useEffect(() => {
      if (showAdmin) {
          setMenuItems(getMenuItems());
          setNotifSettings(getNotificationSettings());
      }
  }, [showAdmin]);

  const handleWaiterClick = () => {
      const existingName = getWaiterName();
      if (existingName) {
          setRole('waiter');
      } else {
          setShowLogin(true);
      }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (waiterNameInput.trim()) {
          saveWaiterName(waiterNameInput.trim());
          setShowLogin(false);
          setRole('waiter');
      }
  };

  const handleLogout = () => {
      setRole(null);
  };

  // --- ADMIN FUNCTIONS ---
  const handleSaveMenu = () => {
      if (editingItem.name && editingItem.price && editingItem.category) {
          const itemToSave = {
              id: editingItem.id || Date.now().toString(),
              name: editingItem.name,
              price: Number(editingItem.price),
              category: editingItem.category as Category,
              description: editingItem.description || ''
          };
          
          if (editingItem.id) {
              updateMenuItem(itemToSave);
          } else {
              addMenuItem(itemToSave);
          }
          setMenuItems(getMenuItems());
          setIsEditingItem(false);
          setEditingItem({});
      }
  };

  const handleDeleteMenu = (id: string) => {
      if (confirm('Eliminare questo piatto?')) {
          deleteMenuItem(id);
          setMenuItems(getMenuItems());
      }
  };

  const toggleNotif = (key: keyof NotificationSettings) => {
      const newSettings = { ...notifSettings, [key]: !notifSettings[key] };
      setNotifSettings(newSettings);
      saveNotificationSettings(newSettings);
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        
        {/* Admin Toggle */}
        <button 
            onClick={() => setShowAdmin(true)}
            className="absolute top-6 right-6 p-3 rounded-full bg-slate-800 text-slate-500 hover:text-white hover:bg-slate-700 transition-colors z-30"
        >
            <Settings size={24} />
        </button>

        {/* Login Modal */}
        {showLogin && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                <form onSubmit={handleLoginSubmit} className="bg-slate-800 border border-slate-700 p-8 rounded-3xl w-full max-w-sm shadow-2xl animate-slide-up">
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center border-2 border-blue-500">
                            <User size={40} className="text-blue-500" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white text-center mb-2">Chi sei?</h2>
                    <p className="text-slate-400 text-center text-sm mb-6">Inserisci il tuo nome per accedere all'app cameriere.</p>
                    
                    <input 
                        type="text" 
                        value={waiterNameInput}
                        onChange={(e) => setWaiterNameInput(e.target.value)}
                        placeholder="Nome (es. Marco)"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none mb-4 text-center font-bold text-lg"
                        autoFocus
                    />
                    
                    <div className="flex gap-3">
                        <button 
                            type="button" 
                            onClick={() => setShowLogin(false)}
                            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-bold transition-colors"
                        >
                            Annulla
                        </button>
                        <button 
                            type="submit" 
                            disabled={!waiterNameInput.trim()}
                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
                        >
                            Accedi
                        </button>
                    </div>
                </form>
            </div>
        )}

        {/* ADMIN MODAL */}
        {showAdmin && (
            <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col animate-fade-in overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-500 p-2 rounded-lg"><Settings className="text-white"/></div>
                        <h2 className="text-2xl font-bold text-white">Configurazione Sistema</h2>
                    </div>
                    <button onClick={() => setShowAdmin(false)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><X /></button>
                </div>
                
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-64 bg-slate-900 border-r border-slate-800 p-4 space-y-2 hidden md:block">
                         <button onClick={() => setAdminTab('db')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'db' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                             <Database size={20}/> Database
                         </button>
                         <button onClick={() => setAdminTab('menu')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'menu' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                             <Utensils size={20}/> Gestione Menu
                         </button>
                         <button onClick={() => setAdminTab('notif')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'notif' ? 'bg-green-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                             <Bell size={20}/> Notifiche
                         </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
                        
                        {/* Mobile Tabs */}
                        <div className="flex md:hidden gap-2 mb-6 overflow-x-auto pb-2">
                             <button onClick={() => setAdminTab('db')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'db' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Database</button>
                             <button onClick={() => setAdminTab('menu')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'menu' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Menu</button>
                             <button onClick={() => setAdminTab('notif')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'notif' ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Notifiche</button>
                        </div>

                        {/* DB TAB */}
                        {adminTab === 'db' && (
                            <div className="max-w-2xl">
                                <h3 className="text-xl font-bold text-white mb-4">Connessione Cloud (Disabilitata)</h3>
                                <div className="space-y-4 opacity-50 pointer-events-none">
                                    <div>
                                        <label className="block text-slate-500 text-sm font-bold mb-1">Database URL</label>
                                        <input type="text" value="https://api.ristosync.cloud/v1/db" readOnly className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-400" />
                                    </div>
                                    <div>
                                        <label className="block text-slate-500 text-sm font-bold mb-1">API Key</label>
                                        <input type="password" value="************************" readOnly className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-400" />
                                    </div>
                                    <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold">Connetti</button>
                                </div>
                                <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-xl text-yellow-500 text-sm">
                                    La sincronizzazione cloud è attualmente disabilitata. I dati vengono salvati localmente su questo dispositivo.
                                </div>
                            </div>
                        )}

                        {/* NOTIF TAB */}
                        {adminTab === 'notif' && (
                            <div className="max-w-2xl">
                                <h3 className="text-xl font-bold text-white mb-6">Impostazioni Notifiche</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-800">
                                        <div>
                                            <h4 className="font-bold text-white">Suoni Cucina</h4>
                                            <p className="text-slate-400 text-sm">Suono "Ding" all'arrivo di nuovi ordini</p>
                                        </div>
                                        <button onClick={() => toggleNotif('kitchenSound')} className={`w-14 h-8 rounded-full transition-colors relative ${notifSettings.kitchenSound ? 'bg-green-600' : 'bg-slate-700'}`}>
                                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${notifSettings.kitchenSound ? 'left-7' : 'left-1'}`}></div>
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-800">
                                        <div>
                                            <h4 className="font-bold text-white">Suoni Cameriere</h4>
                                            <p className="text-slate-400 text-sm">Feedback audio conferme e errori</p>
                                        </div>
                                        <button onClick={() => toggleNotif('waiterSound')} className={`w-14 h-8 rounded-full transition-colors relative ${notifSettings.waiterSound ? 'bg-green-600' : 'bg-slate-700'}`}>
                                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${notifSettings.waiterSound ? 'left-7' : 'left-1'}`}></div>
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-800 opacity-50">
                                        <div>
                                            <h4 className="font-bold text-white">Push Notifications</h4>
                                            <p className="text-slate-400 text-sm">Invia notifiche ai dispositivi mobili (Coming Soon)</p>
                                        </div>
                                        <button disabled className={`w-14 h-8 rounded-full transition-colors relative bg-slate-700`}>
                                            <div className={`absolute top-1 w-6 h-6 bg-slate-500 rounded-full left-1`}></div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* MENU TAB */}
                        {adminTab === 'menu' && (
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-white">Gestione Piatti</h3>
                                    <button onClick={() => { setIsEditingItem(true); setEditingItem({}); }} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                                        <Plus size={20}/> Nuovo Piatto
                                    </button>
                                </div>

                                {isEditingItem ? (
                                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 max-w-2xl animate-slide-up">
                                        <h4 className="text-lg font-bold text-white mb-4">{editingItem.id ? 'Modifica Piatto' : 'Nuovo Piatto'}</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="block text-slate-500 text-xs font-bold uppercase mb-1">Nome Piatto</label>
                                                <input type="text" value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" placeholder="Es. Carbonara" />
                                            </div>
                                            <div>
                                                <label className="block text-slate-500 text-xs font-bold uppercase mb-1">Prezzo (€)</label>
                                                <input type="number" value={editingItem.price || ''} onChange={e => setEditingItem({...editingItem, price: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-orange-500" placeholder="0.00" />
                                            </div>
                                            <div>
                                                <label className="block text-slate-500 text-xs font-bold uppercase mb-1">Categoria</label>
                                                <select value={editingItem.category || ''} onChange={e => setEditingItem({...editingItem, category: e.target.value as Category})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-orange-500">
                                                    <option value="">Seleziona...</option>
                                                    {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="mb-6">
                                            <label className="block text-slate-500 text-xs font-bold uppercase mb-1">Descrizione (per AI e Clienti)</label>
                                            <textarea value={editingItem.description || ''} onChange={e => setEditingItem({...editingItem, description: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-orange-500 h-24 resize-none" placeholder="Ingredienti, allergeni, dettagli..."></textarea>
                                        </div>
                                        <div className="flex gap-3">
                                            <button onClick={() => setIsEditingItem(false)} className="px-6 py-3 rounded-lg bg-slate-800 text-slate-300 font-bold hover:bg-slate-700">Annulla</button>
                                            <button onClick={handleSaveMenu} className="px-6 py-3 rounded-lg bg-orange-500 text-white font-bold hover:bg-orange-600">Salva Piatto</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {menuItems.map(item => (
                                            <div key={item.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex justify-between items-center group hover:border-slate-600 transition-colors">
                                                <div>
                                                    <h5 className="font-bold text-white text-lg">{item.name}</h5>
                                                    <div className="flex gap-2 text-xs mt-1">
                                                        <span className="bg-orange-900/30 text-orange-400 px-2 py-0.5 rounded font-bold uppercase">{item.category}</span>
                                                        <span className="text-slate-400">€ {item.price.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { setEditingItem(item); setIsEditingItem(true); }} className="p-2 bg-slate-800 rounded-lg text-blue-400 hover:bg-blue-900/30"><Edit2 size={18}/></button>
                                                    <button onClick={() => handleDeleteMenu(item.id)} className="p-2 bg-slate-800 rounded-lg text-red-400 hover:bg-red-900/30"><Trash2 size={18}/></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        <div className="text-center mb-12 z-10">
            <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400 mb-4">
                RistoSync AI
            </h1>
            <p className="text-slate-400 text-lg">Scegli la modalità per questo dispositivo</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl z-10">
            {/* Kitchen Card */}
            <button 
                onClick={() => setRole('kitchen')}
                className="group relative bg-slate-800 hover:bg-slate-700 border border-slate-700 p-8 rounded-2xl transition-all duration-300 hover:scale-105 hover:border-green-500 shadow-2xl flex flex-col items-center gap-6"
            >
                <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center border-2 border-slate-600 group-hover:border-green-500 transition-colors">
                    <ChefHat className="w-12 h-12 text-slate-300 group-hover:text-green-400" />
                </div>
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">Monitor Cucina</h2>
                    <p className="text-slate-400 text-sm">Visualizzazione 16:9 ottimizzata per schermi grandi. Gestione comande in tempo reale.</p>
                </div>
                <div className="absolute bottom-4 text-xs text-slate-600 uppercase tracking-widest font-semibold">Landscape Mode</div>
            </button>

            {/* Waiter Card */}
            <button 
                onClick={handleWaiterClick}
                className="group relative bg-slate-800 hover:bg-slate-700 border border-slate-700 p-8 rounded-2xl transition-all duration-300 hover:scale-105 hover:border-blue-500 shadow-2xl flex flex-col items-center gap-6"
            >
                <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center border-2 border-slate-600 group-hover:border-blue-500 transition-colors">
                    <Smartphone className="w-12 h-12 text-slate-300 group-hover:text-blue-400" />
                </div>
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">App Cameriere</h2>
                    <p className="text-slate-400 text-sm">Interfaccia 9:16 per smartphone. Presa comande veloce e assistente AI.</p>
                </div>
                <div className="absolute bottom-4 text-xs text-slate-600 uppercase tracking-widest font-semibold">Portrait Mode</div>
            </button>
        </div>

        <div className="mt-16 text-slate-500 text-sm max-w-md text-center z-10">
            <p>Per testare la sincronizzazione, apri questa pagina in due schede diverse: una come Cucina e una come Cameriere.</p>
        </div>
      </div>
    );
  }

  return (
    <>
        {role === 'kitchen' ? <KitchenDisplay onExit={handleLogout} /> : <WaiterPad onExit={handleLogout} />}
    </>
  );
};

export default App;