import React, { useState, useEffect } from 'react';
import KitchenDisplay from './components/KitchenDisplay';
import WaiterPad from './components/WaiterPad';
import { ChefHat, Smartphone, User, Settings, Database, Bell, Utensils, X, Save, Plus, Trash2, Edit2, Lock, ShieldAlert, CloudOff, Wheat, Milk, Egg, Nut, Fish, Bean, Flame, Leaf } from 'lucide-react';
import { getWaiterName, saveWaiterName, getMenuItems, addMenuItem, updateMenuItem, deleteMenuItem, getNotificationSettings, saveNotificationSettings, NotificationSettings } from './services/storageService';
import { MenuItem, Category } from './types';

// Ordine visualizzazione categorie nell'admin
const ADMIN_CATEGORY_ORDER = [
    Category.ANTIPASTI,
    Category.PRIMI,
    Category.SECONDI,
    Category.DOLCI,
    Category.BEVANDE
];

// Configurazione Allergeni
const ALLERGENS_CONFIG = [
    { id: 'Glutine', icon: Wheat, label: 'Glutine' },
    { id: 'Latticini', icon: Milk, label: 'Latticini' },
    { id: 'Uova', icon: Egg, label: 'Uova' },
    { id: 'Frutta a guscio', icon: Nut, label: 'Noci' }, // Using Nut as generic for nuts
    { id: 'Pesce', icon: Fish, label: 'Pesce' },
    { id: 'Soia', icon: Bean, label: 'Soia' }, // Using Bean for Soy
    { id: 'Piccante', icon: Flame, label: 'Piccante' },
    { id: 'Vegano', icon: Leaf, label: 'Vegano' },
];

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
  
  // Delete Confirmation State
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);

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
              description: editingItem.description || '',
              allergens: editingItem.allergens || []
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

  const confirmDeleteMenu = () => {
      if (itemToDelete) {
          deleteMenuItem(itemToDelete.id);
          setMenuItems(getMenuItems());
          setItemToDelete(null);
      }
  };

  const toggleAllergen = (allergenId: string) => {
      const current = editingItem.allergens || [];
      if (current.includes(allergenId)) {
          setEditingItem({ ...editingItem, allergens: current.filter(a => a !== allergenId) });
      } else {
          setEditingItem({ ...editingItem, allergens: [...current, allergenId] });
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
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-950 relative">
                        
                        {/* Mobile Tabs */}
                        <div className="flex md:hidden gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                             <button onClick={() => setAdminTab('db')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'db' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Database</button>
                             <button onClick={() => setAdminTab('menu')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'menu' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Menu</button>
                             <button onClick={() => setAdminTab('notif')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'notif' ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Notifiche</button>
                        </div>

                        {/* DB TAB (Locked/Technical Area) */}
                        {adminTab === 'db' && (
                            <div className="max-w-2xl mx-auto mt-10">
                                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <Lock size={120} />
                                    </div>
                                    
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 text-red-500">
                                            <ShieldAlert size={32} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-white">Area Riservata Tecnico</h3>
                                            <p className="text-slate-400 text-xs uppercase tracking-widest">Configurazione Cloud & API</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6 opacity-60 pointer-events-none select-none filter blur-[0.5px]">
                                        <div>
                                            <label className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-2">
                                                <CloudOff size={14}/> Endpoint Database (Protetto)
                                            </label>
                                            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-500 font-mono text-sm">
                                                <span className="flex-1">https://api.ristosync.cloud/v1/sync</span>
                                                <Lock size={14} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-2">
                                                Master API Key
                                            </label>
                                            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-500 font-mono text-sm">
                                                <span className="flex-1">••••••••••••••••••••••••••••••</span>
                                                <Lock size={14} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-4">
                                        <Lock className="text-slate-600" size={20}/>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            Questa sezione è gestita centralmente dall'amministratore di sistema. 
                                            Le modifiche locali sono disabilitate per garantire l'integrità dei dati multi-tenant.
                                            Contattare il supporto tecnico per variazioni.
                                        </p>
                                    </div>
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
                                </div>
                            </div>
                        )}

                        {/* MENU TAB */}
                        {adminTab === 'menu' && (
                            <div className="pb-20">
                                <div className="flex justify-between items-center mb-6 sticky top-0 bg-slate-950 py-4 z-20 border-b border-slate-800">
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Catalogo Piatti</h3>
                                        <p className="text-slate-400 text-xs">{menuItems.length} elementi totali</p>
                                    </div>
                                    <button onClick={() => { setIsEditingItem(true); setEditingItem({}); }} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-orange-900/20 active:scale-95 transition-all">
                                        <Plus size={20}/> <span className="hidden sm:inline">Nuovo Piatto</span>
                                    </button>
                                </div>

                                {isEditingItem ? (
                                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 max-w-2xl mx-auto animate-slide-up shadow-2xl">
                                        <h4 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                            {editingItem.id ? <Edit2 size={20} className="text-blue-500"/> : <Plus size={20} className="text-green-500"/>}
                                            {editingItem.id ? 'Modifica Piatto' : 'Nuovo Piatto'}
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                            <div>
                                                <label className="block text-slate-500 text-xs font-bold uppercase mb-2">Nome Piatto</label>
                                                <input type="text" value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white outline-none focus:border-orange-500 transition-colors font-medium" placeholder="Es. Carbonara" />
                                            </div>
                                            <div>
                                                <label className="block text-slate-500 text-xs font-bold uppercase mb-2">Prezzo (€)</label>
                                                <input type="number" value={editingItem.price || ''} onChange={e => setEditingItem({...editingItem, price: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white outline-none focus:border-orange-500 transition-colors font-mono" placeholder="0.00" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-slate-500 text-xs font-bold uppercase mb-2">Categoria</label>
                                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                                    {Object.values(Category).map(c => (
                                                        <button 
                                                            key={c}
                                                            onClick={() => setEditingItem({...editingItem, category: c})}
                                                            className={`p-2 rounded-lg text-xs font-bold uppercase border transition-all
                                                                ${editingItem.category === c 
                                                                    ? 'bg-orange-500 border-orange-400 text-white shadow-md' 
                                                                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'}
                                                            `}
                                                        >
                                                            {c}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* ALLERGENS SECTION */}
                                        <div className="mb-6">
                                            <label className="block text-slate-500 text-xs font-bold uppercase mb-2">Allergeni & Caratteristiche</label>
                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                                {ALLERGENS_CONFIG.map(allergen => {
                                                    const isActive = editingItem.allergens?.includes(allergen.id);
                                                    return (
                                                        <button
                                                            key={allergen.id}
                                                            onClick={() => toggleAllergen(allergen.id)}
                                                            className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 border transition-all
                                                                ${isActive 
                                                                    ? 'bg-orange-500 border-orange-400 text-white shadow-md' 
                                                                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300'}
                                                            `}
                                                        >
                                                            <allergen.icon size={18} strokeWidth={2.5} />
                                                            <span className="text-[10px] font-bold uppercase tracking-tighter">{allergen.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="mb-8">
                                            <label className="block text-slate-500 text-xs font-bold uppercase mb-2">Descrizione (per AI e Clienti)</label>
                                            <textarea value={editingItem.description || ''} onChange={e => setEditingItem({...editingItem, description: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white outline-none focus:border-orange-500 h-32 resize-none transition-colors" placeholder="Ingredienti principali, note speciali..."></textarea>
                                        </div>
                                        <div className="flex gap-4">
                                            <button onClick={() => setIsEditingItem(false)} className="flex-1 py-4 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors">Annulla</button>
                                            <button onClick={handleSaveMenu} className="flex-1 py-4 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-colors">Salva Configurazione</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        {ADMIN_CATEGORY_ORDER.map(cat => {
                                            const itemsInCategory = menuItems.filter(i => i.category === cat);
                                            if (itemsInCategory.length === 0) return null;

                                            return (
                                                <div key={cat} className="animate-fade-in">
                                                    <div className="flex items-center gap-4 mb-4">
                                                        <h4 className="text-orange-500 font-black uppercase tracking-widest text-sm whitespace-nowrap">{cat}</h4>
                                                        <div className="h-px bg-slate-800 w-full"></div>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                                        {itemsInCategory.map(item => (
                                                            <div key={item.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex justify-between items-start group hover:border-slate-600 transition-all hover:shadow-lg">
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <h5 className="font-bold text-white text-lg leading-tight">{item.name}</h5>
                                                                        {item.allergens && item.allergens.length > 0 && (
                                                                            <span className="flex gap-1">
                                                                                {item.allergens.includes('Piccante') && <Flame size={12} className="text-orange-500" />}
                                                                                {item.allergens.includes('Vegano') && <Leaf size={12} className="text-green-500" />}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-slate-500 text-xs line-clamp-2 mb-3 h-8">{item.description || 'Nessuna descrizione'}</p>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="bg-slate-950 text-slate-300 px-3 py-1 rounded-lg font-mono font-bold text-sm border border-slate-800">
                                                                            € {item.price.toFixed(2)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                                    <button onClick={() => { setEditingItem(item); setIsEditingItem(true); }} className="w-10 h-10 flex items-center justify-center bg-slate-800 rounded-xl text-blue-400 hover:bg-blue-500 hover:text-white transition-colors shadow-sm">
                                                                        <Edit2 size={18}/>
                                                                    </button>
                                                                    <button onClick={() => setItemToDelete(item)} className="w-10 h-10 flex items-center justify-center bg-slate-800 rounded-xl text-red-400 hover:bg-red-500 hover:text-white transition-colors shadow-sm">
                                                                        <Trash2 size={18}/>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {menuItems.length === 0 && (
                                            <div className="text-center py-20 opacity-50">
                                                <Utensils size={48} className="mx-auto mb-4 text-slate-600"/>
                                                <p className="text-slate-500">Il menu è vuoto. Aggiungi il primo piatto!</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* DELETE CONFIRMATION MODAL (ADMIN) */}
        {itemToDelete && (
             <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
                 <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-6 w-full max-w-xs shadow-2xl shadow-red-900/20 transform animate-slide-up">
                     <div className="flex flex-col items-center text-center mb-4">
                         <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 text-red-500 border border-red-500/20">
                             <Trash2 size={32} />
                         </div>
                         <h3 className="text-xl font-bold text-white">Eliminare Piatto?</h3>
                         <p className="text-slate-400 text-sm mt-2">
                             Stai per eliminare definitivamente <br/><span className="text-white font-bold">{itemToDelete.name}</span> dal menu.
                         </p>
                     </div>
                     <div className="flex gap-3 mt-6">
                         <button 
                           onClick={() => setItemToDelete(null)}
                           className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold text-sm hover:bg-slate-700 transition-colors"
                         >
                             Annulla
                         </button>
                         <button 
                           onClick={confirmDeleteMenu}
                           className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 shadow-lg shadow-red-600/30 transition-colors"
                         >
                             Elimina
                         </button>
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