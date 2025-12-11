import React, { useState, useEffect, useMemo, useRef } from 'react';
import KitchenDisplay from './components/KitchenDisplay';
import WaiterPad from './components/WaiterPad';
import AuthScreen from './components/AuthScreen';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import DigitalMenu from './components/DigitalMenu';
import { ChefHat, Smartphone, User, Settings, Bell, Utensils, X, Save, Plus, Trash2, Edit2, Wheat, Milk, Egg, Nut, Fish, Bean, Flame, Leaf, Info, LogOut, Bot, Key, Database, ShieldCheck, Lock, AlertTriangle, Mail, RefreshCw, Send, Printer, Mic, MicOff, TrendingUp, BarChart3, Calendar, ChevronLeft, ChevronRight, DollarSign, History, Receipt, UtensilsCrossed, Eye, ArrowRight, QrCode, Share2, Copy, MapPin, Store, Phone, Globe, Star, Pizza, CakeSlice, Wine, Sandwich, MessageCircle, FileText, PhoneCall, Sparkles, Loader, Facebook, Instagram, Youtube, Linkedin, Music, Compass, FileSpreadsheet, Image as ImageIcon, Upload, FileImage, ExternalLink, CreditCard, Banknote, Briefcase, Clock, Check, ListPlus, ArrowRightLeft, Code2, Cookie, Shield, Wrench, Download, CloudUpload, BookOpen, EyeOff, LayoutGrid, ArrowLeft, PlayCircle, ChevronDown, FileJson, Wallet, Crown, Zap, ShieldCheck as ShieldIcon } from 'lucide-react';
import { getWaiterName, saveWaiterName, getMenuItems, addMenuItem, updateMenuItem, deleteMenuItem, getNotificationSettings, saveNotificationSettings, initSupabaseSync, getGoogleApiKey, saveGoogleApiKey, getAppSettings, saveAppSettings, getOrders, deleteHistoryByDate, performFactoryReset, deleteAllMenuItems, importDemoMenu } from './services/storageService';
import { supabase, signOut, isSupabaseConfigured, SUPER_ADMIN_EMAIL } from './services/supabase';
import { askChefAI, generateRestaurantAnalysis, generateDishDescription, generateDishIngredients } from './services/geminiService';
import { MenuItem, Category, Department, AppSettings, OrderStatus, Order, RestaurantProfile, OrderItem, NotificationSettings } from './types';

const ADMIN_CATEGORY_ORDER = [
    Category.MENU_COMPLETO,
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

export default function App() {
  // ROUTING FOR DIGITAL MENU (Public Access)
  const queryParams = new URLSearchParams(window.location.search);
  const publicMenuId = queryParams.get('menu');

  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [isSuspended, setIsSuspended] = useState(false); 
  const [isBanned, setIsBanned] = useState(false);
  const [accountDeleted, setAccountDeleted] = useState(false);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  
  const [role, setRole] = useState<'kitchen' | 'pizzeria' | 'pub' | 'waiter' | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [waiterNameInput, setWaiterNameInput] = useState('');
  
  // Restaurant Info
  const [restaurantName, setRestaurantName] = useState('Ristorante');

  // Admin State
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState<'profile' | 'subscription' | 'menu' | 'notif' | 'info' | 'ai' | 'analytics' | 'share'>('menu');
  const [adminViewMode, setAdminViewMode] = useState<'dashboard' | 'app'>('dashboard');
  
  // Menu Manager State
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<MenuItem>>({});
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false); 
  const [isGeneratingIngr, setIsGeneratingIngr] = useState(false);
  const [showDeleteAllMenuModal, setShowDeleteAllMenuModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);
  
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
  
  // Dynamic Admin Config (Global)
  const [adminContactEmail, setAdminContactEmail] = useState(SUPER_ADMIN_EMAIL);
  const [adminIban, setAdminIban] = useState('IT73W0623074792000057589384');
  const [adminHolder, setAdminHolder] = useState('Massimo Castro');
  const [adminPhone, setAdminPhone] = useState('3478127440');

  const isSuperAdmin = session?.user?.email === SUPER_ADMIN_EMAIL;

  // --- USE EFFECTS ---

  useEffect(() => {
      if (publicMenuId) { setLoadingSession(false); return; }
      if (!supabase) { setLoadingSession(false); return; }

      const timer = setTimeout(() => { setLoadingSession((prev) => { if (prev) return false; return prev; }); }, 5000); 

      const checkUserStatus = async (user: any) => {
          try {
              const { data } = await supabase.from('profiles').select('restaurant_name, subscription_status, settings').eq('id', user.id).single();
              if (data) {
                  if (data.subscription_status === 'suspended') { setIsSuspended(true); setIsBanned(false); return false; }
                  if (data.subscription_status === 'banned') { setIsBanned(true); setIsSuspended(false); return false; }
                  
                  const plan = data.settings?.restaurantProfile?.planType;
                  const expiry = data.settings?.restaurantProfile?.subscriptionEndDate;
                  
                  if (plan === 'Free' || plan === 'Demo') {
                      setDaysRemaining(null); setSubscriptionExpired(false);
                      if (data.restaurant_name) setRestaurantName(data.restaurant_name);
                      return true;
                  }
                  if (expiry) {
                      const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      setDaysRemaining(days);
                      if (days < 0 && user.email !== SUPER_ADMIN_EMAIL) {
                          setSubscriptionExpired(true); return false; 
                      }
                  }
                  if (data.restaurant_name) setRestaurantName(data.restaurant_name);
                  return true; 
              }
              return true; 
          } catch (e) { return true; }
      };

      supabase.auth.getSession().then(async ({ data: { session } }) => {
          if (session) {
              const isActive = await checkUserStatus(session.user);
              if (isActive) { setSession(session); initSupabaseSync(); } else { setSession(session); }
          } else { setSession(null); }
          setLoadingSession(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (session) { checkUserStatus(session.user); setSession(session); initSupabaseSync(); }
          else { setSession(null); setIsSuspended(false); setIsBanned(false); }
          setLoadingSession(false);
      });
      return () => { clearTimeout(timer); subscription.unsubscribe(); };
  }, [publicMenuId]);

  useEffect(() => {
      const fetchGlobalSettings = async () => {
          if (!supabase) return;
          try {
              const { data: adminProfile } = await supabase
                  .from('profiles')
                  .select('settings')
                  .eq('email', SUPER_ADMIN_EMAIL)
                  .single();
              
              if (adminProfile?.settings?.globalConfig) {
                  const config = adminProfile.settings.globalConfig;
                  if (config.contactEmail) setAdminContactEmail(config.contactEmail);
                  if (config.bankDetails) {
                      if (config.bankDetails.iban) setAdminIban(config.bankDetails.iban);
                      if (config.bankDetails.holder) setAdminHolder(config.bankDetails.holder);
                  }
                  if (config.supportContact?.phone) setAdminPhone(config.supportContact.phone);
              }
          } catch (e) { console.error("Error fetching global settings", e); }
      };
      
      if (showAdmin) {
          setMenuItems(getMenuItems());
          setNotifSettings(getNotificationSettings());
          fetchGlobalSettings();
          const currentSettings = getAppSettings();
          setAppSettingsState(currentSettings); 
          setTempDestinations(currentSettings.categoryDestinations || { [Category.MENU_COMPLETO]: 'Cucina', [Category.ANTIPASTI]: 'Cucina', [Category.PANINI]: 'Pub', [Category.PIZZE]: 'Pizzeria', [Category.PRIMI]: 'Cucina', [Category.SECONDI]: 'Cucina', [Category.DOLCI]: 'Cucina', [Category.BEVANDE]: 'Sala' });
          setTempPrintSettings(currentSettings.printEnabled || { 'Cucina': false, 'Pizzeria': false, 'Pub': false, 'Sala': false, 'Cassa': false });

          // Load Profile Settings
          if (currentSettings.restaurantProfile) {
              setProfileForm(currentSettings.restaurantProfile);
          }
      }
  }, [showAdmin]);

  // --- ACTIONS ---

  const handleCreateAccount = () => { /* Logic in AuthScreen */ };

  const handleLoginWaiter = () => {
      if (waiterNameInput.trim()) {
          saveWaiterName(waiterNameInput);
          setRole('waiter');
      }
  };

  const checkRoleAccess = (selectedRole: string) => {
      if (selectedRole === 'kitchen') setRole('kitchen');
      else if (selectedRole === 'pizzeria') setRole('pizzeria');
      else if (selectedRole === 'pub') setRole('pub');
      else if (selectedRole === 'waiter') {
          const storedName = getWaiterName();
          if (storedName) setRole('waiter');
          else setShowLogin(true);
      }
  };

  const handleLogout = () => {
      // Role Logout
      setRole(null);
      setShowAdmin(false);
  };

  const handleAdminAuth = () => {
      // If session exists, go to admin
      if (session) setShowAdmin(true);
  };

  // --- MENU MANAGEMENT ---
  const handleSaveItem = () => {
      if (!editingItem.name || !editingItem.price) return;
      
      const itemToSave: MenuItem = {
          id: editingItem.id || Date.now().toString(),
          name: editingItem.name,
          price: parseFloat(editingItem.price.toString()),
          category: editingItem.category || Category.ANTIPASTI,
          description: editingItem.description || '',
          ingredients: editingItem.ingredients || '',
          allergens: editingItem.allergens || [],
          image: editingItem.image,
          isCombo: editingItem.category === Category.MENU_COMPLETO,
          comboItems: editingItem.comboItems || [],
          specificDepartment: editingItem.specificDepartment
      };

      if (isEditingItem && editingItem.id) {
          updateMenuItem(itemToSave);
      } else {
          addMenuItem(itemToSave);
      }
      
      setMenuItems(getMenuItems());
      setEditingItem({});
      setIsEditingItem(false);
  };

  const handleDeleteItem = (id: string) => {
      deleteMenuItem(id);
      setMenuItems(getMenuItems());
      setItemToDelete(null);
  };
  
  const confirmDelete = (item: MenuItem) => {
      setItemToDelete(item);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              // Resize image before saving to avoid LocalStorage quota issues
              const img = new Image();
              img.src = reader.result as string;
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  const MAX_WIDTH = 800;
                  const scaleSize = MAX_WIDTH / img.width;
                  canvas.width = MAX_WIDTH;
                  canvas.height = img.height * scaleSize;
                  const ctx = canvas.getContext('2d');
                  ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                  const resizedBase64 = canvas.toDataURL('image/jpeg', 0.7); // Compress
                  setEditingItem(prev => ({ ...prev, image: resizedBase64 }));
              };
          };
          reader.readAsDataURL(file);
      }
  };

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
              try {
                  const data = JSON.parse(evt.target?.result as string);
                  if (Array.isArray(data)) {
                      data.forEach((item: any) => {
                          if (item.name && item.price && item.category) {
                             addMenuItem({
                                 id: Date.now().toString() + Math.random(),
                                 name: item.name,
                                 price: parseFloat(item.price),
                                 category: item.category,
                                 description: item.description,
                                 ingredients: item.ingredients,
                                 allergens: item.allergens || [],
                                 image: item.image,
                                 isCombo: item.category === Category.MENU_COMPLETO,
                                 comboItems: item.comboItems || [],
                                 specificDepartment: item.specificDepartment
                             });
                          }
                      });
                      setMenuItems(getMenuItems());
                      alert(`Importati ${data.length} piatti!`);
                  }
              } catch (err) {
                  alert("Errore nel file JSON");
              }
          };
          reader.readAsText(file);
      }
  };

  const exportMenu = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(menuItems, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "menu_ristosync.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const generateDesc = async () => {
      if (!editingItem.name) return;
      setIsGeneratingDesc(true);
      const desc = await generateDishDescription(editingItem.name, editingItem.ingredients || '');
      if (desc) setEditingItem(prev => ({ ...prev, description: desc }));
      setIsGeneratingDesc(false);
  };
  
  const generateIngr = async () => {
      if (!editingItem.name) return;
      setIsGeneratingIngr(true);
      const ingr = await generateDishIngredients(editingItem.name);
      if (ingr) setEditingItem(prev => ({ ...prev, ingredients: ingr }));
      setIsGeneratingIngr(false);
  };

  const handleDeleteAllMenu = async () => {
      if (confirm("SEI SICURO? Cancellerai TUTTO il menu. Questa azione non è reversibile.")) {
          await deleteAllMenuItems();
          setMenuItems([]);
          setShowDeleteAllMenuModal(false);
      }
  };

  // --- ANALYTICS ---
  const handleGenerateAnalysis = async () => {
      if (ordersForAnalytics.length === 0) {
          setAiAnalysisResult("Nessun dato disponibile per questa data.");
          return;
      }
      setIsAnalyzing(true);
      const stats = {
          totalRevenue: ordersForAnalytics.reduce((acc, o) => acc + o.items.reduce((s, i) => s + i.menuItem.price * i.quantity, 0), 0),
          totalItems: ordersForAnalytics.reduce((acc, o) => acc + o.items.reduce((s, i) => s + i.quantity, 0), 0),
          avgWait: 25, // Mock
          topDishes: ["Carbonara", "Filetto"] // Mock
      };
      const result = await generateRestaurantAnalysis(stats, selectedDate.toLocaleDateString());
      setAiAnalysisResult(result);
      setIsAnalyzing(false);
  };
  
  // --- SETTINGS ---
  const handleSaveNotifSettings = () => {
      saveNotificationSettings(notifSettings);
      alert("Impostazioni salvate!");
  };

  const handleSaveAppSettings = async () => {
      const newSettings: AppSettings = {
          categoryDestinations: tempDestinations,
          printEnabled: tempPrintSettings,
          restaurantProfile: {
              ...appSettings.restaurantProfile,
              ...profileForm // Merge Profile Form Data
          }
      };
      await saveAppSettings(newSettings);
      setAppSettingsState(newSettings);
      setHasUnsavedDestinations(false);
      alert("Configurazione salvata con successo!");
  };

  const handleSaveApiKey = async () => {
      await saveGoogleApiKey(apiKeyInput);
      alert("API Key salvata!");
  };

  const handlePrintQR = () => {
      const url = `${window.location.origin}?menu=${session?.user?.id}`;
      const win = window.open('', '', 'width=600,height=600');
      if (win) {
          win.document.write(`
            <html>
                <head><title>QR Menu</title><style>body{font-family:sans-serif;text-align:center;padding:50px;} h1{font-size:30px;} .url{margin-top:20px;font-size:20px;font-weight:bold;}</style></head>
                <body>
                    <h1>Scansiona per il Menu</h1>
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}" />
                    <div class="url">${restaurantName}</div>
                    <p>Powered by RistoSync</p>
                    <script>window.print();</script>
                </body>
            </html>
          `);
          win.document.close();
      }
  };

  // RENDER LOGIC

  // 1. PUBLIC DIGITAL MENU
  if (publicMenuId) {
      return <DigitalMenu restaurantId={publicMenuId} />;
  }

  // 2. AUTH SCREEN
  if (loadingSession) {
      return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><Loader className="animate-spin text-orange-500" size={48}/></div>;
  }

  if (!session) {
      return <AuthScreen />;
  }

  // 3. SUPER ADMIN DASHBOARD
  if (isSuperAdmin && adminViewMode === 'dashboard') {
      return <SuperAdminDashboard onEnterApp={() => setAdminViewMode('app')} />;
  }

  // 4. SUSPENDED / BANNED SCREENS
  if (isBanned) return (
      <div className="min-h-screen bg-red-950 flex flex-col items-center justify-center text-white p-8 text-center">
          <Shield size={64} className="mb-6 text-red-500" />
          <h1 className="text-4xl font-black mb-4">ACCOUNT BLOCCATO</h1>
          <p className="text-xl mb-8">Il tuo account è stato disabilitato permanentemente per violazione dei termini.</p>
          <button onClick={signOut} className="bg-red-700 hover:bg-red-600 px-8 py-3 rounded-xl font-bold">Esci</button>
      </div>
  );

  if (isSuspended) return (
      <div className="min-h-screen bg-orange-950 flex flex-col items-center justify-center text-white p-8 text-center">
          <Clock size={64} className="mb-6 text-orange-500" />
          <h1 className="text-4xl font-black mb-4">SERVIZIO SOSPESO</h1>
          <p className="text-xl mb-8">Il tuo abbonamento risulta sospeso o scaduto.</p>
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 max-w-md w-full mb-8 text-left">
              <p className="font-bold text-slate-300 mb-2">Contatta l'amministrazione:</p>
              <div className="flex items-center gap-2 text-white mb-1"><Mail size={16} /> {adminContactEmail}</div>
              <div className="flex items-center gap-2 text-white"><PhoneCall size={16} /> {adminPhone}</div>
          </div>
          <p className="text-sm text-slate-400 mb-8">Effettua il bonifico all'IBAN: <span className="font-mono text-white block mt-1 bg-black/30 p-2 rounded select-all">{adminIban}</span> Intestato a: {adminHolder}</p>
          <button onClick={signOut} className="bg-orange-600 hover:bg-orange-500 px-8 py-3 rounded-xl font-bold">Esci</button>
      </div>
  );

  // 5. ROLE SELECTION (HOME)
  if (!role && !showAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col font-sans relative overflow-hidden">
        {/* BACKGROUND EFFECTS */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 to-slate-950 pointer-events-none"></div>
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-orange-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>

        {/* HEADER */}
        <div className="relative z-10 flex justify-between items-center mb-12">
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-600/20 transform rotate-3">
                    <ChefHat size={36} className="text-white drop-shadow-md" />
                </div>
                <div>
                    <h1 className="text-4xl font-black tracking-tight flex items-center gap-2">
                        Risto<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">Sync</span>
                        <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-md border border-slate-700 font-mono tracking-widest">PRO</span>
                    </h1>
                    <p className="text-slate-400 font-medium text-sm mt-1 flex items-center gap-2">
                        {restaurantName} <span className="w-1 h-1 bg-slate-500 rounded-full"></span> {new Date().toLocaleDateString()}
                    </p>
                </div>
            </div>
            
            <div className="flex gap-4">
                <button 
                    onClick={handleAdminAuth} 
                    className="group bg-slate-800 hover:bg-slate-700 p-4 rounded-2xl transition-all duration-300 border border-slate-700 hover:border-slate-500 flex flex-col items-center gap-1 shadow-lg active:scale-95"
                    title="Impostazioni Admin"
                >
                    <Settings className="text-slate-400 group-hover:text-white group-hover:rotate-45 transition-transform" size={24} />
                    <span className="text-[10px] uppercase font-bold text-slate-500 group-hover:text-slate-300">Admin</span>
                </button>
                <button 
                    onClick={signOut} 
                    className="group bg-slate-800 hover:bg-red-900/20 p-4 rounded-2xl transition-all duration-300 border border-slate-700 hover:border-red-500/50 flex flex-col items-center gap-1 shadow-lg active:scale-95"
                    title="Esci"
                >
                    <LogOut className="text-slate-400 group-hover:text-red-400" size={24} />
                    <span className="text-[10px] uppercase font-bold text-slate-500 group-hover:text-red-400">Esci</span>
                </button>
            </div>
        </div>

        {/* SUBSCRIPTION BANNER */}
        {subscriptionExpired && (
            <div className="relative z-10 mb-8 bg-red-600/10 border border-red-500/30 p-4 rounded-2xl flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-3 text-red-400 font-bold">
                    <AlertTriangle size={24}/>
                    <span>Abbonamento Scaduto! Rinnova per continuare a usare tutte le funzioni.</span>
                </div>
                <button onClick={() => setShowAdmin(true)} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-500">Rinnova</button>
            </div>
        )}

        {daysRemaining !== null && daysRemaining <= 5 && !subscriptionExpired && (
            <div className="relative z-10 mb-8 bg-orange-600/10 border border-orange-500/30 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3 text-orange-400 font-bold">
                    <Clock size={24}/>
                    <span>Abbonamento in scadenza tra {daysRemaining} giorni.</span>
                </div>
                <button onClick={() => setShowAdmin(true)} className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-orange-500">Gestisci</button>
            </div>
        )}

        {/* ROLE CARDS */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {/* WAITER CARD */}
          <button onClick={() => checkRoleAccess('waiter')} className="group relative h-80 bg-slate-800 rounded-[2rem] border border-slate-700 p-8 flex flex-col items-center justify-center gap-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-500/50 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center border-2 border-slate-700 group-hover:border-blue-500 group-hover:scale-110 transition-all shadow-inner">
              <Smartphone size={40} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
            </div>
            <div className="text-center relative z-10">
              <h2 className="text-2xl font-black text-white mb-2 group-hover:text-blue-400 transition-colors">SALA</h2>
              <p className="text-slate-400 text-sm font-medium">Prendi comande al tavolo</p>
            </div>
          </button>

          {/* KITCHEN CARD */}
          <button onClick={() => checkRoleAccess('kitchen')} className="group relative h-80 bg-slate-800 rounded-[2rem] border border-slate-700 p-8 flex flex-col items-center justify-center gap-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-orange-500/10 hover:border-orange-500/50 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-orange-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center border-2 border-slate-700 group-hover:border-orange-500 group-hover:scale-110 transition-all shadow-inner">
              <ChefHat size={40} className="text-slate-400 group-hover:text-orange-500 transition-colors" />
            </div>
            <div className="text-center relative z-10">
              <h2 className="text-2xl font-black text-white mb-2 group-hover:text-orange-400 transition-colors">CUCINA</h2>
              <p className="text-slate-400 text-sm font-medium">Gestisci ordini food</p>
            </div>
          </button>

          {/* PIZZERIA CARD */}
          <button onClick={() => checkRoleAccess('pizzeria')} className="group relative h-80 bg-slate-800 rounded-[2rem] border border-slate-700 p-8 flex flex-col items-center justify-center gap-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-red-500/10 hover:border-red-500/50 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-red-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center border-2 border-slate-700 group-hover:border-red-500 group-hover:scale-110 transition-all shadow-inner">
              <Pizza size={40} className="text-slate-400 group-hover:text-red-500 transition-colors" />
            </div>
            <div className="text-center relative z-10">
              <h2 className="text-2xl font-black text-white mb-2 group-hover:text-red-400 transition-colors">PIZZERIA</h2>
              <p className="text-slate-400 text-sm font-medium">Ordini forno e pizze</p>
            </div>
          </button>

          {/* PUB/BAR CARD */}
          <button onClick={() => checkRoleAccess('pub')} className="group relative h-80 bg-slate-800 rounded-[2rem] border border-slate-700 p-8 flex flex-col items-center justify-center gap-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-amber-500/10 hover:border-amber-500/50 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-amber-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center border-2 border-slate-700 group-hover:border-amber-500 group-hover:scale-110 transition-all shadow-inner">
              <Sandwich size={40} className="text-slate-400 group-hover:text-amber-500 transition-colors" />
            </div>
            <div className="text-center relative z-10">
              <h2 className="text-2xl font-black text-white mb-2 group-hover:text-amber-400 transition-colors">PUB / BAR</h2>
              <p className="text-slate-400 text-sm font-medium">Panini e Bevande</p>
            </div>
          </button>
        </div>

        {/* WAITER LOGIN MODAL */}
        {showLogin && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-slate-900 border border-slate-700 p-8 rounded-[2rem] shadow-2xl w-full max-w-sm relative animate-slide-up">
                    <button onClick={() => setShowLogin(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <User size={32} className="text-blue-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">Chi sei?</h2>
                        <p className="text-slate-400 text-sm mt-1">Inserisci il tuo nome per iniziare</p>
                    </div>
                    <input 
                        type="text" 
                        value={waiterNameInput}
                        onChange={(e) => setWaiterNameInput(e.target.value)}
                        placeholder="Es. Marco"
                        className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-4 rounded-xl mb-4 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-bold text-center text-lg"
                        autoFocus
                    />
                    <button onClick={handleLoginWaiter} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">
                        Inizia Turno <ArrowRight size={20} />
                    </button>
                </div>
            </div>
        )}
      </div>
    );
  }

  // 6. OPERATIONAL SCREENS
  if (role === 'kitchen') return <KitchenDisplay onExit={() => setRole(null)} department="Cucina" />;
  if (role === 'pizzeria') return <KitchenDisplay onExit={() => setRole(null)} department="Pizzeria" />;
  if (role === 'pub') return <KitchenDisplay onExit={() => setRole(null)} department="Pub" />;
  if (role === 'waiter') return <WaiterPad onExit={() => setRole(null)} />;

  // 7. ADMIN PANEL
  if (showAdmin) {
      return (
          <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col md:flex-row">
              
              {/* ADMIN SIDEBAR */}
              <div className="w-full md:w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 h-screen sticky top-0">
                  <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center shadow-lg">
                          <ChefHat size={20} className="text-white" />
                      </div>
                      <h1 className="font-black text-xl tracking-tight">Risto<span className="text-orange-500">Sync</span></h1>
                  </div>
                  
                  <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                      <button onClick={() => setAdminTab('profile')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${adminTab === 'profile' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                          <Store size={18} /> Profilo Ristorante
                      </button>
                      <button onClick={() => setAdminTab('menu')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${adminTab === 'menu' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                          <Utensils size={18} /> Gestione Menu
                      </button>
                      <button onClick={() => setAdminTab('subscription')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${adminTab === 'subscription' ? 'bg-green-600 text-white shadow-lg shadow-green-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                          <CreditCard size={18} /> Abbonamento
                      </button>
                      <button onClick={() => setAdminTab('analytics')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${adminTab === 'analytics' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                          <BarChart3 size={18} /> Statistiche
                      </button>
                      <button onClick={() => setAdminTab('ai')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${adminTab === 'ai' ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                          <Bot size={18} /> AI Intelligence
                      </button>
                      <button onClick={() => setAdminTab('info')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${adminTab === 'info' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                          <Settings size={18} /> Configurazione
                      </button>
                  </nav>

                  <div className="p-4 border-t border-slate-800">
                       <button onClick={() => setShowAdmin(false)} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl font-bold transition-colors">
                           <ArrowLeft size={18}/> Torna alla Home
                       </button>
                  </div>
              </div>

              {/* MAIN CONTENT AREA */}
              <div className="flex-1 h-screen overflow-y-auto bg-slate-950 p-6 md:p-10">
                  
                  {/* --- TAB: MENU MANAGER --- */}
                  {adminTab === 'menu' && (
                      <div className="max-w-6xl mx-auto animate-fade-in">
                          <div className="flex justify-between items-center mb-8">
                              <div>
                                  <h2 className="text-3xl font-black text-white mb-2">Gestione Menu</h2>
                                  <p className="text-slate-400">Aggiungi, modifica o rimuovi piatti dal tuo menu digitale.</p>
                              </div>
                              <div className="flex gap-3">
                                  <button onClick={handlePrintQR} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-xl font-bold flex items-center gap-2 border border-slate-700 transition-colors"><QrCode size={18}/> Stampa QR</button>
                                  <button onClick={() => { setEditingItem({}); setIsEditingItem(false); }} className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-orange-600/20 transition-transform active:scale-95"><Plus size={20}/> Nuovo Piatto</button>
                              </div>
                          </div>
                          
                          {/* QUICK ACTIONS */}
                          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex gap-4 mb-8 overflow-x-auto">
                              <button onClick={() => bulkInputRef.current?.click()} className="flex items-center gap-2 bg-blue-600/20 text-blue-400 px-4 py-2 rounded-lg font-bold hover:bg-blue-600/30 transition-colors whitespace-nowrap"><Upload size={16}/> Importa JSON</button>
                              <input type="file" ref={bulkInputRef} onChange={handleBulkImport} accept=".json" className="hidden" />
                              <button onClick={exportMenu} className="flex items-center gap-2 bg-green-600/20 text-green-400 px-4 py-2 rounded-lg font-bold hover:bg-green-600/30 transition-colors whitespace-nowrap"><Download size={16}/> Esporta JSON</button>
                              <button onClick={importDemoMenu} className="flex items-center gap-2 bg-purple-600/20 text-purple-400 px-4 py-2 rounded-lg font-bold hover:bg-purple-600/30 transition-colors whitespace-nowrap"><Sparkles size={16}/> Carica Menu Demo</button>
                              <button onClick={() => setShowDeleteAllMenuModal(true)} className="flex items-center gap-2 bg-red-600/20 text-red-400 px-4 py-2 rounded-lg font-bold hover:bg-red-600/30 transition-colors whitespace-nowrap ml-auto"><Trash2 size={16}/> Svuota Menu</button>
                          </div>

                          {/* EDITOR FORM */}
                          <div className="bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-800 shadow-2xl mb-10 relative overflow-hidden">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                                  <div className="space-y-4">
                                      <div>
                                          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nome Piatto</label>
                                          <input type="text" placeholder="Es. Spaghetti Carbonara" value={editingItem.name || ''} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-orange-500 outline-none transition-colors" />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                          <div>
                                              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Prezzo (€)</label>
                                              <input type="number" placeholder="0.00" value={editingItem.price || ''} onChange={e => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) })} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono font-bold focus:border-orange-500 outline-none transition-colors" />
                                          </div>
                                          <div>
                                              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Categoria</label>
                                              <select value={editingItem.category || Category.ANTIPASTI} onChange={e => setEditingItem({ ...editingItem, category: e.target.value as Category })} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-orange-500 outline-none transition-colors appearance-none">
                                                  {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                                              </select>
                                          </div>
                                      </div>
                                      
                                      {/* COMBO SELECTION LOGIC */}
                                      {editingItem.category === Category.MENU_COMPLETO && (
                                          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                              <label className="text-xs font-bold text-orange-400 uppercase mb-2 block flex items-center gap-2"><ListPlus size={14}/> Seleziona Piatti Inclusi</label>
                                              <div className="max-h-40 overflow-y-auto custom-scroll space-y-2">
                                                  {menuItems.filter(i => i.category !== Category.MENU_COMPLETO).map(opt => (
                                                      <label key={opt.id} className="flex items-center gap-3 p-2 hover:bg-slate-700 rounded-lg cursor-pointer">
                                                          <input 
                                                              type="checkbox" 
                                                              checked={editingItem.comboItems?.includes(opt.id) || false}
                                                              onChange={(e) => {
                                                                  const current = editingItem.comboItems || [];
                                                                  if (e.target.checked) setEditingItem({ ...editingItem, comboItems: [...current, opt.id] });
                                                                  else setEditingItem({ ...editingItem, comboItems: current.filter(id => id !== opt.id) });
                                                              }}
                                                              className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-orange-500 focus:ring-orange-500"
                                                          />
                                                          <span className="text-sm text-slate-300">{opt.name}</span>
                                                      </label>
                                                  ))}
                                              </div>
                                          </div>
                                      )}

                                      {/* SPECIFIC DESTINATION OVERRIDE */}
                                      <div>
                                          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block flex items-center gap-2"><MapPin size={12}/> Destinazione Specifica (Opzionale)</label>
                                          <select value={editingItem.specificDepartment || ''} onChange={e => setEditingItem({ ...editingItem, specificDepartment: e.target.value as Department | undefined })} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-300 text-sm focus:border-blue-500 outline-none transition-colors">
                                              <option value="">Usa Default Categoria</option>
                                              <option value="Cucina">Cucina</option>
                                              <option value="Pizzeria">Pizzeria</option>
                                              <option value="Pub">Pub</option>
                                              <option value="Sala">Sala (Bar)</option>
                                          </select>
                                      </div>
                                  </div>

                                  <div className="space-y-4">
                                      <div>
                                          <div className="flex justify-between items-center mb-1">
                                              <label className="text-xs font-bold text-slate-500 uppercase">Ingredienti</label>
                                              <button onClick={generateIngr} disabled={isGeneratingIngr || !editingItem.name} className="text-[10px] bg-purple-600/20 text-purple-400 px-2 py-1 rounded hover:bg-purple-600/30 transition-colors flex items-center gap-1 disabled:opacity-50"><Sparkles size={10}/> AI MAGIC</button>
                                          </div>
                                          <textarea placeholder="Elenco ingredienti..." value={editingItem.ingredients || ''} onChange={e => setEditingItem({ ...editingItem, ingredients: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm min-h-[80px] focus:border-orange-500 outline-none transition-colors resize-none" />
                                      </div>
                                      <div>
                                          <div className="flex justify-between items-center mb-1">
                                              <label className="text-xs font-bold text-slate-500 uppercase">Descrizione</label>
                                              <button onClick={generateDesc} disabled={isGeneratingDesc || !editingItem.name} className="text-[10px] bg-purple-600/20 text-purple-400 px-2 py-1 rounded hover:bg-purple-600/30 transition-colors flex items-center gap-1 disabled:opacity-50"><Sparkles size={10}/> AI MAGIC</button>
                                          </div>
                                          <textarea placeholder="Descrizione del piatto..." value={editingItem.description || ''} onChange={e => setEditingItem({ ...editingItem, description: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm min-h-[80px] focus:border-orange-500 outline-none transition-colors resize-none" />
                                      </div>
                                      
                                      <div>
                                          <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Allergeni</label>
                                          <div className="flex flex-wrap gap-2">
                                              {ALLERGENS_CONFIG.map(alg => (
                                                  <button 
                                                      key={alg.id}
                                                      onClick={() => {
                                                          const current = editingItem.allergens || [];
                                                          if (current.includes(alg.id)) setEditingItem({ ...editingItem, allergens: current.filter(a => a !== alg.id) });
                                                          else setEditingItem({ ...editingItem, allergens: [...current, alg.id] });
                                                      }}
                                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${editingItem.allergens?.includes(alg.id) ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-slate-950 text-slate-500 border border-slate-800 hover:border-slate-600'}`}
                                                  >
                                                      <alg.icon size={12}/> {alg.label}
                                                  </button>
                                              ))}
                                          </div>
                                      </div>

                                      <div className="flex items-center gap-4">
                                          <div className="relative w-20 h-20 bg-slate-950 rounded-xl border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 group">
                                              {editingItem.image ? <img src={editingItem.image} alt="Preview" className="w-full h-full object-cover" /> : <ImageIcon className="text-slate-600" size={24} />}
                                              <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                                              <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"><Upload className="text-white" size={20}/></div>
                                          </div>
                                          <div className="flex-1">
                                              <p className="text-xs text-slate-500 mb-2">Carica foto del piatto (max 1MB). Formato quadrato consigliato.</p>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                              
                              <div className="mt-8 pt-6 border-t border-slate-800 flex justify-end gap-3 relative z-10">
                                  <button onClick={() => { setEditingItem({}); setIsEditingItem(false); }} className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">Annulla</button>
                                  <button onClick={handleSaveItem} disabled={!editingItem.name || !editingItem.price} className="px-8 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-orange-600/20 transition-all active:scale-95 flex items-center gap-2">
                                      <Save size={18}/> {isEditingItem ? 'Aggiorna Piatto' : 'Salva Piatto'}
                                  </button>
                              </div>
                          </div>

                          {/* MENU LIST */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {menuItems.map(item => (
                                  <div key={item.id} className="bg-slate-900 rounded-2xl border border-slate-800 p-5 hover:border-slate-600 transition-all group relative overflow-hidden">
                                      <div className="flex justify-between items-start mb-3">
                                          <div className="flex gap-3">
                                              {item.image && <div className="w-12 h-12 rounded-lg bg-slate-800 overflow-hidden shrink-0"><img src={item.image} className="w-full h-full object-cover"/></div>}
                                              <div>
                                                  <h3 className="font-bold text-white text-lg leading-tight">{item.name}</h3>
                                                  <p className="text-orange-400 font-mono font-bold">€ {item.price.toFixed(2)}</p>
                                              </div>
                                          </div>
                                          <span className="text-[10px] font-bold uppercase bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-700">{item.category}</span>
                                      </div>
                                      <div className="flex justify-end gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => { setEditingItem(item); setIsEditingItem(true); window.scrollTo({top:0, behavior:'smooth'}); }} className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"><Edit2 size={16}/></button>
                                          <button onClick={() => confirmDelete(item)} className="p-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition-colors"><Trash2 size={16}/></button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
                  
                  {/* --- TAB: PROFILE --- */}
                  {adminTab === 'profile' && (
                      <div className="max-w-4xl mx-auto animate-fade-in">
                          <h2 className="text-3xl font-black text-white mb-8">Profilo Ristorante</h2>
                          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-8">
                              {/* ANAGRAFICA */}
                              <div>
                                  <h3 className="text-sm font-bold text-orange-500 uppercase mb-4 flex items-center gap-2"><Store size={16}/> Dati Generali</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div><label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Nome Insegna</label><input type="text" value={profileForm.name || ''} onChange={e => setProfileForm({...profileForm, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-bold"/></div>
                                      <div><label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Numero Tavoli</label><input type="number" value={profileForm.tableCount || 12} onChange={e => setProfileForm({...profileForm, tableCount: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono font-bold"/></div>
                                      <div><label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Ragione Sociale</label><input type="text" value={profileForm.businessName || ''} onChange={e => setProfileForm({...profileForm, businessName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white"/></div>
                                      <div><label className="text-xs text-slate-500 font-bold uppercase mb-1 block">P.IVA</label><input type="text" value={profileForm.vatNumber || ''} onChange={e => setProfileForm({...profileForm, vatNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono"/></div>
                                  </div>
                              </div>
                              
                              {/* SOCIALS */}
                              <div>
                                  <h3 className="text-sm font-bold text-blue-500 uppercase mb-4 flex items-center gap-2"><Share2 size={16}/> Social Links</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl px-3"><Instagram size={16} className="text-pink-500"/><input type="text" placeholder="Instagram URL" value={profileForm.socials?.instagram || ''} onChange={e => setProfileForm({...profileForm, socials: {...profileForm.socials, instagram: e.target.value}})} className="bg-transparent border-none text-white text-sm p-3 w-full outline-none"/></div>
                                      <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl px-3"><Facebook size={16} className="text-blue-600"/><input type="text" placeholder="Facebook URL" value={profileForm.socials?.facebook || ''} onChange={e => setProfileForm({...profileForm, socials: {...profileForm.socials, facebook: e.target.value}})} className="bg-transparent border-none text-white text-sm p-3 w-full outline-none"/></div>
                                      <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl px-3"><Store size={16} className="text-blue-400"/><input type="text" placeholder="Google Business URL" value={profileForm.socials?.google || ''} onChange={e => setProfileForm({...profileForm, socials: {...profileForm.socials, google: e.target.value}})} className="bg-transparent border-none text-white text-sm p-3 w-full outline-none"/></div>
                                      <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl px-3"><Compass size={16} className="text-green-500"/><input type="text" placeholder="TripAdvisor URL" value={profileForm.socials?.tripadvisor || ''} onChange={e => setProfileForm({...profileForm, socials: {...profileForm.socials, tripadvisor: e.target.value}})} className="bg-transparent border-none text-white text-sm p-3 w-full outline-none"/></div>
                                  </div>
                              </div>

                              <div className="flex justify-end pt-6 border-t border-slate-800">
                                  <button onClick={handleSaveAppSettings} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 transition-all"><Save size={18}/> Salva Profilo</button>
                              </div>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      );
  }
  
  return null;
}