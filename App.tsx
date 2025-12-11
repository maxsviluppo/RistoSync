import React, { useState, useEffect, useMemo, useRef } from 'react';
import KitchenDisplay from './components/KitchenDisplay';
import WaiterPad from './components/WaiterPad';
import AuthScreen from './components/AuthScreen';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import DigitalMenu from './components/DigitalMenu';
import { ChefHat, Smartphone, User, Settings, Bell, Utensils, X, Save, Plus, Trash2, Edit2, Wheat, Milk, Egg, Nut, Fish, Bean, Flame, Leaf, Info, LogOut, Bot, Key, Database, ShieldCheck, Lock, AlertTriangle, Mail, RefreshCw, Send, Printer, Mic, MicOff, TrendingUp, BarChart3, Calendar, ChevronLeft, ChevronRight, DollarSign, History, Receipt, UtensilsCrossed, Eye, ArrowRight, QrCode, Share2, Copy, MapPin, Store, Phone, Globe, Star, Pizza, CakeSlice, Wine, Sandwich, MessageCircle, FileText, PhoneCall, Sparkles, Loader, Facebook, Instagram, Youtube, Linkedin, Music, Compass, FileSpreadsheet, Image as ImageIcon, Upload, FileImage, ExternalLink, CreditCard, Banknote, Briefcase, Clock, Check, ListPlus, ArrowRightLeft, Code2, Cookie, Shield, Wrench, Download, CloudUpload, BookOpen, EyeOff, LayoutGrid, ArrowLeft, PlayCircle, ChevronDown, FileJson, Wallet } from 'lucide-react';
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
  
  // REAL BULK UPLOAD WITH IMAGE MATCHING
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      let matchCount = 0;
      const currentMenuItems = getMenuItems(); // Get latest
      // Helper to read file as Base64
      const readFileAsBase64 = (file: File): Promise<string> => {
          return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
          });
      };

      try {
          for (let i = 0; i < files.length; i++) {
              const file = files[i];
              const fileNameNoExt = file.name.split('.').slice(0, -1).join('.').toLowerCase().trim();
              
              // Find matching item (Checking if item Name includes filename OR filename includes Item name)
              // Example: File "carbonara.jpg" matches Item "Spaghetti alla Carbonara"
              const matchedItem = currentMenuItems.find(item => {
                  const itemName = item.name.toLowerCase();
                  return itemName.includes(fileNameNoExt) || fileNameNoExt.includes(itemName);
              });

              if (matchedItem) {
                  const base64 = await readFileAsBase64(file);
                  const updatedItem = { ...matchedItem, image: base64 };
                  updateMenuItem(updatedItem); // This saves to local AND syncs to cloud
                  matchCount++;
              }
          }
          setMenuItems(getMenuItems()); // Refresh UI
          alert(`Caricamento completato! Associate ${matchCount} immagini ai piatti corrispondenti.`);
      } catch (err) {
          console.error("Bulk upload error", err);
          alert("Errore durante il caricamento delle immagini.");
      }
  };

  const toggleAllergen = (alg: string) => { setEditingItem(prev => { const current = prev.allergens || []; return { ...prev, allergens: current.includes(alg) ? current.filter(a => a !== alg) : [...current, alg] }; }); };
  const handleSocialChange = (network: string, value: string) => { setProfileForm(prev => ({ ...prev, socials: { ...prev.socials, [network]: value } })); };

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

                                        <button onClick={() => {