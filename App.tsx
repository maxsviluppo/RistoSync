import React, { useState, useEffect, useMemo, useRef } from 'react';
import KitchenDisplay from './components/KitchenDisplay';
import WaiterPad from './components/WaiterPad';
import AuthScreen from './components/AuthScreen';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import DigitalMenu from './components/DigitalMenu';
import { ChefHat, Smartphone, User, Settings, Bell, Utensils, X, Save, Plus, Trash2, Edit2, Wheat, Milk, Egg, Nut, Fish, Bean, Flame, Leaf, Info, LogOut, Bot, Key, Database, ShieldCheck, Lock, AlertTriangle, Mail, RefreshCw, Send, Printer, Mic, MicOff, TrendingUp, BarChart3, Calendar, ChevronLeft, ChevronRight, DollarSign, History, Receipt, UtensilsCrossed, Eye, ArrowRight, QrCode, Share2, Copy, MapPin, Store, Phone, Globe, Star, Pizza, CakeSlice, Wine, Sandwich, MessageCircle, FileText, PhoneCall, Sparkles, Loader, Facebook, Instagram, Youtube, Linkedin, Music, Compass, FileSpreadsheet, Image as ImageIcon, Upload, FileImage, ExternalLink, CreditCard, Banknote, Briefcase, Clock, Check, ListPlus, ArrowRightLeft, Code2, Cookie, Shield, Wrench, Download, CloudUpload, BookOpen, EyeOff, LayoutGrid, ArrowLeft, PlayCircle, ChevronDown, FileJson, Wallet, Crown, Zap, ShieldCheck as ShieldIcon } from 'lucide-react';
import { getWaiterName, saveWaiterName, getMenuItems, addMenuItem, updateMenuItem, deleteMenuItem, getNotificationSettings, saveNotificationSettings, NotificationSettings, initSupabaseSync, getGoogleApiKey, saveGoogleApiKey, getAppSettings, saveAppSettings, getOrders, deleteHistoryByDate, performFactoryReset, deleteAllMenuItems, importDemoMenu } from './services/storageService';
import { supabase, signOut, isSupabaseConfigured, SUPER_ADMIN_EMAIL } from './services/supabase';
import { askChefAI, generateRestaurantAnalysis, generateDishDescription, generateDishIngredients } from './services/geminiService';
import { MenuItem, Category, Department, AppSettings, OrderStatus, Order, RestaurantProfile, OrderItem } from './types';

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
          const existingProfile = currentSettings.restaurantProfile || {};
          setProfileForm({ name: existingProfile.name || restaurantName, tableCount: existingProfile.tableCount || 12, businessName: existingProfile.businessName || '', responsiblePerson: existingProfile.responsiblePerson || '', vatNumber: existingProfile.vatNumber || '', sdiCode: existingProfile.sdiCode || '', pecEmail: existingProfile.pecEmail || '', address: existingProfile.address || '', billingAddress: existingProfile.billingAddress || '', phoneNumber: existingProfile.phoneNumber || '', landlineNumber: existingProfile.landlineNumber || '', whatsappNumber: existingProfile.whatsappNumber || '', email: existingProfile.email || '', website: existingProfile.website || '', socials: existingProfile.socials || {}, subscriptionEndDate: existingProfile.subscriptionEndDate || '', planType: existingProfile.planType || 'Pro', subscriptionCost: existingProfile.subscriptionCost || '49.90' });
          setHasUnsavedDestinations(false);
          setOrdersForAnalytics(getOrders());
          const key = getGoogleApiKey();
          if (key) setApiKeyInput(key);
      }
  }, [showAdmin]); 

  // --- HANDLERS ---
  const saveDestinations = async () => { const newSettings: AppSettings = { ...appSettings, categoryDestinations: tempDestinations, printEnabled: tempPrintSettings }; await saveAppSettings(newSettings); setAppSettingsState(newSettings); setHasUnsavedDestinations(false); alert("Impostazioni salvate con successo!"); };
  const handleSaveProfile = async () => { const newProfile = { ...profileForm }; const newSettings: AppSettings = { ...appSettings, restaurantProfile: newProfile }; await saveAppSettings(newSettings); setAppSettingsState(newSettings); if (supabase && session?.user?.id && newProfile.name) { await supabase.from('profiles').update({ restaurant_name: newProfile.name }).eq('id', session.user.id); } if (newProfile.name) { setRestaurantName(newProfile.name); } alert("Profilo aggiornato con successo!"); };
  const handleWaiterLogin = (e: React.FormEvent) => { e.preventDefault(); if(waiterNameInput.trim()) { saveWaiterName(waiterNameInput); setRole('waiter'); setShowLogin(false); } };
  const handleSaveItem = () => { if (!editingItem.name || !editingItem.price) { alert("Nome e Prezzo obbligatori."); return; } if (isEditingItem) { updateMenuItem(editingItem as MenuItem); } else { addMenuItem({ ...editingItem, id: Date.now().toString() } as MenuItem); } setMenuItems(getMenuItems()); setEditingItem({}); setIsEditingItem(false); };
  const handleDeleteItem = () => { if (itemToDelete) { deleteMenuItem(itemToDelete.id); setMenuItems(getMenuItems()); setItemToDelete(null); } };
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setEditingItem(prev => ({ ...prev, image: reader.result as string })); }; reader.readAsDataURL(file); } };
  
  // REAL BULK UPLOAD WITH CRASH PREVENTION
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      let matchCount = 0;
      let skippedCount = 0;
      const MAX_IMAGE_SIZE = 300 * 1024; // 300KB Limit to prevent localStorage crash

      try {
          const currentMenuItems = [...getMenuItems()]; // Clone array safely

          const readFileAsBase64 = (file: File): Promise<string> => {
              return new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
              });
          };

          for (let i = 0; i < files.length; i++) {
              const file = files[i];
              
              if (file.size > MAX_IMAGE_SIZE) {
                  console.warn(`File ${file.name} skipped: too large (${(file.size/1024).toFixed(0)}KB). Max 300KB.`);
                  skippedCount++;
                  continue;
              }

              const fileNameNoExt = file.name.split('.').slice(0, -1).join('.').toLowerCase().trim();
              
              // Find index to modify reference in clone
              const itemIndex = currentMenuItems.findIndex(item => {
                  const itemName = item.name.toLowerCase();
                  return itemName.includes(fileNameNoExt) || fileNameNoExt.includes(itemName);
              });

              if (itemIndex !== -1) {
                  const base64 = await readFileAsBase64(file);
                  currentMenuItems[itemIndex] = { ...currentMenuItems[itemIndex], image: base64 };
                  // Update single item in storage to persist
                  updateMenuItem(currentMenuItems[itemIndex]);
                  matchCount++;
              }
          }
          
          // Update local state cleanly
          setMenuItems(getMenuItems()); // Re-fetch from reliable storage
          
          let msg = `Caricamento completato! Associate ${matchCount} immagini.`;
          if (skippedCount > 0) msg += `\n⚠️ ${skippedCount} immagini saltate perché troppo pesanti (>300KB). Ridimensionale e riprova.`;
          alert(msg);

      } catch (err) {
          console.error("Bulk upload error", err);
          alert("Errore durante il caricamento. Riprova con meno immagini o file più piccoli.");
          setMenuItems(getMenuItems()); // Restore state on error
      } finally {
          if (bulkInputRef.current) bulkInputRef.current.value = ''; // Reset input
      }
  };

  const toggleAllergen = (alg: string) => { setEditingItem(prev => { const current = prev.allergens || []; return { ...prev, allergens: current.includes(alg) ? current.filter(a => a !== alg) : [...current, alg] }; }); };
  const handleSocialChange = (network: string, value: string) => { setProfileForm(prev => ({ ...prev, socials: { ...prev.socials, [network]: value } })); };

  // PAYMENT REQUEST HANDLER
  const handlePayment = (method: string) => {
      const subject = `Richiesta Link Pagamento ${method} - ${restaurantName}`;
      const body = `Salve, vorrei effettuare il pagamento del rinnovo tramite ${method}. Attendo link sicuro o istruzioni.`;
      window.location.href = `mailto:${adminContactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // PLAN CHANGE HANDLER
  const handlePlanChangeRequest = (planName: string) => {
      const subject = `Richiesta Attivazione Piano ${planName} - ${restaurantName}`;
      const body = `Salve, vorrei passare al piano ${planName} per il ristorante ${restaurantName}. Attendo istruzioni.`;
      window.location.href = `mailto:${adminContactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // SHARE HANDLERS
  const digitalMenuLink = session?.user?.id ? `${window.location.origin}?menu=${session.user.id}` : '';
  const qrCodeUrl = digitalMenuLink ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(digitalMenuLink)}` : '';
  const copyToClipboard = () => { navigator.clipboard.writeText(digitalMenuLink); alert("Link copiato!"); };

  // AI HANDLERS
  const handleGenerateDesc = async () => { if (!editingItem.name) { alert("Inserisci prima il nome del piatto."); return; } setIsGeneratingDesc(true); const desc = await generateDishDescription(editingItem.name, editingItem.ingredients || ''); if (desc) setEditingItem(prev => ({ ...prev, description: desc })); setIsGeneratingDesc(false); };
  const handleGenerateIngr = async () => { if (!editingItem.name) { alert("Inserisci prima il nome del piatto."); return; } setIsGeneratingIngr(true); const ingr = await generateDishIngredients(editingItem.name); if (ingr) setEditingItem(prev => ({ ...prev, ingredients: ingr })); setIsGeneratingIngr(false); };

  if (publicMenuId) { return <DigitalMenu restaurantId={publicMenuId} />; }
  if (loadingSession) { return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader className="animate-spin text-orange-500" size={48} /></div>; }
  if (!session) { return <AuthScreen />; }

  return (
    <div className="min-h-screen bg-slate-900 font-sans text-white">
        
        {/* MODAL ADMIN */}
        {showAdmin && (
            <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-slate-950 w-full max-w-6xl h-[90vh] rounded-[2rem] border border-slate-800 shadow-2xl flex overflow-hidden">
                    
                    {/* SIDEBAR */}
                    <div className="w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-2 overflow-y-auto">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="bg-orange-500 p-2 rounded-xl"><ChefHat size={24} className="text-white"/></div>
                            <span className="font-black text-lg tracking-tight">RistoSync</span>
                        </div>
                        
                        <button onClick={() => setAdminTab('menu')} className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-all ${adminTab === 'menu' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Utensils size={18}/> Gestione Menu</button>
                        <button onClick={() => setAdminTab('profile')} className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-all ${adminTab === 'profile' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Store size={18}/> Profilo Ristorante</button>
                        <button onClick={() => setAdminTab('notif')} className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-all ${adminTab === 'notif' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Bell size={18}/> Notifiche & Reparti</button>
                        <button onClick={() => setAdminTab('analytics')} className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-all ${adminTab === 'analytics' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><BarChart3 size={18}/> Statistiche</button>
                        <button onClick={() => setAdminTab('ai')} className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-all ${adminTab === 'ai' ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Sparkles size={18}/> AI Intelligence</button>
                        <button onClick={() => setAdminTab('share')} className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-all ${adminTab === 'share' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><QrCode size={18}/> Menu Digitale</button>
                        <button onClick={() => setAdminTab('subscription')} className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-all ${adminTab === 'subscription' ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><CreditCard size={18}/> Abbonamento</button>
                        <button onClick={() => setAdminTab('info')} className={`text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-all ${adminTab === 'info' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Info size={18}/> Info & Supporto</button>
                        
                        <div className="mt-auto pt-6 border-t border-slate-800">
                            <button onClick={() => setShowAdmin(false)} className="w-full py-3 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 font-bold flex items-center justify-center gap-2 transition-colors"><ArrowLeft size={18}/> Esci da Admin</button>
                        </div>
                    </div>

                    {/* CONTENT AREA */}
                    <div className="flex-1 overflow-y-auto bg-slate-950 p-8 custom-scroll relative">
                        
                        {/* 1. MENU MANAGER TAB */}
                        {adminTab === 'menu' && (
                            <div className="animate-fade-in pb-20">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2"><Utensils className="text-orange-500"/> Gestione Menu</h3>
                                    <div className="flex gap-2">
                                        <button onClick={() => setShowDeleteAllMenuModal(true)} className="px-4 py-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-xl text-xs font-bold border border-red-500/30 transition-colors flex items-center gap-2"><Trash2 size={14}/> Reset Totale</button>
                                        <button onClick={importDemoMenu} className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700">Importa Demo</button>
                                        
                                        {/* BULK UPLOAD BUTTON (REAL) */}
                                        <div className="relative">
                                            <button onClick={() => bulkInputRef.current?.click()} className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl text-xs font-bold border border-blue-500/30 transition-colors flex items-center gap-2"><Upload size={14}/> Caricamento Massivo</button>
                                            <input type="file" ref={bulkInputRef} onChange={handleBulkUpload} className="hidden" multiple accept="image/*"/>
                                        </div>

                                        <button onClick={() => { setEditingItem({}); setIsEditingItem(false); }} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg"><Plus size={18}/> Nuovo Piatto</button>
                                    </div>
                                </div>

                                {/* TABLE COUNT (MOVED HERE) */}
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-6 flex items-center gap-4">
                                    <div className="p-3 bg-slate-800 rounded-lg text-slate-400"><LayoutGrid size={24}/></div>
                                    <div className="flex-1">
                                        <h4 className="text-sm font-bold text-white">Configurazione Sala</h4>
                                        <p className="text-xs text-slate-400">Imposta il numero totale di tavoli visibili nel pad cameriere.</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input type="number" min="1" max="100" value={profileForm.tableCount || 12} onChange={e => setProfileForm({...profileForm, tableCount: parseInt(e.target.value) || 1})} className="w-24 bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white font-black text-lg outline-none text-center"/>
                                        <button onClick={handleSaveProfile} className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl font-bold transition-colors"><Save size={20}/></button>
                                    </div>
                                </div>

                                {/* EDIT FORM */}
                                { (isEditingItem || Object.keys(editingItem).length > 0) && (
                                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 mb-8 animate-slide-up shadow-xl">
                                        <div className="flex justify-between items-center mb-4"><h4 className="font-bold text-lg">{isEditingItem ? 'Modifica Piatto' : 'Nuovo Piatto'}</h4><button onClick={() => { setEditingItem({}); setIsEditingItem(false); }} className="text-slate-500 hover:text-white"><X size={20}/></button></div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="md:col-span-2 flex gap-4 items-start">
                                                <div className="w-24 h-24 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center relative overflow-hidden group shrink-0">
                                                    {editingItem.image ? <img src={editingItem.image} className="w-full h-full object-cover"/> : <ImageIcon size={24} className="text-slate-500"/>}
                                                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*"/>
                                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => fileInputRef.current?.click()}><Upload size={20} className="text-white"/></div>
                                                </div>
                                                <div className="flex-1 space-y-4">
                                                    <input type="text" placeholder="Nome Piatto" value={editingItem.name || ''} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-bold"/>
                                                    <div className="flex gap-2">
                                                        {/* CUSTOM SELECT */}
                                                        <div className="relative flex-1">
                                                            <select 
                                                                value={editingItem.category || Category.ANTIPASTI} 
                                                                onChange={e => setEditingItem({ ...editingItem, category: e.target.value as Category })} 
                                                                className="appearance-none w-full bg-slate-950 border border-slate-700 rounded-xl p-3 pr-10 text-white focus:border-orange-500 outline-none"
                                                            >
                                                                {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                                                            </select>
                                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                                                        </div>
                                                        <input type="number" placeholder="Prezzo" value={editingItem.price || ''} onChange={e => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) })} className="w-24 bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-bold text-right"/>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex justify-between">Ingredienti {isGeneratingIngr && <span className="text-orange-400 animate-pulse">Generazione...</span>} {!isGeneratingIngr && <button onClick={handleGenerateIngr} className="text-orange-400 hover:text-orange-300 flex items-center gap-1"><Sparkles size={10}/> AI Generate</button>}</label>
                                                <input type="text" placeholder="Es. Pomodoro, Mozzarella, Basilico" value={editingItem.ingredients || ''} onChange={e => setEditingItem({ ...editingItem, ingredients: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm"/>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex justify-between">Descrizione {isGeneratingDesc && <span className="text-blue-400 animate-pulse">Scrittura...</span>} {!isGeneratingDesc && <button onClick={handleGenerateDesc} className="text-blue-400 hover:text-blue-300 flex items-center gap-1"><Sparkles size={10}/> AI Generate</button>}</label>
                                                <textarea placeholder="Descrizione accattivante per il menu..." value={editingItem.description || ''} onChange={e => setEditingItem({ ...editingItem, description: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm h-20"/>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Allergeni</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {ALLERGENS_CONFIG.map(alg => (
                                                        <button key={alg.id} onClick={() => toggleAllergen(alg.id)} className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 transition-all ${editingItem.allergens?.includes(alg.id) ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                                            <alg.icon size={12}/> {alg.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={handleSaveItem} className="w-full mt-6 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg">SALVA PIATTO</button>
                                    </div>
                                )}
                                {/* MENU LIST WITH GRAY BOXES */}
                                <div className="space-y-6">
                                    {ADMIN_CATEGORY_ORDER.map(cat => {
                                        const items = menuItems.filter(i => i.category === cat);
                                        if (items.length === 0) return null;
                                        return (
                                            <div key={cat} className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800">
                                                <h4 className="text-slate-400 font-bold uppercase text-xs mb-3 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500"></div> {cat}</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {items.map(item => (
                                                        <div key={item.id} className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex justify-between items-center group hover:border-slate-600 transition-colors shadow-sm">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center overflow-hidden">{item.image ? <img src={item.image} className="w-full h-full object-cover"/> : <Utensils size={16} className="text-slate-500"/>}</div>
                                                                <div><div className="font-bold text-sm text-white">{item.name}</div><div className="text-xs text-slate-400">€ {item.price.toFixed(2)}</div></div>
                                                            </div>
                                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => { setEditingItem(item); setIsEditingItem(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white"><Edit2 size={14}/></button>
                                                                <button onClick={() => setItemToDelete(item)} className="p-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600 hover:text-white"><Trash2 size={14}/></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                                {itemToDelete && (
                                    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
                                        <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-sm text-center">
                                            <h3 className="text-xl font-bold text-white mb-2">Eliminare {itemToDelete.name}?</h3>
                                            <p className="text-slate-400 text-sm mb-6">L'azione è irreversibile.</p>
                                            <div className="flex gap-3"><button onClick={() => setItemToDelete(null)} className="flex-1 py-3 bg-slate-800 rounded-xl font-bold">Annulla</button><button onClick={handleDeleteItem} className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold text-white">Elimina</button></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 2. PROFILE TAB - (Unchanged) */}
                        {adminTab === 'profile' && (
                            <div className="max-w-2xl mx-auto pb-20 animate-fade-in">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Store className="text-slate-400"/> Dati Attività & Configurazione</h3>
                                <div className="space-y-6">
                                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                                        <label className="block text-slate-400 text-xs font-bold uppercase mb-2">Account Principale</label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-blue-400 uppercase mb-1 block flex items-center gap-1"><Lock size={10}/> Email Login</label>
                                                <input type="text" value={session?.user?.email || 'Non disponibile'} disabled className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl p-3 text-slate-400 text-sm cursor-not-allowed font-mono" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">ID Tenant</label>
                                                <input type="text" value={session?.user?.id || '...'} disabled className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl p-3 text-slate-500 text-xs cursor-not-allowed font-mono" />
                                            </div>
                                        </div>
                                        <label className="block text-slate-400 text-xs font-bold uppercase mb-2">Insegna Ristorante</label>
                                        <div className="relative mb-4"><ChefHat className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/><input type="text" value={profileForm.name || ''} onChange={e => setProfileForm({...profileForm, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white font-bold text-lg outline-none" placeholder="Il Tuo Ristorante"/></div>
                                    </div>
                                    
                                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800"><h4 className="text-slate-300 font-bold mb-4 flex items-center gap-2"><Briefcase size={18}/> Dati Fiscali</h4><div className="grid grid-cols-1 gap-4"><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Ragione Sociale</label><input type="text" value={profileForm.businessName || ''} onChange={e => setProfileForm({...profileForm, businessName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm" placeholder="Es. Rossi S.r.l."/></div><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Responsabile</label><input type="text" value={profileForm.responsiblePerson || ''} onChange={e => setProfileForm({...profileForm, responsiblePerson: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm" placeholder="Nome Cognome"/></div><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">P.IVA / CF</label><input type="text" value={profileForm.vatNumber || ''} onChange={e => setProfileForm({...profileForm, vatNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm font-mono"/></div></div>
                                    <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Codice SDI</label><input type="text" value={profileForm.sdiCode || ''} onChange={e => setProfileForm({...profileForm, sdiCode: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm font-mono uppercase" placeholder="XXXXXXX"/></div><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">PEC</label><input type="text" value={profileForm.pecEmail || ''} onChange={e => setProfileForm({...profileForm, pecEmail: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm font-mono"/></div></div>
                                    <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Indirizzo Sede Legale</label><input type="text" value={profileForm.address || ''} onChange={e => setProfileForm({...profileForm, address: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm" placeholder="Via Roma 1, Milano"/></div><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Indirizzo Fatturazione (Opzionale)</label><input type="text" value={profileForm.billingAddress || ''} onChange={e => setProfileForm({...profileForm, billingAddress: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm" placeholder="Se diverso dalla sede legale"/></div></div></div>
                                    
                                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800"><h4 className="text-slate-300 font-bold mb-4 flex items-center gap-2"><PhoneCall size={18}/> Contatti Pubblici</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Email Contatto</label><input type="email" value={profileForm.email || ''} onChange={e => setProfileForm({...profileForm, email: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm"/></div><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Cellulare</label><input type="text" value={profileForm.phoneNumber || ''} onChange={e => setProfileForm({...profileForm, phoneNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm"/></div><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">WhatsApp</label><input type="text" value={profileForm.whatsappNumber || ''} onChange={e => setProfileForm({...profileForm, whatsappNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm"/></div><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Telefono Fisso</label><input type="text" value={profileForm.landlineNumber || ''} onChange={e => setProfileForm({...profileForm, landlineNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm"/></div><div className="col-span-full"><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Sito Web</label><input type="text" value={profileForm.website || ''} onChange={e => setProfileForm({...profileForm, website: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm text-blue-400" placeholder="https://"/></div></div></div>
                                    
                                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800"><h4 className="text-slate-300 font-bold mb-4 flex items-center gap-2"><Share2 size={18}/> Social Networks</h4><div className="space-y-3"><div className="flex items-center gap-3"><Instagram className="text-pink-500"/><input type="text" value={profileForm.socials?.instagram || ''} onChange={e => handleSocialChange('instagram', e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm" placeholder="Link Instagram"/></div><div className="flex items-center gap-3"><Facebook className="text-blue-600"/><input type="text" value={profileForm.socials?.facebook || ''} onChange={e => handleSocialChange('facebook', e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm" placeholder="Link Facebook"/></div><div className="flex items-center gap-3"><Store className="text-blue-400"/><input type="text" value={profileForm.socials?.google || ''} onChange={e => handleSocialChange('google', e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm" placeholder="Link Google Business"/></div><div className="flex items-center gap-3"><Compass className="text-green-500"/><input type="text" value={profileForm.socials?.tripadvisor || ''} onChange={e => handleSocialChange('tripadvisor', e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm" placeholder="Link TripAdvisor"/></div></div></div>
                                    
                                    {/* DANGER ZONE - MOVED HERE */}
                                    <div className="bg-slate-900 p-6 rounded-2xl border border-red-500/20 text-left mt-6">
                                        <h4 className="font-bold text-white mb-4 flex items-center gap-2 text-red-400"><Settings size={16}/> Zona Pericolosa</h4>
                                        <div className="flex gap-3">
                                            <button onClick={() => { if(confirm("Vuoi resettare tutte le impostazioni locali?")){ localStorage.clear(); window.location.reload(); } }} className="flex-1 py-3 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white text-xs font-bold uppercase tracking-widest rounded-xl border border-red-500/30 transition-all flex items-center justify-center gap-2"><RefreshCw size={14}/> Factory Reset</button>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-800"><button onClick={handleSaveProfile} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 active:scale-95 transition-all"><Save size={20}/> SALVA PROFILO</button></div>
                                </div>
                            </div>
                        )}

                        {/* 3. NOTIFICATION & DEPARTMENTS TAB - (Unchanged) */}
                        {adminTab === 'notif' && (
                            <div className="max-w-2xl mx-auto space-y-8 pb-20 animate-fade-in">
                                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800"><h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><ArrowRightLeft className="text-purple-500"/> Smistamento Reparti</h3><p className="text-slate-400 text-sm mb-6">Decidi in quale monitor inviare gli ordini per ogni categoria.</p>
                                    <div className="space-y-4">
                                        {ADMIN_CATEGORY_ORDER.map(cat => (
                                            <div key={cat} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                                                <span className="font-bold text-sm text-slate-300">{cat}</span>
                                                <div className="relative">
                                                    <select 
                                                        value={tempDestinations[cat] || 'Cucina'} 
                                                        onChange={(e) => { const newDest = { ...tempDestinations, [cat]: e.target.value as Department }; setTempDestinations(newDest); setHasUnsavedDestinations(true); }} 
                                                        className="appearance-none bg-slate-800 text-white text-xs font-bold py-2 pl-3 pr-8 rounded-lg border border-slate-700 outline-none focus:border-purple-500"
                                                    >
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
                                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800"><h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Printer className="text-blue-500"/> Stampa Scontrini (Beta)</h3><div className="space-y-3">{Object.keys(tempPrintSettings).map(key => (<div key={key} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800"><span className="font-bold text-sm text-slate-300">Stampa in {key}</span><button onClick={() => { const newSettings = { ...tempPrintSettings, [key]: !tempPrintSettings[key] }; setTempPrintSettings(newSettings); setHasUnsavedDestinations(true); }} className={`w-12 h-6 rounded-full p-1 transition-colors ${tempPrintSettings[key] ? 'bg-green-600' : 'bg-slate-700'}`}><div className={`w-4 h-4 rounded-full bg-white transition-transform ${tempPrintSettings[key] ? 'translate-x-6' : ''}`}></div></button></div>))}</div></div>
                                {hasUnsavedDestinations && (<div className="sticky bottom-6"><button onClick={saveDestinations} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl shadow-lg animate-bounce flex items-center justify-center gap-2"><Save size={20}/> SALVA MODIFICHE</button></div>)}
                            </div>
                        )}

                        {/* 4. ANALYTICS TAB (ENHANCED) */}
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
                                {/* STATS CARDS */}
                                {(() => {
                                    const dailyOrders = ordersForAnalytics.filter(o => {
                                        const d = new Date(o.createdAt || o.timestamp);
                                        return d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear() && o.status === OrderStatus.DELIVERED;
                                    });
                                    const revenue = dailyOrders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + (i.menuItem.price * i.quantity), 0), 0);
                                    const totalDishes = dailyOrders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0), 0);
                                    const avgOrder = dailyOrders.length ? (revenue / dailyOrders.length) : 0;
                                    
                                    // NEW: Top Dishes Calculation
                                    const itemCounts: Record<string, number> = {};
                                    dailyOrders.forEach(o => o.items.forEach(i => {
                                        itemCounts[i.menuItem.name] = (itemCounts[i.menuItem.name] || 0) + i.quantity;
                                    }));
                                    const topDishes = Object.entries(itemCounts).sort((a,b) => b[1] - a[1]).slice(0, 3);

                                    // NEW: Avg Time Calculation (Delivery Time - Creation Time)
                                    const totalTime = dailyOrders.reduce((acc, o) => acc + ((o.timestamp - (o.createdAt || o.timestamp)) / 60000), 0);
                                    const avgWait = dailyOrders.length ? Math.round(totalTime / dailyOrders.length) : 0;

                                    return (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign size={80} className="text-emerald-500"/></div><p className="text-slate-400 text-xs font-bold uppercase mb-2">Incasso Totale</p><p className="text-4xl font-black text-white">€ {revenue.toFixed(2)}</p></div>
                                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Receipt size={80} className="text-blue-500"/></div><p className="text-slate-400 text-xs font-bold uppercase mb-2">Scontrini Emessi</p><p className="text-4xl font-black text-white">{dailyOrders.length}</p></div>
                                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={80} className="text-purple-500"/></div><p className="text-slate-400 text-xs font-bold uppercase mb-2">Scontrino Medio</p><p className="text-4xl font-black text-white">€ {avgOrder.toFixed(2)}</p></div>
                                            
                                            {/* NEW METRICS */}
                                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Clock size={80} className="text-orange-500"/></div><p className="text-slate-400 text-xs font-bold uppercase mb-2">Attesa Media</p><p className="text-4xl font-black text-white">{avgWait} <span className="text-lg text-slate-500">min</span></p></div>
                                            <div className="md:col-span-2 bg-slate-900 p-6 rounded-2xl border border-slate-800">
                                                <p className="text-slate-400 text-xs font-bold uppercase mb-3 flex items-center gap-2"><Star size={14} className="text-yellow-500"/> Piatti Più Venduti</p>
                                                {topDishes.length > 0 ? (
                                                    <div className="space-y-3">
                                                        {topDishes.map(([name, count], i) => (
                                                            <div key={name} className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${i===0?'bg-yellow-500 text-black':i===1?'bg-slate-400 text-black':'bg-orange-700 text-white'}`}>{i+1}</div>
                                                                    <span className="font-bold text-sm">{name}</span>
                                                                </div>
                                                                <span className="font-bold text-slate-400 text-sm">{count} <span className="text-[10px] uppercase">ordini</span></span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <p className="text-slate-500 text-sm italic">Dati non sufficienti</p>}
                                            </div>

                                            <div className="col-span-full bg-slate-900 p-6 rounded-2xl border border-slate-800">
                                                <div className="flex justify-between items-center mb-4"><h4 className="font-bold flex items-center gap-2"><Sparkles className="text-pink-500"/> Analisi AI Manager</h4><button onClick={async () => { setIsAnalyzing(true); const res = await generateRestaurantAnalysis({ totalRevenue: revenue, totalItems: totalDishes, topDishes: topDishes.map(t=>t[0]), avgWait: avgWait }, selectedDate.toLocaleDateString()); setAiAnalysisResult(res); setIsAnalyzing(false); }} className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-xs font-bold shadow-lg flex items-center gap-2">{isAnalyzing ? <Loader className="animate-spin" size={14}/> : <Bot size={14}/>} Genera Analisi</button></div>
                                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm leading-relaxed text-slate-300 min-h-[80px]">{aiAnalysisResult || 'Clicca su "Genera Analisi" per ricevere consigli dal tuo AI Manager.'}</div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* 5. AI INTELLIGENCE TAB - (Unchanged) */}
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
                                        <button onClick={async () => { await saveGoogleApiKey(apiKeyInput); alert("Key Salvata!"); }} className="bg-pink-600 hover:bg-pink-500 text-white px-6 rounded-xl font-bold shadow-lg">Salva</button>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-4">La chiave viene salvata nel database sicuro di RistoSync. Non condividerla con nessuno.</p>
                                </div>
                            </div>
                        )}

                        {/* 6. SHARE / QR CODE TAB (WITH PHONE PREVIEW) */}
                        {adminTab === 'share' && (
                            <div className="flex flex-col xl:flex-row gap-8 pb-20 animate-fade-in">
                                <div className="flex-1 space-y-8">
                                    <div><h3 className="text-2xl font-black text-white mb-2">Menu Digitale</h3><p className="text-slate-400 text-sm">Fai scansionare questo QR Code ai clienti.</p></div>
                                    <div className="bg-white p-6 rounded-3xl shadow-2xl inline-block mx-auto xl:mx-0">
                                        {qrCodeUrl ? <img src={qrCodeUrl} alt="Menu QR" className="w-64 h-64 mix-blend-multiply"/> : <div className="w-64 h-64 flex items-center justify-center bg-slate-100 text-slate-400 text-xs">QR non disponibile</div>}
                                    </div>
                                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 text-left space-y-4">
                                        <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Link Pubblico</label><div className="flex gap-2"><input type="text" value={digitalMenuLink} readOnly className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-400 text-xs font-mono"/><button onClick={copyToClipboard} className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700"><Copy size={16}/></button></div></div>
                                        <button onClick={() => window.open(digitalMenuLink, '_blank')} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"><ExternalLink size={20}/> APRI MENU DIGITALE</button>
                                    </div>
                                </div>
                                
                                {/* PHONE MOCKUP PREVIEW */}
                                <div className="flex-shrink-0 flex justify-center xl:justify-start">
                                    <div className="relative border-[8px] border-slate-800 bg-slate-900 rounded-[3rem] h-[650px] w-[320px] shadow-2xl overflow-hidden ring-4 ring-slate-900/50">
                                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-xl z-30"></div>
                                        <div className="h-full w-full bg-slate-50 overflow-hidden">
                                            {/* Render DigitalMenu in Preview Mode */}
                                            <DigitalMenu restaurantId={session.user.id} isPreview={true} activeMenuData={menuItems} activeRestaurantName={restaurantName} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 7. SUBSCRIPTION TAB (NEW 3-CARD LAYOUT) */}
                        {adminTab === 'subscription' && (
                            <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-fade-in">
                                
                                {/* HEADER */}
                                <div className="text-center mb-8">
                                    <h3 className="text-3xl font-black text-white mb-2">Scegli il tuo Piano</h3>
                                    <p className="text-slate-400 text-sm">Gestisci il tuo abbonamento RistoSync.</p>
                                    {/* CURRENT STATUS BADGE */}
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-full border border-slate-700 mt-4">
                                        <div className={`w-2 h-2 rounded-full ${subscriptionExpired ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
                                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                                            Stato: {subscriptionExpired ? 'SCADUTO' : appSettings.restaurantProfile?.planType || 'Trial'}
                                        </span>
                                    </div>
                                </div>

                                {/* PLANS GRID */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* TRIAL */}
                                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 flex flex-col relative overflow-hidden group hover:border-blue-500 transition-all">
                                        <div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles size={80} className="text-blue-500"/></div>
                                        <h4 className="text-xl font-black text-white mb-2">Trial</h4>
                                        <p className="text-slate-400 text-xs mb-6 h-10">Prova tutte le funzionalità gratuitamente per iniziare.</p>
                                        <div className="text-3xl font-black text-white mb-6">Gratis <span className="text-sm font-medium text-slate-500">/ 15 gg</span></div>
                                        <button onClick={() => handlePlanChangeRequest('Trial')} className="w-full py-3 rounded-xl border border-slate-600 text-slate-300 font-bold hover:bg-slate-800 hover:text-white transition-colors">Richiedi Trial</button>
                                        <ul className="mt-6 space-y-3">
                                            <li className="flex items-center gap-2 text-xs text-slate-300"><Check size={14} className="text-blue-500"/> Accesso completo</li>
                                            <li className="flex items-center gap-2 text-xs text-slate-300"><Check size={14} className="text-blue-500"/> Cloud Sync</li>
                                            <li className="flex items-center gap-2 text-xs text-slate-300"><Check size={14} className="text-blue-500"/> Supporto Base</li>
                                        </ul>
                                    </div>

                                    {/* STANDARD (HIGHLIGHTED) */}
                                    <div className="bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-indigo-500 rounded-3xl p-6 flex flex-col relative overflow-hidden shadow-2xl shadow-indigo-900/20 transform scale-105 z-10">
                                        <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-widest">Consigliato</div>
                                        <h4 className="text-xl font-black text-white mb-2">Standard</h4>
                                        <p className="text-indigo-200 text-xs mb-6 h-10">La soluzione completa per gestire il tuo locale senza limiti.</p>
                                        <div className="text-3xl font-black text-white mb-6">€ {appSettings.restaurantProfile?.subscriptionCost || '49.90'} <span className="text-sm font-medium text-slate-500">/ mese</span></div>
                                        <button onClick={() => handlePlanChangeRequest('Standard')} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2">
                                            <Zap size={16}/> Attiva Standard
                                        </button>
                                        <ul className="mt-6 space-y-3">
                                            <li className="flex items-center gap-2 text-xs text-white font-bold"><Check size={14} className="text-indigo-400"/> Ordini Illimitati</li>
                                            <li className="flex items-center gap-2 text-xs text-white font-bold"><Check size={14} className="text-indigo-400"/> Menu Digitale QR</li>
                                            <li className="flex items-center gap-2 text-xs text-white font-bold"><Check size={14} className="text-indigo-400"/> AI Assistant</li>
                                            <li className="flex items-center gap-2 text-xs text-white font-bold"><Check size={14} className="text-indigo-400"/> Multi-Device Sync</li>
                                        </ul>
                                    </div>

                                    {/* PREMIUM */}
                                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 flex flex-col relative overflow-hidden group hover:border-amber-500 transition-all">
                                        <div className="absolute top-0 right-0 p-4 opacity-10"><Crown size={80} className="text-amber-500"/></div>
                                        <h4 className="text-xl font-black text-white mb-2">Premium</h4>
                                        <p className="text-slate-400 text-xs mb-6 h-10">Per chi vuole il massimo: personalizzazioni e supporto dedicato.</p>
                                        <div className="text-3xl font-black text-white mb-6">€ 149.90 <span className="text-sm font-medium text-slate-500">/ mese</span></div>
                                        <button onClick={() => handlePlanChangeRequest('Premium')} className="w-full py-3 rounded-xl border border-slate-600 text-amber-400 font-bold hover:bg-slate-800 hover:text-amber-300 transition-colors">Richiedi Premium</button>
                                        <ul className="mt-6 space-y-3">
                                            <li className="flex items-center gap-2 text-xs text-slate-300"><Check size={14} className="text-amber-500"/> Tutto incluso Standard</li>
                                            <li className="flex items-center gap-2 text-xs text-slate-300"><Check size={14} className="text-amber-500"/> Logo Personalizzato</li>
                                            <li className="flex items-center gap-2 text-xs text-slate-300"><Check size={14} className="text-amber-500"/> Assistenza Prioritaria 24/7</li>
                                            <li className="flex items-center gap-2 text-xs text-slate-300"><Check size={14} className="text-amber-500"/> Setup Iniziale Menu</li>
                                        </ul>
                                    </div>
                                </div>

                                {/* PAYMENT METHODS (UPDATED TO EMAIL REQUEST) */}
                                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                                    <h4 className="font-bold text-white mb-6 flex items-center gap-2">Metodi di Pagamento</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <button onClick={() => handlePayment('Carta di Credito')} className="bg-slate-950 border border-slate-700 hover:border-slate-500 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all hover:-translate-y-1 active:scale-95 group">
                                            <CreditCard size={24} className="text-white group-hover:text-blue-400"/> <span className="text-xs font-bold">Richiedi Link Carta</span>
                                        </button>
                                        <button onClick={() => handlePayment('PayPal')} className="bg-slate-950 border border-slate-700 hover:border-blue-500 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all hover:-translate-y-1 active:scale-95">
                                            <div className="font-black italic text-blue-500 text-lg">Pay<span className="text-blue-400">Pal</span></div> <span className="text-xs font-bold">Richiedi PayPal</span>
                                        </button>
                                        <button onClick={() => handlePayment('Apple Pay')} className="bg-slate-950 border border-slate-700 hover:border-white p-4 rounded-2xl flex flex-col items-center gap-2 transition-all hover:-translate-y-1 active:scale-95 group">
                                            <div className="font-bold text-white text-lg group-hover:text-gray-300">Apple Pay</div> <span className="text-xs font-bold">Richiedi Link</span>
                                        </button>
                                        <button onClick={() => handlePayment('Google Pay')} className="bg-slate-950 border border-slate-700 hover:border-green-500 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all hover:-translate-y-1 active:scale-95 group">
                                            <div className="font-bold text-white text-lg"><span className="text-blue-500 group-hover:text-blue-400">G</span>Pay</div> <span className="text-xs font-bold">Richiedi Link</span>
                                        </button>
                                    </div>
                                </div>

                                {/* BANK TRANSFER SECTION (DYNAMIC) */}
                                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                                    <h4 className="font-bold text-white mb-6 flex items-center gap-2"><Banknote size={20} className="text-emerald-500"/> Coordinate Bancarie</h4>
                                    
                                    <div className="space-y-4">
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center group">
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">IBAN</p>
                                                <p className="font-mono text-white text-sm md:text-base tracking-wider">{adminIban}</p>
                                            </div>
                                            <button onClick={() => {navigator.clipboard.writeText(adminIban); alert("IBAN Copiato")}} className="text-slate-500 hover:text-white"><Copy size={18}/></button>
                                        </div>
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                            <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Intestatario</p>
                                            <p className="text-white font-bold">{adminHolder}</p>
                                        </div>
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 border-l-4 border-l-orange-500">
                                            <p className="text-[10px] uppercase font-bold text-orange-500 mb-1">Causale Obbligatoria</p>
                                            <p className="text-white text-sm font-medium">Rinnovo mese di {new Date().toLocaleString('it-IT', { month: 'long' })} per il ristorante {restaurantName}</p>
                                        </div>
                                    </div>

                                    {/* SEND RECEIPT BUTTON */}
                                    <div className="mt-6 pt-6 border-t border-slate-800 flex justify-between items-center">
                                        <div className="text-xs text-slate-400 max-w-[200px]">Hai effettuato il bonifico? Invia la contabile per l'attivazione immediata.</div>
                                        <a 
                                            href={`mailto:${adminContactEmail}?subject=Invio Contabile Bonifico - ${restaurantName}&body=In allegato la contabile del bonifico per il rinnovo mese di ${new Date().toLocaleString('it-IT', { month: 'long' })}.`}
                                            className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 border border-slate-700 transition-colors"
                                        >
                                            <Mail size={18}/> Invia Contabile
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 8. INFO TAB (ENHANCED) */}
                        {adminTab === 'info' && (
                            <div className="max-w-xl mx-auto text-center space-y-8 pb-20 animate-fade-in">
                                <div className="w-24 h-24 bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl"><ChefHat size={48} className="text-orange-500"/></div>
                                <div><h3 className="text-3xl font-black text-white">RistoSync AI</h3><p className="text-slate-400 mt-2">Versione 2.5.0 (Cloud Sync)</p></div>
                                <div className="grid grid-cols-2 gap-4 text-left">
                                    <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800"><h4 className="font-bold text-white mb-2">Supporto Tecnico</h4><p className="text-sm text-slate-400">{adminContactEmail}</p><p className="text-sm text-slate-400 mt-1">{adminPhone}</p></div>
                                    <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
                                        <h4 className="font-bold text-white mb-2">Legal & Privacy</h4>
                                        <button onClick={() => setShowPrivacyModal(true)} className="text-sm text-blue-400 hover:underline flex items-center gap-1"><FileText size={14}/> Privacy & Cookie Policy</button>
                                        <a href="#" className="text-sm text-blue-400 hover:underline block mt-1">Termini di Servizio</a>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* PRIVACY & TERMS MODAL */}
        {showPrivacyModal && (
            <div className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-6 animate-fade-in">
                <div className="bg-slate-900 w-full max-w-2xl h-[80vh] rounded-3xl border border-slate-800 shadow-2xl flex flex-col relative overflow-hidden">
                    <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2"><ShieldIcon className="text-green-500"/> Privacy & Termini di Servizio</h2>
                        <button onClick={() => setShowPrivacyModal(false)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><X size={20}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 text-slate-300 text-sm leading-relaxed custom-scroll">
                        <h3 className="text-white font-bold text-lg mb-2">Fornitore del Servizio</h3>
                        <p className="mb-4">
                            Il servizio <strong>RistoSync AI</strong> è erogato da:<br/>
                            <strong>Massimo Castro</strong><br/>
                            Email: {adminContactEmail}<br/>
                            Telefono: {adminPhone}
                        </p>

                        <h3 className="text-white font-bold text-lg mb-2">Termini di Pagamento</h3>
                        <p className="mb-4">
                            L'abbonamento al servizio è mensile o annuale. Il pagamento deve essere effettuato tramite bonifico bancario alle seguenti coordinate:<br/>
                            <strong>IBAN:</strong> {adminIban}<br/>
                            <strong>Intestatario:</strong> {adminHolder}<br/>
                            Il mancato pagamento comporta la sospensione dell'account dopo 5 giorni dalla scadenza.
                        </p>

                        <h3 className="text-white font-bold text-lg mb-2">Informativa Privacy (GDPR)</h3>
                        <p className="mb-4">
                            RistoSync AI rispetta la tua privacy. I dati raccolti (email, nome ristorante, menu) sono utilizzati esclusivamente per erogare il servizio di gestione comande. 
                            I dati sono salvati su database sicuri (Supabase) e non vengono ceduti a terzi per scopi di marketing.
                        </p>
                        
                        <h3 className="text-white font-bold text-lg mb-2">Cookie Policy</h3>
                        <p className="mb-4">
                            Utilizziamo solo cookie tecnici essenziali per il funzionamento dell'app (autenticazione, preferenze locali come lingua e tema). 
                            Non utilizziamo cookie di profilazione o tracciamento pubblicitario.
                        </p>
                        
                        <h3 className="text-white font-bold text-lg mb-2">Diritti dell'Utente</h3>
                        <p className="mb-4">
                            Puoi richiedere la cancellazione completa del tuo account e dei tuoi dati in qualsiasi momento contattando il supporto tecnico a: {adminContactEmail}.
                        </p>
                        
                        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 mt-6">
                            <p className="text-xs text-slate-400">Ultimo aggiornamento: 25 Ottobre 2023</p>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* ROLE SELECTION SCREEN WITH FLOATING HAT */}
        {!role && !showAdmin && !isSuspended && !subscriptionExpired && (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden">
                <style>{`
                  @keyframes float { 0% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-15px) rotate(5deg); } 100% { transform: translateY(0px) rotate(0deg); } }
                  .animate-float { animation: float 6s ease-in-out infinite; }
                `}</style>
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1514362545857-3bc165497db5?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80')] bg-cover bg-center opacity-10 blur-xl"></div>
                
                {/* SETTINGS BUTTON TOP RIGHT */}
                <button onClick={() => setShowAdmin(true)} className="absolute top-6 right-6 p-3 bg-slate-800/80 backdrop-blur rounded-full text-slate-400 hover:text-white border border-slate-700 shadow-lg hover:rotate-90 transition-all z-20">
                    <Settings size={24} />
                </button>

                <div className="relative z-10 text-center mb-10">
                    {/* ANIMATED FLOATING ICON */}
                    <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-orange-500/30 animate-float transform rotate-3">
                        <ChefHat size={48} className="text-white drop-shadow-md" />
                    </div>
                    
                    <h1 className="text-6xl font-black text-white mb-2 tracking-tight drop-shadow-lg">Risto<span className="text-orange-500">Sync</span></h1>
                    <p className="text-xl text-slate-300 font-medium tracking-wide">{restaurantName}</p>
                    <div className="mt-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div> Sistema Operativo
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl relative z-10">
                    {/* KITCHEN BUTTON */}
                    <button onClick={() => setRole('kitchen')} className="group relative overflow-hidden rounded-3xl bg-slate-800/80 backdrop-blur-md border border-slate-700 p-8 hover:border-orange-500 transition-all duration-300 hover:shadow-[0_0_40px_rgba(249,115,22,0.15)] flex flex-col items-center gap-4 text-center hover:-translate-y-1">
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform border border-slate-700 group-hover:border-orange-500/50 shadow-xl">
                            <ChefHat size={48} className="text-orange-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white mb-1 group-hover:text-orange-400 transition-colors">Cucina</h2>
                            <p className="text-slate-400 text-sm">Visualizza comande (16:9)</p>
                        </div>
                    </button>

                    {/* WAITER BUTTON */}
                    <button onClick={() => { if(getWaiterName()){ setRole('waiter'); } else { setShowLogin(true); } }} className="group relative overflow-hidden rounded-3xl bg-slate-800/80 backdrop-blur-md border border-slate-700 p-8 hover:border-blue-500 transition-all duration-300 hover:shadow-[0_0_40px_rgba(59,130,246,0.15)] flex flex-col items-center gap-4 text-center hover:-translate-y-1">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform border border-slate-700 group-hover:border-blue-500/50 shadow-xl">
                            <Smartphone size={48} className="text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white mb-1 group-hover:text-blue-400 transition-colors">Sala</h2>
                            <p className="text-slate-400 text-sm">Prendi ordini (Mobile)</p>
                        </div>
                    </button>

                    {/* PIZZERIA BUTTON */}
                    <button onClick={() => setRole('pizzeria')} className="group relative overflow-hidden rounded-3xl bg-slate-800/80 backdrop-blur-md border border-slate-700 p-8 hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_40px_rgba(239,68,68,0.15)] flex flex-col items-center gap-4 text-center md:col-span-2 lg:col-span-1 hover:-translate-y-1">
                        <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform border border-slate-700 group-hover:border-red-500/50 shadow-xl">
                            <Pizza size={40} className="text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white mb-1 group-hover:text-red-400 transition-colors">Pizzeria</h2>
                        </div>
                    </button>

                    {/* PUB BUTTON */}
                    <button onClick={() => setRole('pub')} className="group relative overflow-hidden rounded-3xl bg-slate-800/80 backdrop-blur-md border border-slate-700 p-8 hover:border-amber-500 transition-all duration-300 hover:shadow-[0_0_40px_rgba(245,158,11,0.15)] flex flex-col items-center gap-4 text-center md:col-span-2 lg:col-span-1 hover:-translate-y-1">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform border border-slate-700 group-hover:border-amber-500/50 shadow-xl">
                            <Sandwich size={40} className="text-amber-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white mb-1 group-hover:text-amber-400 transition-colors">Pub / Bar</h2>
                        </div>
                    </button>
                </div>

                {isSuperAdmin && (
                    <button onClick={() => setAdminViewMode(prev => prev === 'dashboard' ? 'app' : 'dashboard')} className="mt-8 text-slate-500 text-xs uppercase tracking-widest hover:text-white transition-colors">
                        {adminViewMode === 'dashboard' ? 'Switch to App Mode' : 'Switch to Super Admin'}
                    </button>
                )}
            </div>
        )}

        {/* WAITER LOGIN MODAL */}
        {showLogin && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
                <div className="bg-slate-900 border border-slate-700 p-8 rounded-3xl w-full max-w-sm shadow-2xl relative overflow-hidden">
                    <button onClick={() => setShowLogin(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20}/></button>
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30 rotate-3">
                            <User size={32} className="text-white"/>
                        </div>
                        <h2 className="text-2xl font-black text-white">Chi sei?</h2>
                        <p className="text-slate-400 text-sm">Inserisci il tuo nome per iniziare il servizio</p>
                    </div>
                    <form onSubmit={handleWaiterLogin}>
                        <input type="text" value={waiterNameInput} onChange={(e) => setWaiterNameInput(e.target.value)} placeholder="Nome Cameriere" className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white text-center font-bold text-lg mb-4 focus:border-blue-500 outline-none transition-colors" autoFocus />
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all">INIZIA TURNO</button>
                    </form>
                </div>
            </div>
        )}

        {/* DELETE ALL CONFIRMATION MODAL */}
        {showDeleteAllMenuModal && (
            <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-6 animate-fade-in">
                <div className="bg-slate-900 border border-red-600 rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl shadow-red-900/50">
                    <AlertTriangle size={48} className="text-red-500 mx-auto mb-4"/>
                    <h3 className="text-2xl font-black text-white mb-2">Reset Totale Menu?</h3>
                    <p className="text-slate-400 mb-6">Stai per cancellare TUTTI i piatti dal menu. Questa azione non può essere annullata.</p>
                    <button onClick={async () => { await deleteAllMenuItems(); setMenuItems([]); setShowDeleteAllMenuModal(false); alert("Menu resettato."); }} className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl mb-3">CONFERMA RESET</button>
                    <button onClick={() => setShowDeleteAllMenuModal(false)} className="w-full py-4 bg-slate-800 text-slate-400 font-bold rounded-xl">Annulla</button>
                </div>
            </div>
        )}

        {/* APP VIEWS */}
        {role === 'waiter' && <WaiterPad onExit={() => setRole(null)} />}
        {role === 'kitchen' && <KitchenDisplay onExit={() => setRole(null)} department="Cucina" />}
        {role === 'pizzeria' && <KitchenDisplay onExit={() => setRole(null)} department="Pizzeria" />}
        {role === 'pub' && <KitchenDisplay onExit={() => setRole(null)} department="Pub" />}

        {/* SUPER ADMIN DASHBOARD */}
        {isSuperAdmin && adminViewMode === 'dashboard' && !role && !showAdmin && (
            <div className="fixed inset-0 z-[100] bg-slate-900 overflow-auto">
                <SuperAdminDashboard onEnterApp={() => setAdminViewMode('app')} />
            </div>
        )}

        {/* SUSPENDED SCREEN */}
        {(isSuspended || isBanned || subscriptionExpired) && !isSuperAdmin && (
            <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-24 h-24 bg-red-600/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <Lock size={48} className="text-red-500" />
                </div>
                <h1 className="text-4xl font-black text-white mb-4">
                    {isBanned ? 'ACCOUNT BLOCCATO' : subscriptionExpired ? 'ABBONAMENTO SCADUTO' : 'SERVIZIO SOSPESO'}
                </h1>
                <p className="text-slate-400 text-lg max-w-md mb-8">
                    {isBanned ? 'Il tuo account è stato disabilitato permanentemente per violazione dei termini.' : subscriptionExpired ? 'Il tuo periodo di prova o abbonamento è terminato. Rinnova per continuare.' : 'Contatta l\'amministratore per regolarizzare la tua posizione e riattivare il servizio.'}
                </p>
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 max-w-sm w-full">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Supporto Clienti</p>
                    <p className="text-white font-bold text-lg flex items-center justify-center gap-2 mb-1"><PhoneCall size={18}/> {adminPhone}</p>
                    <p className="text-blue-400 text-sm">{adminContactEmail}</p>
                </div>
                <button onClick={signOut} className="mt-8 text-slate-500 hover:text-white flex items-center gap-2 font-bold"><LogOut size={18}/> Esci dall'account</button>
            </div>
        )}
    </div>
  );
}