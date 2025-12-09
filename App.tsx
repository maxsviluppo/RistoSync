import React, { useState, useEffect, useMemo } from 'react';
import KitchenDisplay from './components/KitchenDisplay';
import WaiterPad from './components/WaiterPad';
import AuthScreen from './components/AuthScreen';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import DigitalMenu from './components/DigitalMenu'; // New Component
import { ChefHat, Smartphone, User, Settings, Bell, Utensils, X, Save, Plus, Trash2, Edit2, Wheat, Milk, Egg, Nut, Fish, Bean, Flame, Leaf, Info, LogOut, Bot, ExternalLink, Key, Database, ShieldCheck, Lock, AlertTriangle, Mail, UserX, RefreshCw, Send, Printer, ArrowRightLeft, CheckCircle, LayoutGrid, SlidersHorizontal, Mic, MicOff, TrendingUp, BarChart3, Calendar, ChevronLeft, ChevronRight, DollarSign, History, Receipt, UtensilsCrossed, Eye, ArrowRight, QrCode, Share2, Copy } from 'lucide-react';
import { getWaiterName, saveWaiterName, getMenuItems, addMenuItem, updateMenuItem, deleteMenuItem, getNotificationSettings, saveNotificationSettings, NotificationSettings, initSupabaseSync, getGoogleApiKey, saveGoogleApiKey, getAppSettings, saveAppSettings, getOrders, deleteHistoryByDate } from './services/storageService';
import { supabase, signOut, isSupabaseConfigured, SUPER_ADMIN_EMAIL } from './services/supabase';
import { MenuItem, Category, Department, AppSettings, OrderStatus, Order } from './types';

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
  // ROUTING FOR DIGITAL MENU (Public Access)
  const queryParams = new URLSearchParams(window.location.search);
  const publicMenuId = queryParams.get('menu');

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
  const [adminTab, setAdminTab] = useState<'menu' | 'notif' | 'info' | 'ai' | 'analytics' | 'share'>('menu');
  const [adminViewMode, setAdminViewMode] = useState<'dashboard' | 'app'>('dashboard');
  
  // Menu Manager State
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<MenuItem>>({});
  const [isListening, setIsListening] = useState(false);
  
  // Analytics State
  const [ordersForAnalytics, setOrdersForAnalytics] = useState<Order[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  // Admin Detail View for Table Row
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

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
      // If we are in Public Menu mode, skip session check
      if (publicMenuId) {
          setLoadingSession(false);
          return;
      }

      const timer = setTimeout(() => {
          setLoadingSession((prev) => {
              if (prev) return false;
              return prev;
          });
      }, 5000); 
      return () => clearTimeout(timer);
  }, [publicMenuId]);

  useEffect(() => {
      if (publicMenuId) return; // Skip auth check for public menu

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
  }, [publicMenuId]);

  // FIX: Separato l'effetto di inizializzazione da quello di ascolto eventi
  useEffect(() => {
      if (showAdmin) {
          setMenuItems(getMenuItems());
          setNotifSettings(getNotificationSettings());
          
          const currentSettings = getAppSettings();
          setAppSettingsState(currentSettings); 
          setTempDestinations(currentSettings.categoryDestinations || {
              [Category.ANTIPASTI]: 'Cucina',
              [Category.PRIMI]: 'Cucina',
              [Category.SECONDI]: 'Cucina',
              [Category.DOLCI]: 'Cucina',
              [Category.BEVANDE]: 'Sala'
          });
          setHasUnsavedDestinations(false);
          setOrdersForAnalytics(getOrders()); // Load orders for analytics

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
      // Keep analytics up to date locally
      const handleOrderUpdate = () => { if(showAdmin) setOrdersForAnalytics(getOrders()); };

      window.addEventListener('local-settings-update', handleSettingsUpdate);
      window.addEventListener('local-storage-update', handleOrderUpdate);
      return () => {
          window.removeEventListener('local-settings-update', handleSettingsUpdate);
          window.removeEventListener('local-storage-update', handleOrderUpdate);
      };
  }, [hasUnsavedDestinations, showAdmin]);

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
    if (!SpeechRecognition) { alert("Il tuo browser non supporta la dettatura vocale."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const currentDesc = editingItem.description || '';
        const newText = currentDesc ? `${currentDesc} ${transcript}` : transcript;
        setEditingItem(prev => ({ ...prev, description: newText }));
        setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
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

  // --- ANALYTICS LOGIC (ADVANCED FOR ADMIN) ---
  const filteredHistoryOrders = useMemo(() => {
      return ordersForAnalytics.filter(o => {
          if (o.status !== OrderStatus.DELIVERED) return false;
          const orderDate = new Date(o.createdAt || o.timestamp);
          return orderDate.getDate() === selectedDate.getDate() &&
                 orderDate.getMonth() === selectedDate.getMonth() &&
                 orderDate.getFullYear() === selectedDate.getFullYear();
      }).sort((a, b) => (b.createdAt || b.timestamp) - (a.createdAt || a.timestamp)); // Newest first
  }, [ordersForAnalytics, selectedDate]);

  const stats = useMemo(() => {
      let totalRevenue = 0;
      let totalItems = 0;
      let totalWaitMinutes = 0;
      const hourlyTraffic: Record<number, number> = {};
      const dishCounts: Record<string, {name: string, count: number, revenue: number}> = {};

      filteredHistoryOrders.forEach(order => {
          // Revenue
          const orderTotal = order.items.reduce((acc, i) => acc + (i.menuItem.price * i.quantity), 0);
          totalRevenue += orderTotal;

          // Wait Time
          const start = order.createdAt || order.timestamp;
          const end = order.timestamp;
          if (end > start) {
              totalWaitMinutes += (end - start) / 60000;
          }

          // Hourly Traffic
          const hour = new Date(start).getHours();
          hourlyTraffic[hour] = (hourlyTraffic[hour] || 0) + 1;

          // Dishes
          order.items.forEach(i => {
              totalItems += i.quantity;
              const id = i.menuItem.id;
              if (!dishCounts[id]) dishCounts[id] = { name: i.menuItem.name, count: 0, revenue: 0 };
              dishCounts[id].count += i.quantity;
              dishCounts[id].revenue += i.quantity * i.menuItem.price;
          });
      });

      const avgWait = filteredHistoryOrders.length > 0 ? Math.round(totalWaitMinutes / filteredHistoryOrders.length) : 0;
      const topDishes = Object.values(dishCounts).sort((a, b) => b.count - a.count).slice(0, 5);
      
      // Chart Data Formatting
      const chartHours = Array.from({length: 24}, (_, i) => ({ hour: i, count: hourlyTraffic[i] || 0 }));
      const maxHourly = Math.max(...Object.values(hourlyTraffic), 1);

      return { totalRevenue, totalItems, avgWait, topDishes, chartHours, maxHourly };
  }, [filteredHistoryOrders]);

  const changeDate = (days: number) => {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + days);
      setSelectedDate(newDate);
  };

  const formatDate = (date: Date) => date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  const handleDeleteDailyHistory = async () => {
      if (confirm(`Sei sicuro di voler eliminare TUTTO lo storico del ${formatDate(selectedDate)}?\nQuesta operazione è irreversibile.`)) {
          await deleteHistoryByDate(selectedDate);
          setOrdersForAnalytics(getOrders()); // Refresh local
      }
  };

  // --- RENDER DIGITAL MENU IF PUBLIC URL ---
  if (publicMenuId) {
      return <DigitalMenu restaurantId={publicMenuId} />;
  }

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
            @keyframes float-hat { 0%, 100% { transform: translateY(0) rotate(-15deg); } 50% { transform: translateY(-12px) rotate(-5deg); } }
            .animate-float-hat { animation: float-hat 3.5s ease-in-out infinite; }
            /* Receipt Style */
            .receipt-edge { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 95% 95%, 90% 100%, 85% 95%, 80% 100%, 75% 95%, 70% 100%, 65% 95%, 60% 100%, 55% 95%, 50% 100%, 45% 95%, 40% 100%, 35% 95%, 30% 100%, 25% 95%, 20% 100%, 15% 95%, 10% 100%, 5% 95%, 0% 100%); }
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
                         <button onClick={() => setAdminTab('analytics')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'analytics' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><TrendingUp size={20}/> Analisi & Storico</button>
                         <button onClick={() => setAdminTab('notif')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'notif' ? 'bg-green-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Bell size={20}/> Notifiche</button>
                         <button onClick={() => setAdminTab('share')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'share' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><QrCode size={20}/> Menu Digitale</button>
                         <button onClick={() => setAdminTab('ai')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'ai' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Bot size={20}/> AI Intelligence</button>
                         <button onClick={() => setAdminTab('info')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'info' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Info size={20}/> Legenda</button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-950 relative">
                        {/* Mobile Tabs */}
                        <div className="flex md:hidden gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                             <button onClick={() => setAdminTab('menu')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'menu' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Menu</button>
                             <button onClick={() => setAdminTab('analytics')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'analytics' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Analisi</button>
                             <button onClick={() => setAdminTab('notif')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'notif' ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Notifiche</button>
                             <button onClick={() => setAdminTab('share')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'share' ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-400'}`}>QR Code</button>
                             <button onClick={() => setAdminTab('ai')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'ai' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>AI</button>
                             <button onClick={() => setAdminTab('info')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'info' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400'}`}>Legenda</button>
                        </div>
                        
                        {/* NEW: SHARE / DIGITAL MENU TAB WITH PREVIEW */}
                        {adminTab === 'share' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start max-w-5xl mx-auto">
                                {/* Left Col: Info & QR */}
                                <div className="text-center lg:text-left">
                                    <div className="bg-white p-8 rounded-3xl inline-block mb-6 shadow-2xl">
                                        <QrCode size={180} className="text-slate-900"/>
                                    </div>
                                    <h3 className="text-3xl font-black text-white mb-2">Il tuo Menu Digitale</h3>
                                    <p className="text-slate-400 mb-8 max-w-sm mx-auto lg:mx-0">
                                        I clienti possono scansionare questo codice per vedere il menu completo, allergeni e foto dei piatti.
                                    </p>
                                    
                                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4 mb-6 max-w-md mx-auto lg:mx-0">
                                        <code className="text-xs text-blue-400 font-mono truncate flex-1">
                                            {window.location.origin}?menu={session?.user?.id}
                                        </code>
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(`${window.location.origin}?menu=${session?.user?.id}`);
                                                alert("Link copiato!");
                                            }}
                                            className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 text-white"
                                        >
                                            <Copy size={16}/>
                                        </button>
                                    </div>

                                    <div className="flex gap-4 justify-center lg:justify-start mb-8">
                                        <a 
                                            href={`?menu=${session?.user?.id}`} 
                                            target="_blank" 
                                            className="inline-flex items-center gap-2 px-6 py-3 bg-pink-600 text-white font-bold rounded-xl hover:bg-pink-500 shadow-lg shadow-pink-600/20"
                                        >
                                            <ExternalLink size={18}/> Apri Esterno
                                        </a>
                                        <button 
                                            className="px-6 py-3 bg-slate-800 text-white font-bold rounded-xl border border-slate-700 cursor-default"
                                        >
                                            Status: Online
                                        </button>
                                    </div>

                                    <div className="p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-xl text-left max-w-md mx-auto lg:mx-0">
                                        <p className="text-xs text-yellow-500 font-bold mb-1 flex items-center gap-2"><AlertTriangle size={14}/> Nota Tecnica</p>
                                        <p className="text-xs text-yellow-200/70">
                                            Se l'anteprima a destra funziona ma il link esterno no, chiedi al Super Admin di eseguire lo script SQL "Public Menu Access".
                                        </p>
                                    </div>
                                </div>

                                {/* Right Col: Live Preview (Phone Mockup) */}
                                <div className="flex flex-col items-center">
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-4">Anteprima Live</p>
                                    <div className="border-[8px] border-slate-900 rounded-[3rem] overflow-hidden h-[600px] w-[320px] relative shadow-2xl bg-slate-950">
                                        {/* Phone Notch */}
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-slate-900 rounded-b-xl z-50"></div>
                                        
                                        {/* Live Component */}
                                        <div className="h-full w-full overflow-hidden bg-slate-50">
                                            <DigitalMenu restaurantId={session?.user?.id} isPreview={true} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ANALYTICS TAB (ADVANCED CHARTS + DELETE BUTTON) */}
                        {adminTab === 'analytics' && (
                            <div className="pb-20">
                                {/* DATE SELECTOR & DELETE BUTTON */}
                                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
                                    <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
                                        <button onClick={() => changeDate(-1)} className="p-3 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"><ChevronLeft/></button>
                                        <div className="px-6 font-bold text-white flex items-center gap-2 uppercase tracking-wide"><Calendar size={18} className="text-orange-500"/> {formatDate(selectedDate)}</div>
                                        <button onClick={() => changeDate(1)} className="p-3 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"><ChevronRight/></button>
                                    </div>

                                    {/* DELETE HISTORY BUTTON */}
                                    {filteredHistoryOrders.length > 0 && (
                                        <button onClick={handleDeleteDailyHistory} className="bg-red-900/20 hover:bg-red-900/40 border border-red-500/30 text-red-400 px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm transition-colors">
                                            <Trash2 size={16} /> ELIMINA STORICO DEL {selectedDate.getDate()}/{selectedDate.getMonth()+1}
                                        </button>
                                    )}
                                </div>

                                {/* KPI Cards - 4 Columns with Gradients */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    <div className="bg-gradient-to-br from-green-900/40 to-slate-800 p-4 rounded-2xl border border-green-500/20 flex flex-col items-center justify-center relative overflow-hidden">
                                        <div className="absolute top-2 right-2 text-green-500 opacity-20"><DollarSign size={40}/></div>
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Incasso Stimato</p>
                                        <p className="text-3xl font-black text-white">€ {stats.totalRevenue.toFixed(2)}</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-blue-900/40 to-slate-800 p-4 rounded-2xl border border-blue-500/20 flex flex-col items-center justify-center relative overflow-hidden">
                                        <div className="absolute top-2 right-2 text-blue-500 opacity-20"><UtensilsCrossed size={40}/></div>
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Piatti Venduti</p>
                                        <p className="text-3xl font-black text-white">{stats.totalItems}</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-orange-900/40 to-slate-800 p-4 rounded-2xl border border-orange-500/20 flex flex-col items-center justify-center relative overflow-hidden">
                                        <div className="absolute top-2 right-2 text-orange-500 opacity-20"><History size={40}/></div>
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Tempo Medio</p>
                                        <p className="text-3xl font-black text-white">{stats.avgWait} <span className="text-sm font-medium text-slate-400">min</span></p>
                                    </div>
                                    <div className="bg-gradient-to-br from-purple-900/40 to-slate-800 p-4 rounded-2xl border border-purple-500/20 flex flex-col items-center justify-center relative overflow-hidden">
                                        <div className="absolute top-2 right-2 text-purple-500 opacity-20"><TrendingUp size={40}/></div>
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Comande</p>
                                        <p className="text-3xl font-black text-white">{filteredHistoryOrders.length}</p>
                                    </div>
                                </div>

                                <div className="flex flex-col lg:flex-row gap-6">
                                    {/* LEFT: CHARTS */}
                                    <div className="lg:w-1/3 flex flex-col gap-6">
                                        {/* HOURLY TREND */}
                                        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                                            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2"><BarChart3 size={16} className="text-orange-500"/> Flusso Orario</h3>
                                            <div className="flex items-end gap-1 h-32 w-full">
                                                {stats.chartHours.map((h, i) => {
                                                    if (h.hour < 11 || (h.hour > 15 && h.hour < 18)) return null; 
                                                    const height = h.count > 0 ? (h.count / stats.maxHourly) * 100 : 0;
                                                    return (
                                                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                                                            <div className="w-full bg-blue-600/30 rounded-t-sm relative transition-all group-hover:bg-blue-500" style={{ height: `${height}%` }}>
                                                                {h.count > 0 && <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity border border-slate-600">{h.count}</div>}
                                                            </div>
                                                            <span className="text-[9px] text-slate-500 font-mono">{h.hour}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* BEST SELLERS */}
                                        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                                            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-green-500"/> Top 5 Piatti</h3>
                                            <div className="space-y-4">
                                                {stats.topDishes.map((d, i) => (
                                                    <div key={i} className="relative">
                                                        <div className="flex justify-between text-xs font-bold text-white mb-1 relative z-10">
                                                            <span>{d.name}</span>
                                                            <span>{d.count} ordini</span>
                                                        </div>
                                                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                                            <div className="h-full bg-gradient-to-r from-orange-500 to-yellow-500" style={{ width: `${(d.count / (stats.topDishes[0]?.count || 1)) * 100}%` }}></div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {stats.topDishes.length === 0 && <p className="text-slate-500 text-xs italic">Nessun dato disponibile</p>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* RIGHT: ORDERS LIST TABLE */}
                                    <div className="flex-1 bg-slate-800 rounded-2xl border border-slate-700 flex flex-col overflow-hidden">
                                        <div className="p-4 border-b border-slate-700 bg-slate-800/90 backdrop-blur-sm sticky top-0 flex justify-between items-center">
                                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Storico Comande</h3>
                                        </div>
                                        
                                        <div className="overflow-auto max-h-[500px]">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-bold sticky top-0 z-10">
                                                    <tr>
                                                        <th className="p-3">Ora</th>
                                                        <th className="p-3">Tavolo</th>
                                                        <th className="p-3">Staff</th>
                                                        <th className="p-3">Contenuto</th>
                                                        <th className="p-3 text-right">Totale</th>
                                                        <th className="p-3 text-center">Info</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-700/50 text-sm">
                                                    {filteredHistoryOrders.map((order) => {
                                                        const orderTotal = order.items.reduce((acc, i) => acc + (i.menuItem.price * i.quantity), 0);
                                                        const displayTable = order.tableNumber.replace('_HISTORY', '');
                                                        
                                                        return (
                                                            <tr key={order.id} onClick={() => setDetailOrder(order)} className="hover:bg-slate-700/30 transition-colors cursor-pointer group">
                                                                <td className="p-3 font-mono text-slate-400">
                                                                    <div className="flex flex-col">
                                                                        <span>IN: {formatTime(order.createdAt || order.timestamp)}</span>
                                                                        <span className="text-green-500">OUT: {formatTime(order.timestamp)}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-3 font-bold text-white text-lg">{displayTable}</td>
                                                                <td className="p-3 text-slate-300">{order.waiterName || '-'}</td>
                                                                <td className="p-3 text-slate-400 text-xs">
                                                                    {order.items.length} articoli
                                                                    <span className="block text-[10px] text-slate-500 truncate max-w-[150px]">{order.items.map(i => i.menuItem.name).join(', ')}</span>
                                                                </td>
                                                                <td className="p-3 text-right font-mono font-bold text-green-400">€ {orderTotal.toFixed(2)}</td>
                                                                <td className="p-3 text-center">
                                                                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors mx-auto">
                                                                        <Eye size={16}/>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {filteredHistoryOrders.length === 0 && (
                                                        <tr><td colSpan={6} className="p-8 text-center text-slate-500 italic">Nessuna comanda registrata in questa data.</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

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
                                            const currentDest = tempDestinations?.[cat] || 'Cucina';
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
                                                                                const alg = ALLERGENS_ICONS[aId] ? {icon: ALLERGENS_ICONS[aId], label: aId} : ALLERGENS_CONFIG.find(a => a.id === aId);
                                                                                if (!alg) return null;
                                                                                const Icon = alg.icon || Info;
                                                                                return (
                                                                                    <span key={aId} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-700 text-[10px] font-bold uppercase text-slate-300 tracking-wider">
                                                                                        <Icon size={12} className="text-orange-500"/> {alg.label}
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
        
        {/* IMPORTANTE: Allergeni Icons map for main view reuse */}
        {/* Note: I'm reusing ALLERGENS_CONFIG defined at top */}
        
        {/* DETAIL MODAL FOR ADMIN */}
        {detailOrder && (
            <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setDetailOrder(null)}>
                <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                    <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center">
                        <div>
                            <h3 className="text-white font-bold text-lg">Dettaglio Tavolo {detailOrder.tableNumber.replace('_HISTORY', '')}</h3>
                            <p className="text-slate-400 text-xs">{formatDate(new Date(detailOrder.createdAt || detailOrder.timestamp))} • {formatTime(detailOrder.createdAt || detailOrder.timestamp)}</p>
                        </div>
                        <button onClick={() => setDetailOrder(null)} className="p-2 bg-slate-700 rounded-full hover:bg-slate-600"><Trash2 size={16} className="opacity-0"/> <span className="sr-only">Chiudi</span><ArrowRight size={20}/></button>
                    </div>
                    <div className="p-4 max-h-[60vh] overflow-y-auto">
                        <ul className="space-y-3">
                            {detailOrder.items.map((item, i) => (
                                <li key={i} className="flex justify-between items-start border-b border-slate-800 pb-2 last:border-0">
                                    <div className="flex gap-3">
                                        <span className="font-bold text-orange-500">{item.quantity}x</span>
                                        <div>
                                            <p className="text-white font-medium">{item.menuItem.name}</p>
                                            {item.notes && <p className="text-xs text-red-400 italic mt-0.5">Note: {item.notes}</p>}
                                        </div>
                                    </div>
                                    <span className="font-mono text-slate-400">€ {(item.menuItem.price * item.quantity).toFixed(2)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
                        <span className="text-slate-400 font-bold uppercase text-sm">Totale Comanda</span>
                        <span className="text-2xl font-black text-green-500">€ {detailOrder.items.reduce((acc, i) => acc + (i.menuItem.price * i.quantity), 0).toFixed(2)}</span>
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

  const ALLERGENS_ICONS: Record<string, any> = {
    'Glutine': Wheat, 'Latticini': Milk, 'Uova': Egg, 'Frutta a guscio': Nut,
    'Pesce': Fish, 'Soia': Bean, 'Piccante': Flame, 'Vegano': Leaf
  };

  return (
    <>
        {role === 'kitchen' ? <KitchenDisplay onExit={handleExitApp} /> : <WaiterPad onExit={handleExitApp} />}
    </>
  );
};

export default App;