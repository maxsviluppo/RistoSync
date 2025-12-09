import React, { useState, useEffect, useMemo } from 'react';
import KitchenDisplay from './components/KitchenDisplay';
import WaiterPad from './components/WaiterPad';
import AuthScreen from './components/AuthScreen';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import DigitalMenu from './components/DigitalMenu';
import { ChefHat, Smartphone, User, Settings, Bell, Utensils, X, Save, Plus, Trash2, Edit2, Wheat, Milk, Egg, Nut, Fish, Bean, Flame, Leaf, Info, LogOut, Bot, ExternalLink, Key, Database, ShieldCheck, Lock, AlertTriangle, Mail, UserX, RefreshCw, Send, Printer, ArrowRightLeft, CheckCircle, LayoutGrid, SlidersHorizontal, Mic, MicOff, TrendingUp, BarChart3, Calendar, ChevronLeft, ChevronRight, DollarSign, History, Receipt, UtensilsCrossed, Eye, ArrowRight, QrCode, Share2, Copy, MapPin, Store, Phone, Globe, Star, Pizza, CakeSlice, Wine, Sandwich, MessageCircle, FileText, PhoneCall, Sparkles, Loader } from 'lucide-react';
import { getWaiterName, saveWaiterName, getMenuItems, addMenuItem, updateMenuItem, deleteMenuItem, getNotificationSettings, saveNotificationSettings, NotificationSettings, initSupabaseSync, getGoogleApiKey, saveGoogleApiKey, getAppSettings, saveAppSettings, getOrders, deleteHistoryByDate } from './services/storageService';
import { supabase, signOut, isSupabaseConfigured, SUPER_ADMIN_EMAIL } from './services/supabase';
import { askChefAI, generateRestaurantAnalysis } from './services/geminiService';
import { MenuItem, Category, Department, AppSettings, OrderStatus, Order, RestaurantProfile } from './types';

const ADMIN_CATEGORY_ORDER = [
    Category.ANTIPASTI,
    Category.PANINI,
    Category.PIZZE,
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

export default function App() {
  // ROUTING FOR DIGITAL MENU (Public Access)
  const queryParams = new URLSearchParams(window.location.search);
  const publicMenuId = queryParams.get('menu');

  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [isSuspended, setIsSuspended] = useState(false); 
  const [isBanned, setIsBanned] = useState(false);
  const [accountDeleted, setAccountDeleted] = useState(false);
  
  const [role, setRole] = useState<'kitchen' | 'pizzeria' | 'pub' | 'waiter' | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [waiterNameInput, setWaiterNameInput] = useState('');
  
  // Restaurant Info
  const [restaurantName, setRestaurantName] = useState('Ristorante');

  // Admin State
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState<'profile' | 'menu' | 'notif' | 'info' | 'ai' | 'analytics' | 'share'>('menu');
  const [adminViewMode, setAdminViewMode] = useState<'dashboard' | 'app'>('dashboard');
  
  // Menu Manager State
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<MenuItem>>({});
  const [isListening, setIsListening] = useState(false);
  
  // Analytics State
  const [ordersForAnalytics, setOrdersForAnalytics] = useState<Order[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Delete Confirmation State
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);

  // Settings State
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({ kitchenSound: true, waiterSound: true, pushEnabled: false });
  
  // App Settings (Destinations)
  const [appSettings, setAppSettingsState] = useState<AppSettings>(getAppSettings());
  const [tempDestinations, setTempDestinations] = useState<Record<Category, Department>>(getAppSettings().categoryDestinations);
  const [tempPrintSettings, setTempPrintSettings] = useState<Record<string, boolean>>(getAppSettings().printEnabled);
  const [hasUnsavedDestinations, setHasUnsavedDestinations] = useState(false);
  
  // Profile Settings State
  const [profileForm, setProfileForm] = useState<RestaurantProfile>({});

  const [apiKeyInput, setApiKeyInput] = useState('');

  const isSuperAdmin = session?.user?.email === SUPER_ADMIN_EMAIL;

  useEffect(() => {
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
      if (publicMenuId) return;

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

  useEffect(() => {
      if (showAdmin) {
          setMenuItems(getMenuItems());
          setNotifSettings(getNotificationSettings());
          
          const currentSettings = getAppSettings();
          setAppSettingsState(currentSettings); 
          setTempDestinations(currentSettings.categoryDestinations || {
              [Category.ANTIPASTI]: 'Cucina',
              [Category.PANINI]: 'Pub',
              [Category.PIZZE]: 'Pizzeria',
              [Category.PRIMI]: 'Cucina',
              [Category.SECONDI]: 'Cucina',
              [Category.DOLCI]: 'Cucina',
              [Category.BEVANDE]: 'Sala'
          });
          setTempPrintSettings(currentSettings.printEnabled || {
              'Cucina': false, 'Pizzeria': false, 'Pub': false, 'Sala': false, 'Cassa': false
          });
          
          setProfileForm({
              name: restaurantName,
              address: currentSettings.restaurantProfile?.address || '',
              billingAddress: currentSettings.restaurantProfile?.billingAddress || '',
              vatNumber: currentSettings.restaurantProfile?.vatNumber || '',
              phoneNumber: currentSettings.restaurantProfile?.phoneNumber || '',
              landlineNumber: currentSettings.restaurantProfile?.landlineNumber || '',
              whatsappNumber: currentSettings.restaurantProfile?.whatsappNumber || '',
              email: currentSettings.restaurantProfile?.email || '',
              website: currentSettings.restaurantProfile?.website || ''
          });

          setHasUnsavedDestinations(false);
          setOrdersForAnalytics(getOrders());

          const key = getGoogleApiKey();
          if (key) setApiKeyInput(key);
      }
  }, [showAdmin, restaurantName]);

  useEffect(() => {
      const handleSettingsUpdate = () => {
          const updated = getAppSettings();
          setAppSettingsState(updated);
          if (!hasUnsavedDestinations) {
              setTempDestinations(updated.categoryDestinations);
              setTempPrintSettings(updated.printEnabled);
          }
      };
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

  const handleTempDestinationChange = (cat: Category, dest: Department) => {
      setTempDestinations(prev => ({ ...prev, [cat]: dest }));
      setHasUnsavedDestinations(true);
  };

  const toggleTempPrint = (key: string) => {
      setTempPrintSettings(prev => ({ ...prev, [key]: !prev[key] }));
      setHasUnsavedDestinations(true);
  };

  const saveDestinationsToCloud = async () => {
      const newSettings = { 
          ...appSettings, 
          categoryDestinations: tempDestinations,
          printEnabled: tempPrintSettings
      };
      await saveAppSettings(newSettings); 
      setAppSettingsState(newSettings);
      setHasUnsavedDestinations(false);
      alert("Configurazione salvata con successo!");
  };

  const handleSaveApiKey = () => {
      saveGoogleApiKey(apiKeyInput.trim());
      alert("Chiave API salvata!");
  };

  const handleSaveProfile = async () => {
      const newProfile = { ...profileForm };
      const newSettings = { ...appSettings, restaurantProfile: newProfile };
      await saveAppSettings(newSettings);
      setAppSettingsState(newSettings);

      if (supabase && session?.user?.id && newProfile.name) {
          await supabase.from('profiles').update({ restaurant_name: newProfile.name }).eq('id', session.user.id);
      }
      if (newProfile.name) {
          setRestaurantName(newProfile.name);
      }
      alert("Profilo aggiornato con successo!");
  };

  const filteredHistoryOrders = useMemo(() => {
      return ordersForAnalytics.filter(o => {
          if (o.status !== OrderStatus.DELIVERED) return false;
          const orderDate = new Date(o.createdAt || o.timestamp);
          return orderDate.getDate() === selectedDate.getDate() &&
                 orderDate.getMonth() === selectedDate.getMonth() &&
                 orderDate.getFullYear() === selectedDate.getFullYear();
      }).sort((a, b) => (b.createdAt || b.timestamp) - (a.createdAt || a.timestamp)); 
  }, [ordersForAnalytics, selectedDate]);

  const stats = useMemo(() => {
      let totalRevenue = 0;
      let totalItems = 0;
      let totalWaitMinutes = 0;
      const hourlyTraffic: Record<number, number> = {};
      const dishCounts: Record<string, {name: string, count: number, revenue: number}> = {};

      filteredHistoryOrders.forEach(order => {
          const orderTotal = order.items.reduce((acc, i) => acc + (i.menuItem.price * i.quantity), 0);
          totalRevenue += orderTotal;
          const start = order.createdAt || order.timestamp;
          const end = order.timestamp;
          if (end > start) totalWaitMinutes += (end - start) / 60000;
          const hour = new Date(start).getHours();
          hourlyTraffic[hour] = (hourlyTraffic[hour] || 0) + 1;
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
      const chartHours = Array.from({length: 24}, (_, i) => ({ hour: i, count: hourlyTraffic[i] || 0 }));
      const maxHourly = Math.max(...Object.values(hourlyTraffic), 1);

      return { totalRevenue, totalItems, avgWait, topDishes, chartHours, maxHourly };
  }, [filteredHistoryOrders]);

  const changeDate = (days: number) => {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + days);
      setSelectedDate(newDate);
      setAiAnalysisResult(''); // Clear AI result when changing date
  };

  const formatDate = (date: Date) => date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  const handleDeleteDailyHistory = async () => {
      if (confirm(`Sei sicuro di voler eliminare TUTTO lo storico del ${formatDate(selectedDate)}?\nQuesta operazione è irreversibile.`)) {
          await deleteHistoryByDate(selectedDate);
          setOrdersForAnalytics(getOrders());
      }
  };

  const handleRunAiAnalysis = async () => {
      if (!getGoogleApiKey() && !process.env.API_KEY) {
          alert("Devi prima configurare la tua API Key di Google Gemini nella sezione AI Intelligence.");
          return;
      }
      setIsAnalyzing(true);
      const result = await generateRestaurantAnalysis(stats, formatDate(selectedDate));
      setAiAnalysisResult(result);
      setIsAnalyzing(false);
  };

  const getCategoryIcon = (cat: Category) => {
    switch (cat) {
        case Category.ANTIPASTI: return <UtensilsCrossed size={18} />;
        case Category.PANINI: return <Sandwich size={18} />;
        case Category.PIZZE: return <Pizza size={18} />;
        case Category.PRIMI: return <ChefHat size={18} />;
        case Category.SECONDI: return <Utensils size={18} />;
        case Category.DOLCI: return <CakeSlice size={18} />;
        case Category.BEVANDE: return <Wine size={18} />;
        default: return <Utensils size={18} />;
    }
  };

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

  if (role === 'kitchen') return <KitchenDisplay onExit={handleExitApp} department="Cucina" />;
  if (role === 'pizzeria') return <KitchenDisplay onExit={handleExitApp} department="Pizzeria" />;
  if (role === 'pub') return <KitchenDisplay onExit={handleExitApp} department="Pub" />;
  if (role === 'waiter') return <WaiterPad onExit={handleExitApp} />;

  return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        
        <style>{`
            @keyframes float-hat { 0%, 100% { transform: translateY(0) rotate(-15deg); } 50% { transform: translateY(-12px) rotate(-5deg); } }
            .animate-float-hat { animation: float-hat 3.5s ease-in-out infinite; }
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

        {/* MAIN DASHBOARD CONTENT */}
        {!showLogin && !showAdmin && (
            <div className="flex flex-col items-center z-20 animate-fade-in">
                
                {/* BIG DASHBOARD LOGO */}
                <div className="text-center mb-12">
                    <div className="w-28 h-28 bg-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-orange-500/20 transform -rotate-3 animate-float-hat">
                        <ChefHat size={60} className="text-white" />
                    </div>
                    <h1 className="text-6xl font-black text-white tracking-tighter mb-3">
                        Risto<span className="text-orange-500">Sync</span> <span className="text-blue-500">AI</span>
                    </h1>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                        Restaurant Management System
                    </p>
                </div>

                {/* ROLE SELECTION BUTTONS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-center">
                    <button onClick={() => setRole('kitchen')} className="group relative w-full lg:w-56 h-72 bg-slate-800 rounded-3xl border border-slate-700 hover:border-orange-500 transition-all duration-500 flex flex-col items-center justify-center gap-6 shadow-2xl hover:shadow-orange-500/20 active:scale-95">
                        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center group-hover:bg-orange-500 transition-colors duration-500 border border-slate-700 group-hover:border-orange-400">
                            <ChefHat size={40} className="text-slate-500 group-hover:text-white transition-colors duration-500" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-xl font-black text-white mb-1">CUCINA</h2>
                            <p className="text-slate-500 text-xs font-medium group-hover:text-orange-400 transition-colors">Display Chef</p>
                        </div>
                    </button>

                    <button onClick={() => setRole('pizzeria')} className="group relative w-full lg:w-56 h-72 bg-slate-800 rounded-3xl border border-slate-700 hover:border-red-500 transition-all duration-500 flex flex-col items-center justify-center gap-6 shadow-2xl hover:shadow-red-500/20 active:scale-95">
                        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center group-hover:bg-red-500 transition-colors duration-500 border border-slate-700 group-hover:border-red-400">
                            <Pizza size={40} className="text-slate-500 group-hover:text-white transition-colors duration-500" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-xl font-black text-white mb-1">PIZZERIA</h2>
                            <p className="text-slate-500 text-xs font-medium group-hover:text-red-400 transition-colors">Display Forno</p>
                        </div>
                    </button>

                    <button onClick={() => setRole('pub')} className="group relative w-full lg:w-56 h-72 bg-slate-800 rounded-3xl border border-slate-700 hover:border-amber-500 transition-all duration-500 flex flex-col items-center justify-center gap-6 shadow-2xl hover:shadow-amber-500/20 active:scale-95">
                        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center group-hover:bg-amber-500 transition-colors duration-500 border border-slate-700 group-hover:border-amber-400">
                            <Sandwich size={40} className="text-slate-500 group-hover:text-white transition-colors duration-500" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-xl font-black text-white mb-1">PUB</h2>
                            <p className="text-slate-500 text-xs font-medium group-hover:text-amber-400 transition-colors">Panini & Bar</p>
                        </div>
                    </button>

                    <button onClick={handleWaiterClick} className="group relative w-full lg:w-56 h-72 bg-slate-800 rounded-3xl border border-slate-700 hover:border-blue-500 transition-all duration-500 flex flex-col items-center justify-center gap-6 shadow-2xl hover:shadow-blue-500/20 active:scale-95">
                        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center group-hover:bg-blue-500 transition-colors duration-500 border border-slate-700 group-hover:border-blue-400">
                            <UtensilsCrossed size={40} className="text-slate-500 group-hover:text-white transition-colors duration-500" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-xl font-black text-white mb-1">SALA</h2>
                            <p className="text-slate-500 text-xs font-medium group-hover:text-blue-400 transition-colors">Pad Camerieri</p>
                        </div>
                    </button>
                </div>
            </div>
        )}

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
                         <button onClick={() => setAdminTab('profile')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'profile' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Store size={20}/> Profilo Ristorante</button>
                         <button onClick={() => setAdminTab('analytics')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'analytics' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><TrendingUp size={20}/> Analisi & Storico</button>
                         <button onClick={() => setAdminTab('notif')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'notif' ? 'bg-green-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Bell size={20}/> Notifiche</button>
                         <button onClick={() => setAdminTab('share')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'share' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><QrCode size={20}/> Menu Digitale</button>
                         <button onClick={() => setAdminTab('ai')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'ai' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Bot size={20}/> AI Intelligence</button>
                         <button onClick={() => setAdminTab('info')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'info' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Info size={20}/> Legenda</button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-950 relative">
                        {/* Mobile Tabs */}
                        <div className="flex md:hidden gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                             <button onClick={() => setAdminTab('menu')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'menu' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Menu</button>
                             <button onClick={() => setAdminTab('profile')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'profile' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400'}`}>Profilo</button>
                             <button onClick={() => setAdminTab('analytics')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'analytics' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Analisi</button>
                             <button onClick={() => setAdminTab('notif')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'notif' ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Notifiche</button>
                             <button onClick={() => setAdminTab('share')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'share' ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-400'}`}>QR Code</button>
                             <button onClick={() => setAdminTab('ai')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'ai' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>AI</button>
                             <button onClick={() => setAdminTab('info')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'info' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400'}`}>Legenda</button>
                        </div>
                        
                        {/* SHARE TAB - FIXED QR SECTION */}
                        {adminTab === 'share' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start max-w-5xl mx-auto h-full">
                                <div className="text-center lg:text-left flex flex-col items-center lg:items-start">
                                    <div className="bg-white p-4 rounded-3xl inline-block mb-6 shadow-2xl">
                                        {/* Use session ID directly or fallback to avoid empty src */}
                                        <img 
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`https://risto-sync.vercel.app/?menu=${session?.user?.id || 'demo'}`)}`}
                                            alt="QR Code Menu"
                                            className="w-48 h-48 bg-gray-200 rounded-xl"
                                        />
                                    </div>
                                    <h3 className="text-3xl font-black text-white mb-2">Il tuo Menu Digitale</h3>
                                    <p className="text-slate-400 mb-8 max-w-sm mx-auto lg:mx-0">
                                        I clienti possono scansionare questo codice per vedere il menu completo, allergeni e foto dei piatti.
                                    </p>
                                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4 mb-6 max-w-md mx-auto lg:mx-0 w-full">
                                        <code className="text-xs text-blue-400 font-mono truncate flex-1">
                                            https://risto-sync.vercel.app/?menu={session?.user?.id || '...'}
                                        </code>
                                        <button 
                                            onClick={() => {
                                                if (session?.user?.id) {
                                                    navigator.clipboard.writeText(`https://risto-sync.vercel.app/?menu=${session.user.id}`);
                                                    alert("Link copiato!");
                                                }
                                            }}
                                            className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 text-white"
                                        >
                                            <Copy size={16}/>
                                        </button>
                                    </div>
                                    <div className="flex gap-4 justify-center lg:justify-start mb-8">
                                        <a 
                                            href={`https://risto-sync.vercel.app/?menu=${session?.user?.id || ''}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-6 py-3 bg-pink-600 text-white font-bold rounded-xl hover:bg-pink-500 shadow-lg shadow-pink-600/20"
                                        >
                                            <ExternalLink size={18}/> Apri Esterno
                                        </a>
                                        <button className="px-6 py-3 bg-slate-800 text-white font-bold rounded-xl border border-slate-700 cursor-default">Status: Online</button>
                                    </div>
                                </div>
                                <div className="flex flex-col items-center">
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-4">Anteprima Live</p>
                                    <div className="border-[8px] border-slate-900 rounded-[3rem] overflow-hidden h-[600px] w-[320px] relative shadow-2xl bg-slate-950 flex flex-col">
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-slate-900 rounded-b-xl z-50"></div>
                                        {/* DigitalMenu Container - Explicit height to prevent collapse */}
                                        <div className="h-full w-full overflow-hidden bg-slate-50 flex-1 relative">
                                            <DigitalMenu 
                                                restaurantId={session?.user?.id || 'preview'} 
                                                isPreview={true} 
                                                activeMenuData={menuItems}
                                                activeRestaurantName={restaurantName}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* MENU TAB */}
                        {adminTab === 'menu' && (
                             <div className="max-w-4xl mx-auto pb-20">
                                <div className="flex justify-between items-center mb-6">
                                    <div><h3 className="text-xl font-bold text-white">Gestione Menu</h3><p className="text-slate-400 text-sm">Aggiungi, modifica o rimuovi piatti.</p></div>
                                    <button onClick={() => { setIsEditingItem(true); setEditingItem({}); }} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-orange-600/20"><Plus size={18}/> Nuovo Piatto</button>
                                </div>
                                
                                <div className="space-y-8">
                                    {ADMIN_CATEGORY_ORDER.map(category => {
                                        const items = menuItems.filter(i => i.category === category);
                                        if (items.length === 0) return null;

                                        return (
                                            <div key={category} className="mb-8">
                                                <h4 className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-slate-800 pb-2">
                                                    {getCategoryIcon(category)} {category}
                                                </h4>
                                                <div className="space-y-3">
                                                    {items.map(item => (
                                                        <div key={item.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center hover:border-slate-700 transition-colors group">
                                                            <div className="flex items-center gap-4">
                                                                <div className="text-orange-500 font-black text-lg min-w-[3.5rem] text-center">€ {item.price.toFixed(2)}</div>
                                                                <div>
                                                                    <h4 className="font-bold text-white text-lg">{item.name}</h4>
                                                                    <div className="flex items-center gap-2 text-xs">
                                                                        <span className="text-slate-500">{item.description || 'Nessuna descrizione'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => { setEditingItem(item); setIsEditingItem(true); }} className="p-2 bg-slate-800 text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white"><Edit2 size={16}/></button>
                                                                <button onClick={() => setItemToDelete(item)} className="p-2 bg-slate-800 text-red-400 rounded-lg hover:bg-red-600 hover:text-white"><Trash2 size={16}/></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* CONFIGURAZIONE DESTINAZIONI & STAMPE */}
                                <div className="mt-12 pt-12 border-t border-slate-800">
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h3 className="text-xl font-bold text-white">Configurazione Reparti</h3>
                                            <p className="text-slate-400 text-sm">Dove inviare e stampare le comande?</p>
                                        </div>
                                        {hasUnsavedDestinations && <button onClick={saveDestinationsToCloud} className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg animate-pulse">Salva Modifiche</button>}
                                    </div>
                                    
                                    {/* 1. Mappatura Categorie -> Reparto */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                        {ADMIN_CATEGORY_ORDER.map(cat => (
                                            <div key={cat} className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800">
                                                <span className="font-bold text-slate-300 uppercase flex items-center gap-2">
                                                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>{cat}
                                                </span>
                                                <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800 overflow-x-auto">
                                                    <button onClick={() => handleTempDestinationChange(cat, 'Cucina')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${tempDestinations[cat] === 'Cucina' ? 'bg-orange-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}>CUCINA</button>
                                                    <button onClick={() => handleTempDestinationChange(cat, 'Sala')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${tempDestinations[cat] === 'Sala' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}>SALA</button>
                                                    <button onClick={() => handleTempDestinationChange(cat, 'Pizzeria')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${tempDestinations[cat] === 'Pizzeria' ? 'bg-red-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}>PIZZERIA</button>
                                                    <button onClick={() => handleTempDestinationChange(cat, 'Pub')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${tempDestinations[cat] === 'Pub' ? 'bg-amber-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}>PUB</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* 2. Configurazione Stampanti */}
                                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Printer className="text-white"/>
                                            <h4 className="font-bold text-white uppercase tracking-wider">Stampanti Wi-Fi (Scontrino Fisico)</h4>
                                        </div>
                                        <p className="text-slate-400 text-sm mb-6">
                                            Abilitando queste opzioni, il <strong>Terminale del Reparto (es. Cucina)</strong> lancerà automaticamente la stampa quando arriva un nuovo ordine.
                                            <br/>La "Cassa / Totale" viene invece stampata subito dal terminale di Sala.
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                            {(['Cucina', 'Pizzeria', 'Pub', 'Cassa'] as string[]).map(dept => (
                                                <div key={dept} className="flex justify-between items-center bg-slate-950 p-4 rounded-xl border border-slate-800">
                                                    <div className="flex items-center gap-3">
                                                        {dept === 'Cucina' && <ChefHat size={18} className="text-orange-500"/>}
                                                        {dept === 'Pizzeria' && <Pizza size={18} className="text-red-500"/>}
                                                        {dept === 'Pub' && <Sandwich size={18} className="text-amber-500"/>}
                                                        {dept === 'Cassa' && <Receipt size={18} className="text-green-500"/>}
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-white">{dept === 'Cassa' ? 'Cassa / Totale' : dept}</span>
                                                            <span className="text-[9px] text-slate-500 uppercase">{dept === 'Cassa' ? 'Stampa da Sala' : 'Stampa al Reparto'}</span>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => toggleTempPrint(dept)} 
                                                        className={`w-12 h-6 rounded-full relative transition-colors ${tempPrintSettings[dept] ? 'bg-green-500' : 'bg-slate-700'}`}
                                                    >
                                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${tempPrintSettings[dept] ? 'left-7' : 'left-1'}`}></div>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                             </div>
                        )}
                        
                        {/* PROFILE TAB */}
                        {adminTab === 'profile' && (
                            <div className="max-w-2xl mx-auto pb-20">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                    <Store className="text-slate-400"/> Dati Attività
                                </h3>
                                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-6">
                                    {/* Nome Ristorante */}
                                    <div>
                                        <label className="block text-slate-400 text-xs font-bold uppercase mb-2">Nome Ristorante (Visibile ovunque)</label>
                                        <div className="relative">
                                            <ChefHat className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                                            <input 
                                                type="text" 
                                                value={profileForm.name || ''} 
                                                onChange={e => setProfileForm({...profileForm, name: e.target.value})} 
                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white font-bold text-lg focus:border-orange-500 outline-none" 
                                                placeholder="Il Tuo Ristorante"
                                            />
                                        </div>
                                    </div>

                                    {/* Login Email (Read Only) */}
                                    <div>
                                        <label className="block text-slate-400 text-xs font-bold uppercase mb-2">Email Login (Account)</label>
                                        <div className="relative opacity-60">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                                            <input 
                                                type="text" 
                                                value={session?.user?.email || ''} 
                                                disabled
                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-slate-300 font-mono cursor-not-allowed" 
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1 pl-1">Questa è l'email usata per l'accesso e non può essere modificata qui.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-slate-400 text-xs font-bold uppercase mb-2">Email Contatti (Clienti)</label>
                                            <div className="relative">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                                                <input 
                                                    type="email" 
                                                    value={profileForm.email || ''} 
                                                    onChange={e => setProfileForm({...profileForm, email: e.target.value})} 
                                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:border-slate-500 outline-none" 
                                                    placeholder="info@ristorante.com"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-slate-400 text-xs font-bold uppercase mb-2">P.IVA / Codice Fiscale</label>
                                            <div className="relative">
                                                <Receipt className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                                                <input 
                                                    type="text" 
                                                    value={profileForm.vatNumber || ''} 
                                                    onChange={e => setProfileForm({...profileForm, vatNumber: e.target.value})} 
                                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:border-slate-500 outline-none font-mono" 
                                                    placeholder="IT00000000000"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Phones Section */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-slate-400 text-xs font-bold uppercase mb-2">Cellulare</label>
                                            <div className="relative">
                                                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                                                <input 
                                                    type="text" 
                                                    value={profileForm.phoneNumber || ''} 
                                                    onChange={e => setProfileForm({...profileForm, phoneNumber: e.target.value})} 
                                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:border-slate-500 outline-none" 
                                                    placeholder="333 1234567"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-slate-400 text-xs font-bold uppercase mb-2">WhatsApp</label>
                                            <div className="relative">
                                                <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500" size={18}/>
                                                <input 
                                                    type="text" 
                                                    value={profileForm.whatsappNumber || ''} 
                                                    onChange={e => setProfileForm({...profileForm, whatsappNumber: e.target.value})} 
                                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:border-green-500 outline-none" 
                                                    placeholder="333 1234567"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-slate-400 text-xs font-bold uppercase mb-2">Fisso</label>
                                            <div className="relative">
                                                <PhoneCall className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                                                <input 
                                                    type="text" 
                                                    value={profileForm.landlineNumber || ''} 
                                                    onChange={e => setProfileForm({...profileForm, landlineNumber: e.target.value})} 
                                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:border-slate-500 outline-none" 
                                                    placeholder="02 1234567"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Addresses Section */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-slate-400 text-xs font-bold uppercase mb-2">Indirizzo Sede</label>
                                            <div className="relative">
                                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                                                <input 
                                                    type="text" 
                                                    value={profileForm.address || ''} 
                                                    onChange={e => setProfileForm({...profileForm, address: e.target.value})} 
                                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:border-slate-500 outline-none" 
                                                    placeholder="Via Roma 1, Milano"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-slate-400 text-xs font-bold uppercase mb-2">Indirizzo Fatturazione</label>
                                            <div className="relative">
                                                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                                                <input 
                                                    type="text" 
                                                    value={profileForm.billingAddress || ''} 
                                                    onChange={e => setProfileForm({...profileForm, billingAddress: e.target.value})} 
                                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:border-slate-500 outline-none" 
                                                    placeholder="Se diverso dalla sede..."
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-slate-400 text-xs font-bold uppercase mb-2">Sito Web / Social</label>
                                        <div className="relative">
                                            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                                            <input 
                                                type="text" 
                                                value={profileForm.website || ''} 
                                                onChange={e => setProfileForm({...profileForm, website: e.target.value})} 
                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:border-slate-500 outline-none" 
                                                placeholder="www.ristorante.com"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-800">
                                        <button onClick={handleSaveProfile} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 active:scale-95 transition-all"><Save size={20}/> SALVA PROFILO</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ANALYTICS TAB */}
                        {adminTab === 'analytics' && (
                             <div className="max-w-5xl mx-auto pb-20">
                                <div className="flex justify-between items-center mb-6 bg-slate-900 p-4 rounded-2xl border border-slate-800">
                                    <div><h3 className="text-xl font-bold text-white">Analisi Vendite</h3><p className="text-slate-400 text-sm">Report giornaliero</p></div>
                                    <div className="flex items-center bg-slate-950 rounded-xl p-1 border border-slate-800"><button onClick={() => changeDate(-1)} className="p-3 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><ChevronLeft/></button><div className="px-6 font-bold text-white flex items-center gap-2 uppercase tracking-wide"><Calendar size={18} className="text-orange-500"/> {formatDate(selectedDate)}</div><button onClick={() => changeDate(1)} className="p-3 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><ChevronRight/></button></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800"><div className="flex justify-between items-start mb-2"><div className="p-3 bg-green-900/20 rounded-xl text-green-500"><DollarSign/></div><span className="text-xs font-bold text-slate-500 uppercase">Incasso</span></div><p className="text-3xl font-black text-white">€ {stats.totalRevenue.toFixed(2)}</p></div>
                                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800"><div className="flex justify-between items-start mb-2"><div className="p-3 bg-blue-900/20 rounded-xl text-blue-500"><UtensilsCrossed/></div><span className="text-xs font-bold text-slate-500 uppercase">Piatti</span></div><p className="text-3xl font-black text-white">{stats.totalItems}</p></div>
                                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800"><div className="flex justify-between items-start mb-2"><div className="p-3 bg-purple-900/20 rounded-xl text-purple-500"><History/></div><span className="text-xs font-bold text-slate-500 uppercase">Attesa Media</span></div><p className="text-3xl font-black text-white">{stats.avgWait} <span className="text-base font-medium text-slate-500">min</span></p></div>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800"><h4 className="font-bold text-white mb-6 uppercase text-sm tracking-wider flex items-center gap-2"><BarChart3 size={16} className="text-orange-500"/> Ore di Punta</h4><div className="h-48 flex items-end gap-2">{stats.chartHours.map(d => (<div key={d.hour} className="flex-1 bg-slate-800 rounded-t-sm relative group hover:bg-orange-500 transition-colors" style={{ height: `${(d.count / stats.maxHourly) * 100}%` }}><div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-slate-900 text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">{d.count}</div></div>))}</div><div className="flex justify-between mt-2 text-[10px] text-slate-500 font-mono"><span>00:00</span><span>12:00</span><span>23:00</span></div></div>
                                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800"><h4 className="font-bold text-white mb-6 uppercase text-sm tracking-wider flex items-center gap-2"><Star size={16} className="text-yellow-500"/> Piatti Top</h4><div className="space-y-4">{stats.topDishes.map((d, i) => (<div key={i} className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-700">{i+1}</div><span className="font-bold text-slate-300">{d.name}</span></div><div className="text-right"><span className="block font-black text-white">{d.count}x</span><span className="text-[10px] text-slate-500">€ {d.revenue.toFixed(2)}</span></div></div>))}</div></div>
                                </div>
                                
                                {/* AI ANALYSIS SECTION */}
                                <div className="mt-8 bg-gradient-to-br from-indigo-900/40 to-slate-900 rounded-3xl p-1 border border-indigo-500/30 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[100px] pointer-events-none"></div>
                                    <div className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                                    <Sparkles className="text-indigo-400" size={20}/> 
                                                    <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Analisi AI Avanzata</span>
                                                </h3>
                                                <p className="text-slate-400 text-sm mt-1">Ottieni suggerimenti strategici basati sui dati di oggi.</p>
                                            </div>
                                            {!aiAnalysisResult && (
                                                <button 
                                                    onClick={handleRunAiAnalysis} 
                                                    disabled={isAnalyzing}
                                                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    {isAnalyzing ? <Loader className="animate-spin" size={18}/> : <Bot size={18}/>}
                                                    {isAnalyzing ? 'Analisi in corso...' : 'Genera Report'}
                                                </button>
                                            )}
                                        </div>
                                        
                                        {aiAnalysisResult && (
                                            <div className="bg-slate-950/50 rounded-2xl p-6 border border-indigo-500/20 animate-fade-in relative">
                                                <button onClick={() => setAiAnalysisResult('')} className="absolute top-4 right-4 text-slate-500 hover:text-white p-2 bg-slate-900 rounded-lg"><X size={16}/></button>
                                                <div className="prose prose-invert prose-sm max-w-none">
                                                    <p className="whitespace-pre-wrap font-medium text-slate-200 leading-relaxed">{aiAnalysisResult}</p>
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-indigo-500/10 text-center">
                                                    <p className="text-xs text-indigo-400/70 font-mono flex items-center justify-center gap-1">
                                                        <Bot size={12}/> Analisi generata da Gemini AI
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-8 flex justify-center"><button onClick={handleDeleteDailyHistory} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-900/20 text-red-500 font-bold border border-red-900/50 hover:bg-red-900/40 transition-colors"><Trash2 size={18}/> ELIMINA STORICO DEL GIORNO</button></div>
                             </div>
                        )}

                        {/* AI INTELLIGENCE TAB */}
                        {adminTab === 'ai' && (
                            <div className="max-w-xl mx-auto pb-20">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                    <Bot className="text-indigo-500"/> AI Configuration
                                </h3>
                                <div className="bg-slate-900 p-6 rounded-2xl border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
                                    <p className="text-slate-400 text-sm mb-4">
                                        Inserisci la tua <strong>Google Gemini API Key</strong> per abilitare l'assistente chef intelligente.
                                        L'AI risponderà a domande su ingredienti e allergeni.
                                    </p>
                                    <div className="mb-4">
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">API Key</label>
                                        <div className="relative">
                                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                                            <input 
                                                type="password" 
                                                value={apiKeyInput} 
                                                onChange={(e) => setApiKeyInput(e.target.value)} 
                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:border-indigo-500 outline-none font-mono" 
                                                placeholder="AIzaSy..."
                                            />
                                        </div>
                                    </div>
                                    <button onClick={handleSaveApiKey} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20">
                                        <Save size={18}/> SALVA CHIAVE
                                    </button>
                                    <div className="mt-6 pt-6 border-t border-slate-800 text-center">
                                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 text-xs font-bold hover:text-white flex items-center justify-center gap-1">
                                            Ottieni una chiave gratuita qui <ExternalLink size={12}/>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* NOTIFICATIONS TAB */}
                        {adminTab === 'notif' && (
                            <div className="max-w-md mx-auto">
                                <h3 className="text-xl font-bold text-white mb-6">Impostazioni Notifiche</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-orange-500/20 rounded-lg text-orange-500"><Bell size={20}/></div>
                                            <div><p className="font-bold text-white">Suoni Cucina</p><p className="text-xs text-slate-400">Audio all'arrivo ordini</p></div>
                                        </div>
                                        <button onClick={() => toggleNotif('kitchenSound')} className={`w-12 h-6 rounded-full relative transition-colors ${notifSettings.kitchenSound ? 'bg-green-500' : 'bg-slate-700'}`}><div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${notifSettings.kitchenSound ? 'left-7' : 'left-1'}`}></div></button>
                                    </div>
                                    <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-500"><Smartphone size={20}/></div>
                                            <div><p className="font-bold text-white">Suoni Sala</p><p className="text-xs text-slate-400">Audio piatti pronti</p></div>
                                        </div>
                                        <button onClick={() => toggleNotif('waiterSound')} className={`w-12 h-6 rounded-full relative transition-colors ${notifSettings.waiterSound ? 'bg-green-500' : 'bg-slate-700'}`}><div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${notifSettings.waiterSound ? 'left-7' : 'left-1'}`}></div></button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* INFO / LEGENDA TAB */}
                        {adminTab === 'info' && (
                            <div className="max-w-2xl mx-auto pb-20">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                    <Info className="text-slate-400"/> Legenda Stati & Icone
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
                                        <h4 className="text-slate-400 text-xs font-bold uppercase mb-4 tracking-widest">Stati Ordine</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div><span className="text-white font-bold">In Attesa</span><span className="text-slate-500 text-xs ml-auto">Appena arrivato</span></div>
                                            <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-orange-500"></div><span className="text-white font-bold">In Preparazione</span><span className="text-slate-500 text-xs ml-auto">Preso in carico</span></div>
                                            <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div><span className="text-white font-bold">Pronto</span><span className="text-slate-500 text-xs ml-auto">Da servire</span></div>
                                            <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-slate-500"></div><span className="text-white font-bold">Servito</span><span className="text-slate-500 text-xs ml-auto">Completato</span></div>
                                            <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-red-600 animate-pulse"></div><span className="text-white font-bold">Ritardo Critico</span><span className="text-slate-500 text-xs ml-auto">&gt; 25 min</span></div>
                                        </div>
                                    </div>
                                    <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
                                        <h4 className="text-slate-400 text-xs font-bold uppercase mb-4 tracking-widest">Reparti</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3"><div className="p-2 bg-orange-500/20 rounded text-orange-500"><ChefHat size={16}/></div><span className="text-white font-bold">Cucina</span><span className="text-slate-500 text-xs ml-auto">Colore Arancio</span></div>
                                            <div className="flex items-center gap-3"><div className="p-2 bg-red-500/20 rounded text-red-500"><Pizza size={16}/></div><span className="text-white font-bold">Pizzeria</span><span className="text-slate-500 text-xs ml-auto">Colore Rosso</span></div>
                                            <div className="flex items-center gap-3"><div className="p-2 bg-amber-500/20 rounded text-amber-500"><Sandwich size={16}/></div><span className="text-white font-bold">Pub</span><span className="text-slate-500 text-xs ml-auto">Colore Ambra</span></div>
                                            <div className="flex items-center gap-3"><div className="p-2 bg-blue-500/20 rounded text-blue-500"><Wine size={16}/></div><span className="text-white font-bold">Sala/Bar</span><span className="text-slate-500 text-xs ml-auto">Colore Blu</span></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* ... Modal Editor Piatti and Delete Confirm remain unchanged but are needed ... */}
        {isEditingItem && (
            <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                {/* Editor Content Preserved */}
                <div className="bg-slate-900 border border-orange-500/30 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-slide-up relative">
                    <button onClick={() => setIsEditingItem(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X /></button>
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Edit2 className="text-orange-500"/> {editingItem.id ? 'Modifica Piatto' : 'Nuovo Piatto'}</h2>
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nome Piatto</label><input type="text" value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: capitalize(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-bold" autoFocus /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Prezzo</label><input type="number" value={editingItem.price || ''} onChange={e => setEditingItem({...editingItem, price: parseFloat(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-right" placeholder="0.00" /></div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Categoria</label>
                            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700 overflow-x-auto">
                                {ADMIN_CATEGORY_ORDER.map(cat => (
                                    <button key={cat} onClick={() => setEditingItem({...editingItem, category: cat})} className={`flex-1 py-2 px-3 text-[10px] font-bold uppercase rounded-lg transition-all whitespace-nowrap ${editingItem.category === cat ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{cat}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Descrizione</label>
                            <div className="relative">
                                <textarea value={editingItem.description || ''} onChange={e => setEditingItem({...editingItem, description: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm h-24 resize-none pr-10" placeholder="Ingredienti..." />
                                <button onClick={handleDictation} className={`absolute right-3 bottom-3 p-2 rounded-lg transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>{isListening ? <MicOff size={16}/> : <Mic size={16}/>}</button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Allergeni</label>
                            <div className="flex flex-wrap gap-2">
                                {ALLERGENS_CONFIG.map((alg) => {
                                    const isActive = (editingItem.allergens || []).includes(alg.id);
                                    return (
                                        <button key={alg.id} onClick={() => toggleAllergen(alg.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${isActive ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-500'}`}><alg.icon size={14} /> {alg.label}</button>
                                    );
                                })}
                            </div>
                        </div>
                        <button onClick={handleSaveMenu} className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-600/20 mt-4 flex items-center justify-center gap-2"><Save size={20}/> SALVA PIATTO</button>
                    </div>
                </div>
            </div>
        )}

        {itemToDelete && (
            <div className="absolute inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center">
                    <Trash2 size={48} className="text-red-500 mx-auto mb-4"/>
                    <h3 className="text-xl font-bold text-white mb-2">Eliminare {itemToDelete.name}?</h3>
                    <p className="text-slate-400 text-sm mb-6">Questa azione non può essere annullata.</p>
                    <div className="flex gap-3">
                        <button onClick={() => setItemToDelete(null)} className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold">Annulla</button>
                        <button onClick={confirmDeleteMenu} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-600/20">Elimina</button>
                    </div>
                </div>
            </div>
        )}
      </div>
  );
}