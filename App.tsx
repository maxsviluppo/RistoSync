import React, { useState, useEffect, useMemo, useRef } from 'react';
import KitchenDisplay from './components/KitchenDisplay';
import WaiterPad from './components/WaiterPad';
import AuthScreen from './components/AuthScreen';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import DigitalMenu from './components/DigitalMenu';
import { ChefHat, Smartphone, User, Settings, Bell, Utensils, X, Save, Plus, Trash2, Edit2, Wheat, Milk, Egg, Nut, Fish, Bean, Flame, Leaf, Info, LogOut, Bot, Key, Database, ShieldCheck, Lock, AlertTriangle, Mail, RefreshCw, Send, Printer, Mic, MicOff, TrendingUp, BarChart3, Calendar, ChevronLeft, ChevronRight, DollarSign, History, Receipt, UtensilsCrossed, Eye, ArrowRight, QrCode, Share2, Copy, MapPin, Store, Phone, Globe, Star, Pizza, CakeSlice, Wine, Sandwich, MessageCircle, FileText, PhoneCall, Sparkles, Loader, Facebook, Instagram, Youtube, Linkedin, Music, Compass, FileSpreadsheet, Image as ImageIcon, Upload, FileImage, ExternalLink, CreditCard, Banknote, Briefcase, Clock, Check, ListPlus, ArrowRightLeft, Code2, Cookie, Shield, Wrench, Download, CloudUpload, BookOpen, EyeOff, LayoutGrid, ArrowLeft, PlayCircle, ChevronDown, FileJson, Wallet, Crown, Zap, ShieldCheck as ShieldIcon, Trophy, Timer, LifeBuoy, Minus, Hash } from 'lucide-react';
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
  // RESTORED ALL TABS
  const [adminTab, setAdminTab] = useState<'profile' | 'subscription' | 'menu' | 'notif' | 'info' | 'ai' | 'analytics' | 'share'>('menu');
  const [adminViewMode, setAdminViewMode] = useState<'dashboard' | 'app'>('dashboard');
  
  // Menu Manager State
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<MenuItem>>({});
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false); 
  const [isGeneratingIngr, setIsGeneratingIngr] = useState(false);
  const [showDeleteAllMenuModal, setShowDeleteAllMenuModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const bulkImagesRef = useRef<HTMLInputElement>(null); // New Ref for Bulk Images
  
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
                      const expiryDate = new Date(expiry);
                      expiryDate.setHours(23, 59, 59, 999);
                      const now = new Date();
                      const diffTime = expiryDate.getTime() - now.getTime();
                      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      setDaysRemaining(days);
                      if (diffTime < 0 && user.email !== SUPER_ADMIN_EMAIL) {
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
          // Load Orders for Analytics
          setOrdersForAnalytics(getOrders());
          // Load API Key
          const key = getGoogleApiKey();
          if (key) setApiKeyInput(key);
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
              const img = new Image();
              img.src = reader.result as string;
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  const MAX_WIDTH = 1024; // Increased quality
                  let width = img.width;
                  let height = img.height;

                  if (width > MAX_WIDTH) {
                      height *= MAX_WIDTH / width;
                      width = MAX_WIDTH;
                  }

                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  ctx?.drawImage(img, 0, 0, width, height);
                  
                  const resizedBase64 = canvas.toDataURL('image/jpeg', 0.6); 
                  setEditingItem(prev => ({ ...prev, image: resizedBase64 }));
              };
          };
          reader.readAsDataURL(file);
      }
  };

  // --- NUOVA FUNZIONE IMPORT FOTO MASSIVO ---
  const handleBulkImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const files = Array.from(e.target.files) as File[];
      let updatedCount = 0;
      const currentMenu = getMenuItems(); // Get fresh
      let hasUpdates = false;

      // Create a map for faster lookup: "carbonara" -> itemIndex
      const menuMap = new Map();
      currentMenu.forEach((item, index) => {
          menuMap.set(item.name.toLowerCase().trim().replace(/[-_]/g, ' '), index);
      });

      for (const file of files) {
          // Normalize filename: "Carbonara.jpg" -> "carbonara"
          const cleanName = file.name.split('.')[0].toLowerCase().trim().replace(/[-_]/g, ' ');
          
          if (menuMap.has(cleanName)) {
              const index = menuMap.get(cleanName);
              
              // Process Image
              const reader = new FileReader();
              await new Promise((resolve) => {
                  reader.onload = (evt) => {
                      const img = new Image();
                      img.src = evt.target?.result as string;
                      img.onload = () => {
                          const canvas = document.createElement('canvas');
                          const MAX_WIDTH = 800;
                          let width = img.width;
                          let height = img.height;
                          if (width > MAX_WIDTH) {
                              height *= MAX_WIDTH / width;
                              width = MAX_WIDTH;
                          }
                          canvas.width = width;
                          canvas.height = height;
                          const ctx = canvas.getContext('2d');
                          ctx?.drawImage(img, 0, 0, width, height);
                          const resizedBase64 = canvas.toDataURL('image/jpeg', 0.6);
                          
                          // Update Item
                          currentMenu[index].image = resizedBase64;
                          updateMenuItem(currentMenu[index]); // This handles Cloud Sync internally per item
                          updatedCount++;
                          hasUpdates = true;
                          resolve(null);
                      }
                  };
                  reader.readAsDataURL(file);
              });
          }
      }

      if (hasUpdates) {
          setMenuItems(getMenuItems()); // Refresh state
          alert(`✅ Completato! Associate ${updatedCount} immagini ai piatti.`);
      } else {
          alert("⚠️ Nessuna immagine corrispondeva ai nomi dei piatti nel menu.");
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
      if (confirm("🔴 ATTENZIONE: Stai per eliminare TUTTI i piatti dal menu.\n\nQuesta azione non è reversibile. Confermi?")) {
          await deleteAllMenuItems();
          setMenuItems([]);
          setShowDeleteAllMenuModal(false);
      }
  };

  // --- TABLE COUNT MANAGER ---
  const handleUpdateTableCount = async (increment: number) => {
      const current = appSettings.restaurantProfile?.tableCount || 12;
      const newCount = Math.max(1, current + increment);
      
      const newSettings = {
          ...appSettings,
          restaurantProfile: {
              ...appSettings.restaurantProfile,
              tableCount: newCount
          }
      };
      
      // Update Local State
      setAppSettingsState(newSettings);
      setProfileForm(prev => ({ ...prev, tableCount: newCount }));
      
      // Persist
      await saveAppSettings(newSettings);
  };

  // --- ANALYTICS METRICS ---
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
  
  // Calculate Analytics Data
  const analyticsData = useMemo(() => {
      const dailyOrders = ordersForAnalytics.filter(o => {
          const d = new Date(o.createdAt || o.timestamp);
          return d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear() && o.status === OrderStatus.DELIVERED;
      });

      const revenue = dailyOrders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + (i.menuItem.price * i.quantity), 0), 0);
      const totalDishes = dailyOrders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0), 0);
      const avgOrder = dailyOrders.length ? (revenue / dailyOrders.length) : 0;

      // TOP ITEMS
      const itemCounts: Record<string, number> = {};
      dailyOrders.forEach(o => o.items.forEach(i => { itemCounts[i.menuItem.name] = (itemCounts[i.menuItem.name] || 0) + i.quantity; }));
      const topItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

      // PEAK HOUR
      const hourCounts: Record<number, number> = {};
      dailyOrders.forEach(o => { const h = new Date(o.createdAt || o.timestamp).getHours(); hourCounts[h] = (hourCounts[h] || 0) + 1; });
      const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];

      return { revenue, totalDishes, avgOrder, topItems, peakHour };
  }, [ordersForAnalytics, selectedDate]);

  // --- SETTINGS & SHARE ---
  const handleSaveNotifSettings = () => {
      saveNotificationSettings(notifSettings);
      alert("Impostazioni salvate!");
  };

  const saveDestinations = async () => { 
      const newSettings: AppSettings = { ...appSettings, categoryDestinations: tempDestinations, printEnabled: tempPrintSettings }; 
      await saveAppSettings(newSettings); 
      setAppSettingsState(newSettings); 
      setHasUnsavedDestinations(false); 
      alert("Impostazioni salvate con successo!"); 
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

  const digitalMenuLink = session?.user?.id ? `${window.location.origin}?menu=${session.user.id}` : '';
  const qrCodeUrl = digitalMenuLink ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(digitalMenuLink)}` : '';
  
  const copyToClipboard = () => { navigator.clipboard.writeText(digitalMenuLink); alert("Link copiato!"); };
  const shareLink = () => {
      if (navigator.share) {
          navigator.share({ title: restaurantName, text: 'Guarda il nostro menu!', url: digitalMenuLink }).catch(console.error);
      } else {
          copyToClipboard();
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
    // PREPARE SUB TEXT
    const planLabel = appSettings.restaurantProfile?.planType || 'Pro';
    const isFreePlan = planLabel === 'Free' || planLabel === 'Demo';
    
    let subText = "Licenza Attiva";
    let subColor = "text-emerald-400";

    if (subscriptionExpired) {
        subText = "Abbonamento Scaduto";
        subColor = "text-red-500 animate-pulse";
    } else if (daysRemaining !== null) {
        subText = `${daysRemaining} Giorni Rimasti`;
        if (daysRemaining <= 5) subColor = "text-orange-400";
    } else if (isFreePlan) {
        subText = "Versione Gratuita";
        subColor = "text-blue-400";
    }

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
                        <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-md border border-slate-700 font-mono tracking-widest uppercase">
                            {planLabel}
                        </span>
                    </h1>
                    <p className="text-slate-400 font-medium text-sm mt-1 flex items-center gap-2">
                        {restaurantName} <span className="w-1 h-1 bg-slate-500 rounded-full"></span> {new Date().toLocaleDateString()}
                    </p>
                    <p className={`text-xs font-bold uppercase tracking-wider mt-1 ${subColor} flex items-center gap-1`}>
                       {subscriptionExpired ? <AlertTriangle size={10}/> : <Clock size={10}/>} {subText}
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

        {/* SUBSCRIPTION BANNER (ONLY FOR CRITICAL) */}
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
              
              {/* ADMIN SIDEBAR (RESTORED TABS) */}
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
                      <button onClick={() => setAdminTab('share')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${adminTab === 'share' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                          <QrCode size={18} /> Menu Digitale
                      </button>
                      <button onClick={() => setAdminTab('notif')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${adminTab === 'notif' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                          <Bell size={18} /> Notifiche & Reparti
                      </button>
                      <button onClick={() => setAdminTab('subscription')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${adminTab === 'subscription' ? 'bg-green-600 text-white shadow-lg shadow-green-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                          <CreditCard size={18} /> Abbonamento
                      </button>
                      <button onClick={() => setAdminTab('analytics')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${adminTab === 'analytics' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                          <BarChart3 size={18} /> Statistiche
                      </button>
                      <button onClick={() => setAdminTab('ai')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${adminTab === 'ai' ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                          <Bot size={18} /> AI Intelligence
                      </button>
                      <button onClick={() => setAdminTab('info')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${adminTab === 'info' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                          <Info size={18} /> Info & Supporto
                      </button>
                  </nav>

                  <div className="p-4 border-t border-slate-800">
                       <button onClick={() => setShowAdmin(false)} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl font-bold transition-colors">
                           <ArrowLeft size={18}/> Torna alla Home
                       </button>
                  </div>
              </div>

              {/* MAIN CONTENT AREA */}
              <div className="flex-1 h-screen overflow-y-auto bg-slate-950 p-6 md:p-10 custom-scroll">
                  
                  {/* --- TAB: MENU MANAGER (REDESIGNED) --- */}
                  {adminTab === 'menu' && (
                      <div className="max-w-6xl mx-auto animate-fade-in">
                          <div className="flex justify-between items-center mb-8">
                              <div>
                                  <h2 className="text-3xl font-black text-white mb-2">Gestione Menu</h2>
                                  <p className="text-slate-400">Aggiungi, modifica o rimuovi piatti dal tuo menu digitale.</p>
                              </div>
                              <div className="flex gap-3">
                                  {/* NEW DISH BUTTON RESTORED TO PROMINENT POSITION */}
                                  <button onClick={() => { setEditingItem({}); setIsEditingItem(!isEditingItem); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-transform active:scale-95 ${isEditingItem ? 'bg-slate-700 text-white' : 'bg-green-600 hover:bg-green-500 text-white shadow-green-600/20'}`}>
                                      {isEditingItem ? <X size={20}/> : <Plus size={20}/>} {isEditingItem ? 'Chiudi Editor' : 'NUOVO PIATTO'}
                                  </button>
                              </div>
                          </div>

                          {/* --- NEW: TABLE COUNT CONFIGURATION --- */}
                          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                              <div className="flex items-center gap-4">
                                 <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl"><LayoutGrid size={24}/></div>
                                 <div><h3 className="font-bold text-white text-lg">Configurazione Sala</h3><p className="text-xs text-slate-400 font-medium">Imposta il numero di tavoli attivi nel ristorante.</p></div>
                              </div>
                              <div className="flex items-center gap-3 bg-slate-950 p-1.5 rounded-xl border border-slate-700">
                                 <button onClick={() => handleUpdateTableCount(-1)} className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"><Minus size={18} strokeWidth={3}/></button>
                                 <span className="font-black text-3xl w-16 text-center text-white">{appSettings.restaurantProfile?.tableCount || 12}</span>
                                 <button onClick={() => handleUpdateTableCount(1)} className="w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-500 rounded-lg text-white shadow-lg shadow-blue-600/20 transition-colors"><Plus size={18} strokeWidth={3}/></button>
                              </div>
                          </div>
                          
                          {/* QUICK ACTIONS ROW */}
                          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex gap-4 mb-8 overflow-x-auto no-scrollbar items-center">
                              <button onClick={() => bulkInputRef.current?.click()} className="flex items-center gap-2 bg-blue-600/20 text-blue-400 px-4 py-2 rounded-lg font-bold hover:bg-blue-600/30 transition-colors whitespace-nowrap text-xs"><Upload size={16}/> Importa JSON</button>
                              <input type="file" ref={bulkInputRef} onChange={handleBulkImport} accept=".json" className="hidden" />
                              
                              <button onClick={() => bulkImagesRef.current?.click()} className="flex items-center gap-2 bg-pink-600/20 text-pink-400 px-4 py-2 rounded-lg font-bold hover:bg-pink-600/30 transition-colors whitespace-nowrap text-xs"><ImageIcon size={16}/> Importa Foto Massiva</button>
                              <input type="file" ref={bulkImagesRef} onChange={handleBulkImageUpload} accept="image/*" multiple className="hidden" />

                              <button onClick={exportMenu} className="flex items-center gap-2 bg-teal-600/20 text-teal-400 px-4 py-2 rounded-lg font-bold hover:bg-teal-600/30 transition-colors whitespace-nowrap text-xs"><Download size={16}/> Esporta JSON</button>
                              
                              <div className="flex-1"></div>
                              
                              <button onClick={() => setShowDeleteAllMenuModal(true)} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-500 transition-colors whitespace-nowrap shadow-lg shadow-red-900/20 text-xs"><Trash2 size={16}/> ELIMINA TUTTO</button>
                          </div>

                          {/* EDITOR FORM (COMPACT & COLLAPSIBLE) */}
                          {(isEditingItem || Object.keys(editingItem).length > 0) && (
                              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl mb-10 relative overflow-hidden animate-slide-up">
                                  <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-lg"><Edit2 size={18}/> {editingItem.id ? 'Modifica Piatto' : 'Crea Nuovo Piatto'}</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                      {/* Column 1: Image & Basic Info */}
                                      <div className="space-y-4">
                                          <div className="flex gap-4">
                                              <div className="relative w-24 h-24 bg-slate-950 rounded-xl border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 group">
                                                  {editingItem.image ? (
                                                      <>
                                                          <img src={editingItem.image} alt="Preview" className="w-full h-full object-cover" />
                                                          <button onClick={(e) => { e.stopPropagation(); setEditingItem(prev => ({ ...prev, image: undefined })); }} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20"><X size={12}/></button>
                                                      </>
                                                  ) : <ImageIcon className="text-slate-600" size={24} />}
                                                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                                                  <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity z-10"><Upload className="text-white" size={20}/></div>
                                              </div>
                                              <div className="flex-1 space-y-2">
                                                  <input type="text" placeholder="Nome Piatto" value={editingItem.name || ''} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold text-sm focus:border-orange-500 outline-none" />
                                                  <div className="flex gap-2">
                                                      <input type="number" placeholder="€" value={editingItem.price || ''} onChange={e => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) })} className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold text-sm focus:border-orange-500 outline-none text-right" />
                                                      <select value={editingItem.category || Category.ANTIPASTI} onChange={e => setEditingItem({ ...editingItem, category: e.target.value as Category })} className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold text-xs focus:border-orange-500 outline-none appearance-none">
                                                          {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                                                      </select>
                                                  </div>
                                              </div>
                                          </div>
                                          {/* Specific Dept Override */}
                                          <select value={editingItem.specificDepartment || ''} onChange={e => setEditingItem({ ...editingItem, specificDepartment: e.target.value as Department | undefined })} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-400 text-xs outline-none">
                                              <option value="">Destinazione Default</option>
                                              <option value="Cucina">Forza Cucina</option>
                                              <option value="Pizzeria">Forza Pizzeria</option>
                                              <option value="Pub">Forza Pub</option>
                                              <option value="Sala">Forza Sala</option>
                                          </select>
                                      </div>

                                      {/* Column 2: Details & AI */}
                                      <div className="space-y-3">
                                          <div>
                                              <div className="flex justify-between mb-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Ingredienti</label><button onClick={generateIngr} disabled={!editingItem.name} className="text-[10px] text-purple-400 hover:text-purple-300 flex gap-1 items-center"><Sparkles size={10}/> AI</button></div>
                                              <input type="text" placeholder="Es. Pomodoro, Mozzarella" value={editingItem.ingredients || ''} onChange={e => setEditingItem({ ...editingItem, ingredients: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs outline-none" />
                                          </div>
                                          <div>
                                              <div className="flex justify-between mb-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Descrizione</label><button onClick={generateDesc} disabled={!editingItem.name} className="text-[10px] text-purple-400 hover:text-purple-300 flex gap-1 items-center"><Sparkles size={10}/> AI</button></div>
                                              <textarea placeholder="Descrizione breve..." value={editingItem.description || ''} onChange={e => setEditingItem({ ...editingItem, description: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs outline-none resize-none h-16" />
                                          </div>
                                      </div>

                                      {/* Column 3: Allergens & Save */}
                                      <div className="flex flex-col justify-between">
                                          <div>
                                              <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Allergeni</label>
                                              <div className="flex flex-wrap gap-1.5">
                                                  {ALLERGENS_CONFIG.map(alg => (
                                                      <button key={alg.id} onClick={() => { const current = editingItem.allergens || []; setEditingItem({ ...editingItem, allergens: current.includes(alg.id) ? current.filter(a => a !== alg.id) : [...current, alg.id] }); }} className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${editingItem.allergens?.includes(alg.id) ? 'bg-orange-500 border-orange-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>{alg.label}</button>
                                                  ))}
                                              </div>
                                          </div>
                                          <div className="flex gap-2 mt-4">
                                              <button onClick={() => { setEditingItem({}); setIsEditingItem(false); }} className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs">Annulla</button>
                                              <button onClick={handleSaveItem} disabled={!editingItem.name || !editingItem.price} className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1"><Save size={14}/> Salva</button>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          )}

                          {/* GROUPED MENU LIST */}
                          <div className="space-y-8">
                              {ADMIN_CATEGORY_ORDER.map(category => {
                                  const categoryItems = menuItems.filter(item => item.category === category);
                                  if (categoryItems.length === 0) return null;

                                  return (
                                      <div key={category} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                                          <div className="flex items-center gap-3 mb-4">
                                              <div className="w-2 h-8 bg-orange-500 rounded-full"></div>
                                              <h3 className="text-xl font-bold text-white uppercase tracking-wide">{category}</h3>
                                              <span className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-1 rounded">{categoryItems.length}</span>
                                          </div>
                                          
                                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                              {categoryItems.map(item => (
                                                  <div key={item.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-slate-500 transition-all group flex items-start gap-4 shadow-sm relative">
                                                      <div className="w-16 h-16 bg-slate-900 rounded-lg border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                                                          {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <Utensils size={20} className="text-slate-600"/>}
                                                      </div>
                                                      <div className="flex-1 min-w-0">
                                                          <h4 className="font-bold text-white text-sm truncate">{item.name}</h4>
                                                          <p className="text-orange-400 font-mono font-bold text-xs mt-0.5">€ {item.price.toFixed(2)}</p>
                                                          {item.ingredients && <p className="text-[10px] text-slate-500 truncate mt-1">{item.ingredients}</p>}
                                                      </div>
                                                      <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2">
                                                          <button onClick={() => { setEditingItem(item); setIsEditingItem(true); window.scrollTo({top:0, behavior:'smooth'}); }} className="p-1.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white"><Edit2 size={14}/></button>
                                                          <button onClick={() => confirmDelete(item)} className="p-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600 hover:text-white"><Trash2 size={14}/></button>
                                                      </div>
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                  )
                              })}
                          </div>
                      </div>
                  )}
                  
                  {/* --- TAB: NOTIFICHE & REPARTI (RESTORED) --- */}
                  {adminTab === 'notif' && (
                      <div className="max-w-2xl mx-auto space-y-8 animate-fade-in pb-20">
                          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><ArrowRightLeft className="text-purple-500"/> Smistamento Reparti</h3>
                              <p className="text-slate-400 text-sm mb-6">Decidi in quale monitor inviare gli ordini per ogni categoria.</p>
                              <div className="space-y-4">
                                  {ADMIN_CATEGORY_ORDER.map(cat => (
                                      <div key={cat} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                                          <span className="font-bold text-sm text-slate-300">{cat}</span>
                                          <div className="relative">
                                              <select value={tempDestinations[cat] || 'Cucina'} onChange={(e) => { const newDest = { ...tempDestinations, [cat]: e.target.value as Department }; setTempDestinations(newDest); setHasUnsavedDestinations(true); }} className="appearance-none bg-slate-800 text-white text-xs font-bold py-2 pl-3 pr-8 rounded-lg border border-slate-700 outline-none focus:border-purple-500">
                                                  <option value="Cucina">Cucina</option>
                                                  <option value="Pizzeria">Pizzeria</option>
                                                  <option value="Pub">Pub / Bar</option>
                                                  <option value="Sala">Sala (Auto)</option>
                                              </select>
                                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12}/>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Printer className="text-blue-500"/> Stampa Scontrini (Beta)</h3>
                              <div className="space-y-3">
                                  {Object.keys(tempPrintSettings).map(key => (
                                      <div key={key} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                                          <span className="font-bold text-sm text-slate-300">Stampa in {key}</span>
                                          <button onClick={() => { const newSettings = { ...tempPrintSettings, [key]: !tempPrintSettings[key] }; setTempPrintSettings(newSettings); setHasUnsavedDestinations(true); }} className={`w-12 h-6 rounded-full p-1 transition-colors ${tempPrintSettings[key] ? 'bg-green-600' : 'bg-slate-700'}`}>
                                              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${tempPrintSettings[key] ? 'translate-x-6' : ''}`}></div>
                                          </button>
                                      </div>
                                  ))}
                              </div>
                          </div>
                          {hasUnsavedDestinations && (<div className="sticky bottom-6"><button onClick={saveDestinations} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl shadow-lg animate-bounce flex items-center justify-center gap-2"><Save size={20}/> SALVA MODIFICHE</button></div>)}
                      </div>
                  )}

                  {/* --- TAB: SUBSCRIPTION (RESTORED) --- */}
                  {adminTab === 'subscription' && (
                      <div className="max-w-4xl mx-auto animate-fade-in">
                          <h2 className="text-3xl font-black text-white mb-8">Stato Abbonamento</h2>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className={`p-8 rounded-3xl border relative overflow-hidden ${subscriptionExpired ? 'bg-red-900/20 border-red-500/50' : 'bg-emerald-900/20 border-emerald-500/50'}`}>
                                  <div className="absolute top-0 right-0 p-6 opacity-10"><CreditCard size={120} className={subscriptionExpired ? 'text-red-500' : 'text-emerald-500'} /></div>
                                  <div className="relative z-10">
                                      <p className="text-sm font-bold uppercase tracking-widest mb-2 flex items-center gap-2">{subscriptionExpired ? <AlertTriangle className="text-red-500"/> : <Check className="text-emerald-500"/>} {subscriptionExpired ? 'Abbonamento Scaduto' : 'Abbonamento Attivo'}</p>
                                      <h3 className="text-4xl font-black text-white mb-1">Piano {appSettings.restaurantProfile?.planType || 'Pro'}</h3>
                                      <p className="text-slate-400 font-mono text-sm mb-6">Scadenza: {appSettings.restaurantProfile?.subscriptionEndDate ? new Date(appSettings.restaurantProfile.subscriptionEndDate).toLocaleDateString() : 'Illimitato'}</p>
                                      {daysRemaining !== null && (<div className="bg-slate-900/50 rounded-xl p-4 border border-white/10 backdrop-blur-sm"><p className="text-slate-400 text-xs font-bold uppercase mb-1">Tempo Rimanente</p><p className="text-2xl font-black text-white">{daysRemaining} Giorni</p></div>)}
                                  </div>
                              </div>
                              <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex flex-col justify-center">
                                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><RefreshCw className="text-blue-500"/> Rinnovo Licenza</h3>
                                  <p className="text-slate-400 text-sm mb-6">Per rinnovare o cambiare piano, effettua un bonifico alle coordinate sottostanti o contatta l'amministrazione.</p>
                                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-700 space-y-3">
                                      <div><p className="text-[10px] font-bold text-slate-500 uppercase">IBAN</p><p className="font-mono text-white select-all">{adminIban}</p></div>
                                      <div><p className="text-[10px] font-bold text-slate-500 uppercase">Intestatario</p><p className="text-white">{adminHolder}</p></div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}

                  {/* --- TAB: SHARE / QR (RESTORED & ENHANCED) --- */}
                  {adminTab === 'share' && (
                      <div className="flex flex-col xl:flex-row gap-8 pb-20 animate-fade-in">
                          <div className="flex-1 space-y-8">
                              <div><h3 className="text-2xl font-black text-white mb-2">Menu Digitale</h3><p className="text-slate-400 text-sm">Il tuo menu accessibile ovunque.</p></div>
                              <div className="bg-white p-6 rounded-3xl shadow-2xl inline-block mx-auto xl:mx-0">
                                  {qrCodeUrl ? <img src={qrCodeUrl} alt="Menu QR" className="w-64 h-64 mix-blend-multiply"/> : <div className="w-64 h-64 flex items-center justify-center bg-slate-100 text-slate-400 text-xs">QR non disponibile</div>}
                              </div>
                              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 text-left space-y-4">
                                  <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Link Pubblico</label><div className="flex gap-2"><input type="text" value={digitalMenuLink} readOnly className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-400 text-xs font-mono"/><button onClick={copyToClipboard} className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700"><Copy size={16}/></button></div></div>
                                  
                                  <div className="grid grid-cols-2 gap-3">
                                      <button onClick={shareLink} className="py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"><Share2 size={18}/> Condividi</button>
                                      <button onClick={handlePrintQR} className="py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2"><Printer size={18}/> Stampa QR</button>
                                  </div>
                                  
                                  <button onClick={() => window.open(digitalMenuLink, '_blank')} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"><ExternalLink size={20}/> ANTEPRIMA LIVE</button>
                              </div>
                          </div>
                          <div className="flex-shrink-0 flex justify-center xl:justify-start">
                              <div className="relative border-[8px] border-slate-800 bg-slate-900 rounded-[3rem] h-[650px] w-[320px] shadow-2xl overflow-hidden ring-4 ring-slate-900/50">
                                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-xl z-30"></div>
                                  <div className="h-full w-full bg-slate-50 overflow-hidden">
                                      <DigitalMenu restaurantId={session.user.id} isPreview={true} activeMenuData={menuItems} activeRestaurantName={restaurantName} />
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}

                  {/* --- TAB: AI INTELLIGENCE (RESTORED) --- */}
                  {adminTab === 'ai' && (
                      <div className="max-w-xl mx-auto space-y-8 pb-20 animate-fade-in text-center">
                          <div className="w-20 h-20 bg-pink-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse"><Sparkles size={40} className="text-pink-500"/></div>
                          <h3 className="text-2xl font-black text-white">Gemini AI Intelligence</h3>
                          <p className="text-slate-400">Inserisci la tua API Key di Google Gemini per abilitare:<br/>- Generazione descrizioni piatti<br/>- Analisi incassi giornaliera<br/>- Chat Assistant per i camerieri</p>
                          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 text-left">
                              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Google Gemini API Key</label>
                              <div className="flex gap-2">
                                  <div className="relative flex-1">
                                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                                      <input type="password" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white font-mono" placeholder="AIza..."/>
                                  </div>
                                  <button onClick={handleSaveApiKey} className="bg-pink-600 hover:bg-pink-500 text-white px-6 rounded-xl font-bold shadow-lg">Salva</button>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-4">La chiave viene salvata nel database sicuro di RistoSync. Non condividerla con nessuno.</p>
                          </div>
                      </div>
                  )}

                  {/* --- TAB: ANALYTICS (ENHANCED) --- */}
                  {adminTab === 'analytics' && (
                      <div className="space-y-6 pb-20 animate-fade-in">
                          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900 p-6 rounded-2xl border border-slate-800">
                              <div><h3 className="text-xl font-bold text-white">Report Giornaliero</h3><p className="text-slate-400 text-sm">Analisi incassi e performance.</p></div>
                              <div className="flex items-center bg-slate-950 rounded-xl p-1 border border-slate-700">
                                  <button onClick={() => setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate()-1); return n; })} className="p-3 hover:bg-slate-800 rounded-lg"><ChevronLeft/></button>
                                  <div className="px-6 font-bold text-white flex items-center gap-2"><Calendar size={18} className="text-emerald-500"/> {selectedDate.toLocaleDateString()}</div>
                                  <button onClick={() => setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate()+1); return n; })} className="p-3 hover:bg-slate-800 rounded-lg"><ChevronRight/></button>
                              </div>
                          </div>
                          {(() => {
                              const { revenue, totalDishes, avgOrder, topItems, peakHour } = analyticsData;
                              return (
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                      {/* METRIC CARDS */}
                                      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign size={80} className="text-emerald-500"/></div><p className="text-slate-400 text-xs font-bold uppercase mb-2">Incasso Totale</p><p className="text-4xl font-black text-white">€ {revenue.toFixed(2)}</p></div>
                                      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Receipt size={80} className="text-blue-500"/></div><p className="text-slate-400 text-xs font-bold uppercase mb-2">Scontrini Emessi</p><p className="text-4xl font-black text-white">{totalDishes}</p></div>
                                      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={80} className="text-purple-500"/></div><p className="text-slate-400 text-xs font-bold uppercase mb-2">Scontrino Medio</p><p className="text-4xl font-black text-white">€ {avgOrder.toFixed(2)}</p></div>
                                      
                                      {/* NEW METRICS: TOP ITEMS & PEAK HOUR */}
                                      <div className="md:col-span-2 bg-slate-900 p-6 rounded-2xl border border-slate-800">
                                          <h4 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2"><Trophy className="text-yellow-500"/> Piatti più Venduti</h4>
                                          <div className="space-y-3">
                                              {topItems.map(([name, count], i) => (
                                                  <div key={i} className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                                                      <div className="flex items-center gap-3">
                                                          <span className={`w-6 h-6 flex items-center justify-center rounded font-bold text-xs ${i===0 ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-slate-400'}`}>#{i+1}</span>
                                                          <span className="font-bold text-white">{name}</span>
                                                      </div>
                                                      <span className="font-mono text-sm text-slate-400">{count} ordini</span>
                                                  </div>
                                              ))}
                                              {topItems.length === 0 && <p className="text-slate-500 text-sm italic">Nessun dato.</p>}
                                          </div>
                                      </div>

                                      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                                          <h4 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2"><Timer className="text-orange-500"/> Orario di Punta</h4>
                                          <div className="flex items-center justify-center h-32">
                                              {peakHour ? (
                                                  <div className="text-center">
                                                      <p className="text-5xl font-black text-white">{peakHour[0]}:00</p>
                                                      <p className="text-slate-400 text-xs mt-2 uppercase font-bold">{peakHour[1]} Ordini registrati</p>
                                                  </div>
                                              ) : <p className="text-slate-500 text-sm italic">Nessun dato.</p>}
                                          </div>
                                      </div>

                                      {/* AI ANALYSIS */}
                                      <div className="col-span-full bg-slate-900 p-6 rounded-2xl border border-slate-800">
                                          <div className="flex justify-between items-center mb-4"><h4 className="font-bold flex items-center gap-2"><Sparkles className="text-pink-500"/> Analisi AI Manager</h4><button onClick={handleGenerateAnalysis} className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-xs font-bold shadow-lg flex items-center gap-2">{isAnalyzing ? <Loader className="animate-spin" size={14}/> : <Bot size={14}/>} Genera Analisi</button></div>
                                          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm leading-relaxed text-slate-300 min-h-[80px]">{aiAnalysisResult || 'Clicca su "Genera Analisi" per ricevere consigli dal tuo AI Manager.'}</div>
                                      </div>
                                  </div>
                              );
                          })()}
                      </div>
                  )}
                  
                  {/* --- TAB: INFO & SUPPORT (RESTORED) --- */}
                  {adminTab === 'info' && (
                      <div className="max-w-2xl mx-auto space-y-8 animate-fade-in pb-20 text-center">
                          <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl border border-slate-700"><LifeBuoy size={48} className="text-blue-500" /></div>
                          <div><h2 className="text-3xl font-black text-white mb-2">Supporto Clienti</h2><p className="text-slate-400">Hai bisogno di aiuto? Contattaci direttamente.</p></div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 hover:border-slate-600 transition-colors"><Mail className="text-orange-500 mb-4" size={32} /><p className="text-xs font-bold text-slate-500 uppercase mb-1">Email Supporto</p><a href={`mailto:${adminContactEmail}`} className="text-lg font-bold text-white hover:underline">{adminContactEmail}</a></div>
                              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 hover:border-slate-600 transition-colors"><PhoneCall className="text-green-500 mb-4" size={32} /><p className="text-xs font-bold text-slate-500 uppercase mb-1">Telefono / WhatsApp</p><a href={`tel:${adminPhone}`} className="text-lg font-bold text-white hover:underline">{adminPhone}</a></div>
                          </div>
                          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 text-left"><h3 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2"><ShieldCheck size={16}/> Informazioni Legali & Privacy</h3><div className="space-y-2 text-xs text-slate-400"><p>RistoSync AI è un software SaaS per la gestione della ristorazione.</p><p>Versione: 2.5.0 (Stable)</p><div className="flex gap-4 mt-4 pt-4 border-t border-slate-800"><button className="text-blue-400 hover:underline">Termini di Servizio</button><button className="text-blue-400 hover:underline">Privacy Policy</button></div></div></div>
                      </div>
                  )}

                  {/* --- TAB: PROFILE (RESTORED) --- */}
                  {adminTab === 'profile' && (
                      <div className="max-w-4xl mx-auto animate-fade-in">
                          <h2 className="text-3xl font-black text-white mb-8">Profilo Ristorante</h2>
                          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-8">
                              {/* ANAGRAFICA GENERALE */}
                              <div>
                                  <h3 className="text-sm font-bold text-orange-500 uppercase mb-4 flex items-center gap-2"><Store size={16}/> Dati Generali</h3>
                                  
                                  {/* EMAIL ACCOUNT FIELD (ADDED) */}
                                  <div className="mb-6">
                                      <label className="text-xs text-slate-500 font-bold uppercase mb-1 block flex items-center gap-1"><Key size={12}/> Email Account (Login)</label>
                                      <input type="text" value={session?.user?.email || ''} readOnly className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl p-3 text-slate-400 font-mono cursor-not-allowed" />
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div><label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Nome Insegna</label><input type="text" value={profileForm.name || ''} onChange={e => setProfileForm({...profileForm, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-bold"/></div>
                                      <div><label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Numero Tavoli</label><input type="number" value={profileForm.tableCount || 12} onChange={e => setProfileForm({...profileForm, tableCount: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono font-bold"/></div>
                                  </div>
                              </div>

                              {/* DATI FISCALI & CONTATTI */}
                              <div>
                                  <h3 className="text-sm font-bold text-green-500 uppercase mb-4 flex items-center gap-2"><Briefcase size={16}/> Dati Fiscali & Sede</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div><label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Ragione Sociale</label><input type="text" value={profileForm.businessName || ''} onChange={e => setProfileForm({...profileForm, businessName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white"/></div>
                                      <div><label className="text-xs text-slate-500 font-bold uppercase mb-1 block">P.IVA / C.F.</label><input type="text" value={profileForm.vatNumber || ''} onChange={e => setProfileForm({...profileForm, vatNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono"/></div>
                                      <div><label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Indirizzo Sede</label><input type="text" value={profileForm.address || ''} onChange={e => setProfileForm({...profileForm, address: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white"/></div>
                                      <div><label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Indirizzo Fatturazione</label><input type="text" value={profileForm.billingAddress || ''} onChange={e => setProfileForm({...profileForm, billingAddress: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white"/></div>
                                      <div><label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Codice SDI</label><input type="text" value={profileForm.sdiCode || ''} onChange={e => setProfileForm({...profileForm, sdiCode: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono uppercase"/></div>
                                      <div><label className="text-xs text-slate-500 font-bold uppercase mb-1 block">PEC Email</label><input type="email" value={profileForm.pecEmail || ''} onChange={e => setProfileForm({...profileForm, pecEmail: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono"/></div>
                                      <div><label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Telefono</label><input type="text" value={profileForm.phoneNumber || ''} onChange={e => setProfileForm({...profileForm, phoneNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white"/></div>
                                      <div><label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Email Contatto</label><input type="email" value={profileForm.email || ''} onChange={e => setProfileForm({...profileForm, email: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white"/></div>
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