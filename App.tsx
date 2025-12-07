import React, { useState, useEffect } from 'react';
import KitchenDisplay from './components/KitchenDisplay';
import WaiterPad from './components/WaiterPad';
import AuthScreen from './components/AuthScreen';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import { ChefHat, Smartphone, User, Settings, Bell, Utensils, X, Save, Plus, Trash2, Edit2, Wheat, Milk, Egg, Nut, Fish, Bean, Flame, Leaf, Info, LogOut, Bot, ExternalLink, Key, Database, ShieldCheck, Lock, AlertTriangle, Mail, UserX, RefreshCw, Send, Printer, ArrowRightLeft, CheckCircle, LayoutGrid, SlidersHorizontal, Mic, MicOff } from 'lucide-react';
import { getWaiterName, saveWaiterName, getMenuItems, addMenuItem, updateMenuItem, deleteMenuItem, getNotificationSettings, saveNotificationSettings, NotificationSettings, initSupabaseSync, getGoogleApiKey, saveGoogleApiKey, getAppSettings, saveAppSettings } from './services/storageService';
import { supabase, signOut, isSupabaseConfigured, SUPER_ADMIN_EMAIL } from './services/supabase';
import { MenuItem, Category, Department, AppSettings } from './types';

// Ordine visualizzazione categorie nell'admin
const ADMIN_CATEGORY_ORDER = [
    Category.ANTIPASTI,
    Category.PRIMI,
    Category.SECONDI,
    Category.DOLCI,
    Category.BEVANDE
];

const ALLERGENS_CONFIG = [
    { id: 'Glutine', icon: Wheat, label: 'Glutine' },
    { id: 'Latticini', icon: Milk, label: 'Latticini' },
    { id: 'Uova', icon: Egg, label: 'Uova' },
    { id: 'Frutta a guscio', icon: Nut, label: 'Noci' }, 
    { id: 'Pesce', icon: Fish, label: 'Pesce' },
    { id: 'Soia', icon: Bean, label: 'Soia' }, 
    { id: 'Piccante', icon: Flame, label: 'Piccante' },
    { id: 'Vegano', icon: Leaf, label: 'Vegano' },
];

const capitalize = (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [isSuspended, setIsSuspended] = useState(false); 
  const [isBanned, setIsBanned] = useState(false);
  const [accountDeleted, setAccountDeleted] = useState(false);
  
  const [role, setRole] = useState<'kitchen' | 'waiter' | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [waiterNameInput, setWaiterNameInput] = useState('');
  
  // Restaurant Info
  const [restaurantName, setRestaurantName] = useState('Ristorante');

  // Admin State
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState<'menu' | 'notif' | 'info' | 'ai' | 'db'>('menu');
  const [adminViewMode, setAdminViewMode] = useState<'dashboard' | 'app'>('dashboard');
  
  // Menu Manager State
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<MenuItem>>({});
  const [isListening, setIsListening] = useState(false);
  
  // Delete Confirmation State
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);

  // Settings State
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({ kitchenSound: true, waiterSound: true, pushEnabled: false });
  
  // App Settings (Destinations)
  const [appSettings, setAppSettingsState] = useState<AppSettings>(getAppSettings());
  const [tempDestinations, setTempDestinations] = useState<Record<Category, Department>>(getAppSettings().categoryDestinations);
  const [hasUnsavedDestinations, setHasUnsavedDestinations] = useState(false);

  const [apiKeyInput, setApiKeyInput] = useState('');

  const isSuperAdmin = session?.user?.email === SUPER_ADMIN_EMAIL;

  useEffect(() => {
      const timer = setTimeout(() => {
          setLoadingSession((prev) => {
              if (prev) return false;
              return prev;
          });
      }, 5000); 
      return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
      if (supabase) {
          const checkUserStatus = async (user: any) => {
             try {
                 const { data } = await supabase.from('profiles').select('restaurant_name, subscription_status').eq('id', user.id).single();
                 
                 if (data) {
                     if (data.subscription_status === 'suspended') { setIsSuspended(true); setIsBanned(false); if(data.restaurant_name) setRestaurantName(data.restaurant_name); return false; }
                     if (data.subscription_status === 'banned') { setIsBanned(true); setIsSuspended(false); if(data.restaurant_name) setRestaurantName(data.restaurant_name); return false; }
                     if (data.restaurant_name) setRestaurantName(data.restaurant_name);
                     setIsSuspended(false); setIsBanned(false); setAccountDeleted(false);
                     return true; 
                 } else {
                     const createdAt = new Date(user.created_at).getTime();
                     if ((Date.now() - createdAt) / 1000 > 60) { setAccountDeleted(true); return false; }
                     return true; 
                 }
             } catch (e) { return true; }
          };

          supabase.auth.getSession().then(async ({ data: { session } }) => {
              try {
                  if (session) {
                      const isActive = await checkUserStatus(session.user);
                      if (isActive) { setSession(session); initSupabaseSync(); } else { setSession(session); }
                  } else { setSession(null); }
              } finally { setLoadingSession(false); }
          });

          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
              if (session) {
                  checkUserStatus(session.user);
                  setSession(session);
                  initSupabaseSync();
              } else {
                  setSession(null); setIsSuspended(false); setAccountDeleted(false); setIsBanned(false);
              }
              setLoadingSession(false);
          });
          return () => subscription.unsubscribe();
      } else { setLoadingSession(false); }
  }, []);

  // FIX: Separato l'effetto di inizializzazione da quello di ascolto eventi
  // Questo previene il reset dello stato quando l'utente modifica una destinazione
  useEffect(() => {
      if (showAdmin) {
          setMenuItems(getMenuItems());
          setNotifSettings(getNotificationSettings());
          
          const currentSettings = getAppSettings();
          setAppSettingsState(currentSettings); 
          setTempDestinations(currentSettings.categoryDestinations);
          setHasUnsavedDestinations(false);

          const key = getGoogleApiKey();
          if (key) setApiKeyInput(key);
      }
  }, [showAdmin]);

  useEffect(() => {
      const handleSettingsUpdate = () => {
          const updated = getAppSettings();
          setAppSettingsState(updated);
          // Aggiorna le destinazioni temporanee solo se non ci sono modifiche in corso
          if (!hasUnsavedDestinations) {
              setTempDestinations(updated.categoryDestinations);
          }
      };
      window.addEventListener('local-settings-update', handleSettingsUpdate);
      return () => window.removeEventListener('local-settings-update', handleSettingsUpdate);
  }, [hasUnsavedDestinations]);

  const handleWaiterClick = () => {
      const existingName = getWaiterName();
      if (existingName) setRole('waiter');
      else setShowLogin(true);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (waiterNameInput.trim()) {
          saveWaiterName(waiterNameInput.trim());
          setShowLogin(false);
          setRole('waiter');
      }
  };

  const handleExitApp = () => setRole(null);

  const handleReactivationRequest = async () => {
      if (!supabase || !session) return;
      try {
          const originalName = session.user.user_metadata?.restaurant_name || "Richiesta Sblocco";
          await supabase.from('profiles').insert({
              id: session.user.id, email: session.user.email, restaurant_name: `${originalName} (RICHIESTA)`, subscription_status: 'banned'
          });
          alert("Richiesta inviata!");
          window.location.reload(); 
      } catch (e: any) { alert("Errore: " + e.message); }
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
          if (editingItem.id) updateMenuItem(itemToSave);
          else addMenuItem(itemToSave);
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
      if (current.includes(allergenId)) setEditingItem({ ...editingItem, allergens: current.filter(a => a !== allergenId) });
      else setEditingItem({ ...editingItem, allergens: [...current, allergenId] });
  };

  const toggleNotif = (key: keyof NotificationSettings) => {
      const newSettings = { ...notifSettings, [key]: !notifSettings[key] };
      setNotifSettings(newSettings);
      saveNotificationSettings(newSettings);
  };

  const handleDictation = () => {
    if (isListening) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Il tuo browser non supporta la dettatura vocale.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.continuous = false; // Ferma il mic dopo la prima frase (messaggio)
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const currentDesc = editingItem.description || '';
        const newText = currentDesc ? `${currentDesc} ${transcript}` : transcript;
        
        setEditingItem(prev => ({ ...prev, description: newText }));
        setIsListening(false);
    };

    recognition.onerror = (event: any) => {
        console.error("Errore microfono:", event.error);
        setIsListening(false);
    };
    
    recognition.onend = () => {
        setIsListening(false);
    };

    recognition.start();
  };

  // --- DESTINATION LOGIC (Temporary State) ---
  const handleTempDestinationChange = (cat: Category, dest: Department) => {
      setTempDestinations(prev => ({ ...prev, [cat]: dest }));
      setHasUnsavedDestinations(true);
  };

  const saveDestinationsToCloud = async () => {
      const newSettings = { ...appSettings, categoryDestinations: tempDestinations };
      await saveAppSettings(newSettings); 
      setAppSettingsState(newSettings);
      setHasUnsavedDestinations(false);
      alert("Configurazione salvata con successo!");
  };

  const handleSaveApiKey = () => {
      saveGoogleApiKey(apiKeyInput.trim());
      alert("Chiave API salvata!");
  };

  if (loadingSession) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-orange-500 font-bold">Avvio...</div>;

  if ((isSuspended || accountDeleted || isBanned) && !isSuperAdmin) {
      return (
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
              <div className="bg-slate-900 p-8 rounded-3xl border border-red-900/50 shadow-2xl max-w-lg w-full">
                  <h1 className="text-3xl font-black text-white mb-2">{isBanned ? 'Richiesta Inviata' : accountDeleted ? 'Account Rimosso' : 'Account Sospeso'}</h1>
                  <p className="text-slate-400 mb-6">Contatta l'amministrazione.</p>
                  {accountDeleted && <button onClick={handleReactivationRequest} className="w-full bg-green-600 text-white px-6 py-3 rounded-xl font-bold">Richiedi Riattivazione</button>}
                  {!accountDeleted && <button onClick={signOut} className="w-full bg-slate-800 text-white px-6 py-3 rounded-xl font-bold mt-4">Esci</button>}
              </div>
          </div>
      );
  }

  if (!session && isSupabaseConfigured()) return <AuthScreen />;
  
  if (isSuperAdmin && !role && adminViewMode === 'dashboard') return <SuperAdminDashboard onEnterApp={() => setAdminViewMode('app')} />;

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        
        <style>{`
            @keyframes float-hat {
                0%, 100% { transform: translateY(0) rotate(-15deg); }
                50% { transform: translateY(-12px) rotate(-5deg); }
            }
            .animate-float-hat {
                animation: float-hat 3.5s ease-in-out infinite;
            }
        `}</style>

        {/* Header Bar */}
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-30">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center"><ChefHat size={18} className="text-white"/></div>
                <span className="text-white font-bold">{restaurantName}</span>
                {isSuperAdmin && <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase ml-2">Admin</span>}
            </div>
            <div className="flex gap-4">
                {isSuperAdmin && <button onClick={() => setAdminViewMode('dashboard')} className="text-slate-300 hover:text-white"><ShieldCheck size={24} /></button>}
                <button onClick={() => setShowAdmin(true)} className="p-3 rounded-full bg-slate-800 text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"><Settings size={24} /></button>
                <button onClick={signOut} className="p-3 rounded-full bg-slate-800 text-red-500 hover:text-white hover:bg-red-600 transition-colors"><LogOut size={24} /></button>
            </div>
        </div>

        {/* Login Modal */}
        {showLogin && (
            <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-fade-in">
                <form onSubmit={handleLoginSubmit} className="bg-slate-800 p-8 rounded-3xl w-full max-w-sm border border-slate-700 shadow-2xl animate-slide-up">
                    <h2 className="text-2xl font-bold text-white text-center mb-6">Chi sei?</h2>
                    <input type="text" value={waiterNameInput} onChange={(e) => setWaiterNameInput(capitalize(e.target.value))} placeholder="Nome" className="w-full bg-slate-900 rounded-xl px-4 py-4 text-white mb-4 text-center font-bold text-lg border border-slate-700" autoFocus />
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setShowLogin(false)} className="flex-1 py-3 bg-slate-700 text-slate-300 rounded-xl font-bold">Annulla</button>
                        <button type="submit" disabled={!waiterNameInput.trim()} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">Accedi</button>
                    </div>
                </form>
            </div>
        )}

        {/* ADMIN MODAL */}
        {showAdmin && (
            <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden animate-fade-in">
                <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3"><Settings className="text-orange-500"/> Configurazione</h2>
                    <button onClick={() => setShowAdmin(false)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full"><X /></button>
                </div>
                
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-64 bg-slate-900 border-r border-slate-800 p-4 space-y-2 hidden md:block">
                         <button onClick={() => setAdminTab('menu')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'menu' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Utensils size={20}/> Menu & Destinazioni</button>
                         <button onClick={() => setAdminTab('notif')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'notif' ? 'bg-green-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Bell size={20}/> Notifiche</button>
                         <button onClick={() => setAdminTab('ai')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'ai' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Bot size={20}/> AI Intelligence</button>
                         <button onClick={() => setAdminTab('info')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'info' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Info size={20}/> Legenda</button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-950 relative">
                        {/* Mobile Tabs */}
                        <div className="flex md:hidden gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                             <button onClick={() => setAdminTab('menu')} className={`px-4 py-2 rounded-lg font-bold text-sm ${adminTab === 'menu' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Menu</button>
                             <button onClick={() => setAdminTab('notif')} className={`px-4 py-2 rounded-lg font-bold text-sm ${adminTab === 'notif' ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Notifiche</button>
                             <button onClick={() => setAdminTab('ai')} className={`px-4 py-2 rounded-lg font-bold text-sm ${adminTab === 'ai' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>AI</button>
                        </div>

                        {/* INFO / LEGENDA TAB */}
                        {adminTab === 'info' && (
                            <div className="grid grid-cols-2 gap-4 max-w-lg">
                                {ALLERGENS_CONFIG.map(a => (<div key={a.id} className="bg-slate-900 p-4 rounded-xl flex items-center gap-3 text-white"><a.icon size={20}/> {a.label}</div>))}
                            </div>
                        )}

                        {/* AI TAB */}
                        {adminTab === 'ai' && (
                            <div className="max-w-xl">
                                <h3 className="text-xl font-bold text-white mb-4">Google Gemini API</h3>
                                <input type="password" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="API Key" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white mb-4" />
                                <button onClick={handleSaveApiKey} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold w-full">Salva Key</button>
                            </div>
                        )}

                        {/* NOTIF TAB */}
                        {adminTab === 'notif' && (
                            <div className="max-w-xl space-y-4">
                                <div className="flex justify-between bg-slate-900 p-4 rounded-xl border border-slate-800 text-white items-center">
                                    <span>Suoni Cucina</span>
                                    <button onClick={() => toggleNotif('kitchenSound')} className={`w-12 h-6 rounded-full relative ${notifSettings.kitchenSound ? 'bg-green-600' : 'bg-slate-700'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifSettings.kitchenSound ? 'left-7' : 'left-1'}`}></div></button>
                                </div>
                                <div className="flex justify-between bg-slate-900 p-4 rounded-xl border border-slate-800 text-white items-center">
                                    <span>Suoni Cameriere</span>
                                    <button onClick={() => toggleNotif('waiterSound')} className={`w-12 h-6 rounded-full relative ${notifSettings.waiterSound ? 'bg-green-600' : 'bg-slate-700'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifSettings.waiterSound ? 'left-7' : 'left-1'}`}></div></button>
                                </div>
                            </div>
                        )}

                        {/* MENU & DESTINATIONS TAB */}
                        {adminTab === 'menu' && (
                            <div className="pb-20">
                                {/* NEW DESTINATION CONFIGURATION BAR (HORIZONTAL SCROLL) */}
                                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 mb-8 sticky top-0 z-20 shadow-xl">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                            <SlidersHorizontal size={18} className="text-orange-500"/> Configurazione Destinazioni
                                        </h4>
                                        <button 
                                            onClick={saveDestinationsToCloud}
                                            disabled={!hasUnsavedDestinations}
                                            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all border
                                                ${hasUnsavedDestinations 
                                                    ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20 animate-pulse border-green-500' 
                                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border-slate-700'}
                                            `}
                                        >
                                            <Save size={14}/> {hasUnsavedDestinations ? 'SALVA MODIFICHE' : 'NESSUNA MODIFICA'}
                                        </button>
                                    </div>
                                    
                                    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                                        {Object.values(Category).map(cat => {
                                            const currentDest = tempDestinations[cat] || 'Cucina';
                                            return (
                                                <div key={cat} className="flex flex-col items-center min-w-[130px] p-2 shrink-0">
                                                    <span className="font-bold text-slate-300 text-xs mb-3 uppercase tracking-wide">{cat}</span>
                                                    <div className="flex w-full rounded-lg p-0.5 border border-slate-700">
                                                        <button 
                                                            onClick={() => handleTempDestinationChange(cat, 'Cucina')}
                                                            className={`flex-1 py-2 rounded-md text-[10px] font-black uppercase tracking-wide transition-all ${currentDest === 'Cucina' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                                                        >
                                                            Cucina
                                                        </button>
                                                        <button 
                                                            onClick={() => handleTempDestinationChange(cat, 'Sala')}
                                                            className={`flex-1 py-2 rounded-md text-[10px] font-black uppercase tracking-wide transition-all ${currentDest === 'Sala' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                                                        >
                                                            Sala
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-0 text-center border-t border-slate-800 pt-3">
                                        Seleziona "Sala" per le categorie gestite dal cameriere (es. Bevande). Queste non appariranno in Cucina.
                                    </p>
                                </div>

                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-white">Piatti nel Menu</h3>
                                    <button onClick={() => { setIsEditingItem(true); setEditingItem({}); }} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                                        <Plus size={20}/> <span className="hidden sm:inline">Nuovo</span>
                                    </button>
                                </div>

                                {isEditingItem ? (
                                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 max-w-2xl mx-auto animate-slide-up">
                                        <h4 className="text-lg font-bold text-white mb-6">{editingItem.id ? 'Modifica Piatto' : 'Nuovo Piatto'}</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <input type="text" value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: capitalize(e.target.value)})} className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-white" placeholder="Nome Piatto" />
                                            <input type="number" value={editingItem.price || ''} onChange={e => setEditingItem({...editingItem, price: Number(e.target.value)})} className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-white" placeholder="Prezzo" />
                                        </div>
                                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
                                            {Object.values(Category).map(c => (
                                                <button key={c} onClick={() => setEditingItem({...editingItem, category: c})} className={`p-2 rounded-lg text-xs font-bold uppercase border ${editingItem.category === c ? 'bg-orange-500 border-orange-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>{c}</button>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 mb-4">
                                            {ALLERGENS_CONFIG.map(a => (
                                                <button key={a.id} onClick={() => toggleAllergen(a.id)} className={`p-2 rounded-xl flex flex-col items-center ${editingItem.allergens?.includes(a.id) ? 'bg-orange-500 text-white' : 'bg-slate-950 text-slate-500'}`}><a.icon size={16}/></button>
                                            ))}
                                        </div>
                                        
                                        <div className="relative mb-6">
                                            <textarea 
                                                value={editingItem.description || ''} 
                                                onChange={e => setEditingItem({...editingItem, description: e.target.value})} 
                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 pr-12 text-white h-24 resize-none" 
                                                placeholder="Descrizione / Ingredienti (Usa il microfono per dettare)"
                                            ></textarea>
                                            <button 
                                                type="button" 
                                                onClick={handleDictation}
                                                className={`absolute top-3 right-3 p-2 rounded-full transition-all shadow-lg ${isListening ? 'bg-red-600 text-white animate-pulse ring-2 ring-red-400' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500'}`}
                                                title="Dettatura vocale"
                                            >
                                                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                                            </button>
                                        </div>

                                        <div className="flex gap-4">
                                            <button onClick={() => setIsEditingItem(false)} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold">Annulla</button>
                                            <button onClick={handleSaveMenu} className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-bold">Salva</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {ADMIN_CATEGORY_ORDER.map(cat => {
                                            const itemsInCategory = menuItems.filter(i => i.category === cat);
                                            if (itemsInCategory.length === 0) return null;
                                            return (
                                                <div key={cat}>
                                                    <h4 className="text-orange-500 font-black uppercase text-sm mb-3">{cat}</h4>
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                                        {itemsInCategory.map(item => (
                                                            <div key={item.id} className="relative bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col gap-3 group hover:border-slate-600 transition-all shadow-sm overflow-hidden">
                                                                
                                                                {/* Header: Name and Price */}
                                                                <div className="flex justify-between items-start gap-4">
                                                                    <div className="font-bold text-white text-2xl leading-tight w-3/4">{item.name}</div>
                                                                    <div className="text-2xl font-black text-orange-500 whitespace-nowrap">€ {item.price.toFixed(2)}</div>
                                                                </div>

                                                                {/* Description / Ingredients */}
                                                                <div className="text-slate-400 text-sm leading-relaxed border-b border-slate-800/50 pb-3">
                                                                    {item.description || <span className="italic opacity-30 text-xs">Nessuna descrizione inserita</span>}
                                                                </div>

                                                                {/* Allergens */}
                                                                <div className="min-h-[24px]">
                                                                    {item.allergens && item.allergens.length > 0 ? (
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {item.allergens.map(aId => {
                                                                                const alg = ALLERGENS_CONFIG.find(a => a.id === aId);
                                                                                if (!alg) return null;
                                                                                return (
                                                                                    <span key={aId} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-700 text-[10px] font-bold uppercase text-slate-300 tracking-wider">
                                                                                        <alg.icon size={12} className="text-orange-500"/> {alg.label}
                                                                                    </span>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[10px] text-slate-600 uppercase font-bold tracking-widest flex items-center gap-1">
                                                                            <CheckCircle size={10}/> Nessun allergene segnalato
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Hover Actions Overlay */}
                                                                <div className="absolute top-0 right-0 p-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all bg-gradient-to-l from-slate-900 via-slate-900 to-transparent pl-8">
                                                                    <button onClick={() => { setEditingItem(item); setIsEditingItem(true); }} className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg transform hover:scale-110 transition-transform"><Edit2 size={18}/></button>
                                                                    <button onClick={() => setItemToDelete(item)} className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg shadow-lg transform hover:scale-110 transition-transform"><Trash2 size={18}/></button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {itemToDelete && (
             <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-6 animate-fade-in">
                 <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-6 w-full max-w-xs shadow-2xl text-center animate-slide-up">
                     <h3 className="text-xl font-bold text-white mb-2">Eliminare {itemToDelete.name}?</h3>
                     <div className="flex gap-3 mt-4">
                         <button onClick={() => setItemToDelete(null)} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold">Annulla</button>
                         <button onClick={confirmDeleteMenu} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">Elimina</button>
                     </div>
                 </div>
             </div>
        )}

        {/* RESTORED TITLE SECTION */}
        <div className="text-center mb-12 z-10 relative mt-10">
            <div className="relative inline-block">
                <div className="absolute -top-10 -left-10 text-orange-500 animate-float-hat z-20">
                    <ChefHat size={64} strokeWidth={2.5} />
                </div>
                <h1 className="text-6xl md:text-8xl font-extrabold text-white mb-4 relative z-10 tracking-tight">
                    Risto<span className="text-orange-500">Sync</span> <span className="text-slate-500 text-5xl">AI</span>
                </h1>
            </div>
            <p className="text-slate-400 text-xl font-medium mt-2">Scegli la modalità per questo dispositivo</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl z-10">
            <button onClick={() => setRole('kitchen')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-8 rounded-2xl hover:border-green-500 transition-all flex flex-col items-center gap-6 group">
                <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center border-2 border-slate-600 group-hover:border-green-500 transition-colors"><ChefHat className="w-12 h-12 text-slate-300 group-hover:text-green-400" /></div>
                <div className="text-center"><h2 className="text-2xl font-bold text-white">Monitor Cucina</h2><p className="text-slate-400 text-sm mt-1">Modalità Landscape (16:9)</p></div>
            </button>
            <button onClick={handleWaiterClick} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-8 rounded-2xl hover:border-blue-500 transition-all flex flex-col items-center gap-6 group">
                <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center border-2 border-slate-600 group-hover:border-blue-500 transition-colors"><Smartphone className="w-12 h-12 text-slate-300 group-hover:text-blue-400" /></div>
                <div className="text-center"><h2 className="text-2xl font-bold text-white">App Sala</h2><p className="text-slate-400 text-sm mt-1">Modalità Portrait (9:16)</p></div>
            </button>
        </div>
        <div className="mt-16 text-slate-500 text-sm z-10"><p>Login: <b>{session?.user?.email}</b></p></div>
      </div>
    );
  }

  return (
    <>
        {role === 'kitchen' ? <KitchenDisplay onExit={handleExitApp} /> : <WaiterPad onExit={handleExitApp} />}
    </>
  );
};

export default App;