import React, { useState, useEffect, useMemo, useRef } from 'react';
import KitchenDisplay from './components/KitchenDisplay';
import WaiterPad from './components/WaiterPad';
import AuthScreen from './components/AuthScreen';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import DigitalMenu from './components/DigitalMenu';
import { ChefHat, Smartphone, User, Settings, Bell, Utensils, X, Save, Plus, Trash2, Edit2, Wheat, Milk, Egg, Nut, Fish, Bean, Flame, Leaf, Info, LogOut, Bot, Key, Database, ShieldCheck, Lock, AlertTriangle, Mail, RefreshCw, Send, Printer, Mic, MicOff, TrendingUp, BarChart3, Calendar, ChevronLeft, ChevronRight, DollarSign, History, Receipt, UtensilsCrossed, Eye, ArrowRight, QrCode, Share2, Copy, MapPin, Store, Phone, Globe, Star, Pizza, CakeSlice, Wine, Sandwich, MessageCircle, FileText, PhoneCall, Sparkles, Loader, Facebook, Instagram, Youtube, Linkedin, Music, Compass, FileSpreadsheet, Image as ImageIcon, Upload, FileImage, ExternalLink, CreditCard, Banknote, Briefcase, Clock, Check, ListPlus, ArrowRightLeft } from 'lucide-react';
import { getWaiterName, saveWaiterName, getMenuItems, addMenuItem, updateMenuItem, deleteMenuItem, getNotificationSettings, saveNotificationSettings, NotificationSettings, initSupabaseSync, getGoogleApiKey, saveGoogleApiKey, getAppSettings, saveAppSettings, getOrders, deleteHistoryByDate, performFactoryReset } from './services/storageService';
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

const capitalize = (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

// Admin-side Receipt Generator
const generateAdminReceiptHtml = (items: OrderItem[], table: string, waiter: string, restaurantName: string, dateObj: Date) => {
    const time = dateObj.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const date = dateObj.toLocaleDateString('it-IT');
    const total = items.reduce((acc, i) => acc + (i.menuItem.price * i.quantity), 0);

    return `
    <html>
        <head>
            <title>Ristampa Scontrino ${table}</title>
            <style>
                body { font-family: 'Courier New', monospace; width: 300px; margin: 0; padding: 10px; font-size: 14px; color: black; background: white; }
                .header { text-align: center; border-bottom: 2px dashed black; padding-bottom: 10px; margin-bottom: 10px; }
                .title { font-size: 18px; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
                .dept { font-size: 14px; font-weight: bold; margin: 5px 0; }
                .meta { font-size: 14px; margin: 2px 0; font-weight: bold; }
                .item { display: flex; margin-bottom: 8px; align-items: baseline; }
                .qty { font-weight: bold; width: 30px; font-size: 16px; }
                .name { flex: 1; font-weight: bold; font-size: 16px; }
                .footer { border-top: 2px dashed black; margin-top: 15px; padding-top: 10px; text-align: center; font-size: 10px; }
                .total { margin-top: 10px; padding-top: 5px; border-top: 1px solid black; font-weight: bold; font-size: 20px; text-align: right; }
                .price { font-size: 14px; font-weight: normal; margin-left: 10px; }
                @media print { .no-print { display: none !important; } }
                .close-btn { display: block; width: 100%; background-color: #ef4444; color: white; text-align: center; padding: 15px 0; font-weight: bold; font-size: 16px; border: none; cursor: pointer; position: fixed; bottom: 0; left: 0; right: 0; text-transform: uppercase; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">${restaurantName}</div>
                <div class="dept">DUPLICATO SCONTRINO</div>
                <div class="meta">TAVOLO: ${table}</div>
                <div class="meta">Staff: ${waiter}</div>
                <div style="font-size: 12px; margin-top:5px;">${date} - ${time}</div>
            </div>
            ${items.map(item => `
                <div class="item">
                    <span class="qty">${item.quantity}</span>
                    <span class="name">${item.menuItem.name}</span>
                    <span class="price">€ ${(item.menuItem.price * item.quantity).toFixed(2)}</span>
                </div>
            `).join('')}
            <div class="total">TOTALE: € ${total.toFixed(2)}</div>
            <div class="footer">RistoSync AI - Archivio Storico<br>*** NON FISCALE ***</div>
            <button class="no-print close-btn" onclick="window.close()">✖ CHIUDI FINESTRA</button>
            <script>window.onload = function() { setTimeout(function(){ window.focus(); window.print(); }, 500); }</script>
        </body>
    </html>
    `;
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
  const [showResetModal, setShowResetModal] = useState(false);
  
  // Menu Manager State
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<MenuItem>>({});
  const [isListening, setIsListening] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false); 
  const [isGeneratingIngr, setIsGeneratingIngr] = useState(false); // NEW
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);
  
  // Analytics State
  const [ordersForAnalytics, setOrdersForAnalytics] = useState<Order[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyticsView, setAnalyticsView] = useState<'stats' | 'receipts'>('stats'); // Toggle between Graphs and Receipt Log
  const [viewOrderDetails, setViewOrderDetails] = useState<Order | null>(null); // NEW: View Modal

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
  const [ibanCopied, setIbanCopied] = useState(false);
  const [adminEmailCopied, setAdminEmailCopied] = useState(false);
  
  // Dynamic Admin Config
  const [adminContactEmail, setAdminContactEmail] = useState(SUPER_ADMIN_EMAIL);

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
                 const { data } = await supabase.from('profiles').select('restaurant_name, subscription_status, settings').eq('id', user.id).single();
                 
                 if (data) {
                     // Check Admin Blocks
                     if (data.subscription_status === 'suspended') { setIsSuspended(true); setIsBanned(false); if(data.restaurant_name) setRestaurantName(data.restaurant_name); return false; }
                     if (data.subscription_status === 'banned') { setIsBanned(true); setIsSuspended(false); if(data.restaurant_name) setRestaurantName(data.restaurant_name); return false; }
                     
                     // CHECK DATE EXPIRATION
                     const expiry = data.settings?.restaurantProfile?.subscriptionEndDate;
                     if (expiry) {
                         const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                         setDaysRemaining(days);
                         
                         // If days < 0, block app (unless super admin)
                         if (days < 0 && user.email !== SUPER_ADMIN_EMAIL) {
                             setSubscriptionExpired(true);
                             return false; 
                         }
                     } else {
                         // Fallback for existing users without date (treat as active/trial)
                         setDaysRemaining(null); 
                     }

                     if (data.restaurant_name) setRestaurantName(data.restaurant_name);
                     setIsSuspended(false); setIsBanned(false); setAccountDeleted(false); setSubscriptionExpired(false);
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
      // Fetch Dynamic Global Settings (Admin Contact Email)
      const fetchGlobalSettings = async () => {
          if (!supabase) return;
          try {
              const { data: adminProfile } = await supabase
                  .from('profiles')
                  .select('settings')
                  .eq('email', SUPER_ADMIN_EMAIL)
                  .single();
              
              if (adminProfile?.settings?.globalConfig?.contactEmail) {
                  setAdminContactEmail(adminProfile.settings.globalConfig.contactEmail);
              }
          } catch (e) {
              console.error("Error fetching global settings", e);
          }
      };
      
      if (showAdmin) {
          setMenuItems(getMenuItems());
          setNotifSettings(getNotificationSettings());
          fetchGlobalSettings();
          
          const currentSettings = getAppSettings();
          setAppSettingsState(currentSettings); 
          setTempDestinations(currentSettings.categoryDestinations || {
              [Category.MENU_COMPLETO]: 'Cucina', // Default
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
          
          // PRE-FILL LOGIC - RESTORED FULL DATA MAPPING
          const existingProfile = currentSettings.restaurantProfile || {};
          setProfileForm({
              // Display Name
              name: existingProfile.name || restaurantName,
              // Billing
              businessName: existingProfile.businessName || '',
              responsiblePerson: existingProfile.responsiblePerson || '',
              vatNumber: existingProfile.vatNumber || '',
              sdiCode: existingProfile.sdiCode || '',
              pecEmail: existingProfile.pecEmail || '',
              address: existingProfile.address || '',
              billingAddress: existingProfile.billingAddress || '',
              // Contacts
              phoneNumber: existingProfile.phoneNumber || '',
              landlineNumber: existingProfile.landlineNumber || '',
              whatsappNumber: existingProfile.whatsappNumber || '',
              email: existingProfile.email || '',
              website: existingProfile.website || '',
              // Socials & Sub
              socials: existingProfile.socials || {},
              subscriptionEndDate: existingProfile.subscriptionEndDate || '',
              planType: existingProfile.planType || 'Pro',
              subscriptionCost: existingProfile.subscriptionCost || '49.90'
          });

          setHasUnsavedDestinations(false);
          setOrdersForAnalytics(getOrders());

          const key = getGoogleApiKey();
          if (key) setApiKeyInput(key);
      }
  }, [showAdmin]); 

  // ... (Event Listeners same as before) ...
  useEffect(() => {
      const handleSettingsUpdate = () => {
          const updated = getAppSettings();
          setAppSettingsState(updated);
          // Update days remaining logic on settings change
          const expiry = updated.restaurantProfile?.subscriptionEndDate;
          if (expiry) {
              const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              setDaysRemaining(days);
          }
          if (!hasUnsavedDestinations && !showAdmin) {
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

  // ... (Helpers and Handlers identical to previous) ...
  const handleWaiterClick = () => { const existingName = getWaiterName(); if (existingName) setRole('waiter'); else setShowLogin(true); };
  const handleLoginSubmit = (e: React.FormEvent) => { e.preventDefault(); if (waiterNameInput.trim()) { saveWaiterName(waiterNameInput.trim()); setShowLogin(false); setRole('waiter'); } };
  const handleExitApp = () => setRole(null);
  const handleReactivationRequest = async () => { if (!supabase || !session) return; try { const originalName = session.user.user_metadata?.restaurant_name || "Richiesta Sblocco"; await supabase.from('profiles').insert({ id: session.user.id, email: session.user.email, restaurant_name: `${originalName} (RICHIESTA)`, subscription_status: 'banned' }); alert("Richiesta inviata!"); window.location.reload(); } catch (e: any) { alert("Errore: " + e.message); } };
  
  const handleSaveMenu = () => { 
      if (editingItem.name && editingItem.price && editingItem.category) { 
          const itemToSave: MenuItem = { 
              id: editingItem.id || Date.now().toString(), 
              name: editingItem.name, 
              price: Number(editingItem.price), 
              category: editingItem.category as Category, 
              description: editingItem.description || '', 
              ingredients: editingItem.ingredients || '', // Save Ingredients
              allergens: editingItem.allergens || [], 
              image: editingItem.image,
              comboItems: editingItem.comboItems, // For Menu Completo
              // specificDepartment removed
          }; 
          if (editingItem.id) updateMenuItem(itemToSave); 
          else addMenuItem(itemToSave); 
          
          setMenuItems(getMenuItems()); 
          setIsEditingItem(false); 
          setEditingItem({}); 
      } 
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setEditingItem(prev => ({ ...prev, image: reader.result as string })); }; reader.readAsDataURL(file); } };
  const removeImage = () => { setEditingItem(prev => ({ ...prev, image: undefined })); if (fileInputRef.current) fileInputRef.current.value = ''; };
  const handleBulkImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const files = e.target.files; if (!files || files.length === 0) return; const currentMenuItems = [...menuItems]; let matchCount = 0; for (let i = 0; i < files.length; i++) { const file = files[i]; const fileNameNoExt = file.name.split('.')[0].toLowerCase().trim(); const targetIndex = currentMenuItems.findIndex(item => item.name.toLowerCase().trim() === fileNameNoExt); if (targetIndex !== -1) { const base64 = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result as string); reader.readAsDataURL(file); }); currentMenuItems[targetIndex] = { ...currentMenuItems[targetIndex], image: base64 }; matchCount++; } } if (matchCount > 0) { currentMenuItems.forEach(item => { const original = menuItems.find(o => o.id === item.id); if (original && original.image !== item.image) updateMenuItem(item); }); setMenuItems(getMenuItems()); alert(`✅ Completato! Associate ${matchCount} immagini ai piatti.`); } else alert("⚠️ Nessuna corrispondenza trovata."); if (bulkInputRef.current) bulkInputRef.current.value = ''; };
  const confirmDeleteMenu = () => { if (itemToDelete) { deleteMenuItem(itemToDelete.id); setMenuItems(getMenuItems()); setItemToDelete(null); } };
  const toggleAllergen = (allergenId: string) => { const current = editingItem.allergens || []; if (current.includes(allergenId)) setEditingItem({ ...editingItem, allergens: current.filter(a => a !== allergenId) }); else setEditingItem({ ...editingItem, allergens: [...current, allergenId] }); };
  const toggleNotif = (key: keyof NotificationSettings) => { const newSettings = { ...notifSettings, [key]: !notifSettings[key] }; setNotifSettings(newSettings); saveNotificationSettings(newSettings); };
  
  const handleDictation = (field: 'desc' | 'ingr') => { if (isListening) return; const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; if (!SpeechRecognition) { alert("Il tuo browser non supporta la dettatura vocale."); return; } const recognition = new SpeechRecognition(); recognition.lang = 'it-IT'; recognition.continuous = false; recognition.interimResults = false; recognition.onstart = () => setIsListening(true); recognition.onresult = (event: any) => { const transcript = event.results[0][0].transcript; if(field === 'desc') { const current = editingItem.description || ''; setEditingItem(prev => ({ ...prev, description: current ? `${current} ${transcript}` : transcript })); } else { const current = editingItem.ingredients || ''; setEditingItem(prev => ({ ...prev, ingredients: current ? `${current}, ${transcript}` : transcript })); } setIsListening(false); }; recognition.onerror = () => setIsListening(false); recognition.onend = () => setIsListening(false); recognition.start(); };
  
  // AI GENERATORS
  const handleGenerateIngredients = async () => { if (!editingItem.name) { alert("Inserisci il nome del piatto."); return; } setIsGeneratingIngr(true); const ingr = await generateDishIngredients(editingItem.name); setEditingItem(prev => ({ ...prev, ingredients: ingr })); setIsGeneratingIngr(false); };
  const handleGenerateDescription = async () => { if (!editingItem.name) { alert("Inserisci il nome del piatto."); return; } setIsGeneratingDesc(true); const desc = await generateDishDescription(editingItem.name, editingItem.ingredients || ''); setEditingItem(prev => ({ ...prev, description: desc })); setIsGeneratingDesc(false); };
  
  const handleTempDestinationChange = (cat: Category, dest: Department) => { setTempDestinations(prev => ({ ...prev, [cat]: dest })); setHasUnsavedDestinations(true); };
  const toggleTempPrint = (key: string) => { setTempPrintSettings(prev => ({ ...prev, [key]: !prev[key] })); setHasUnsavedDestinations(true); };
  const saveDestinationsToCloud = async () => { const newSettings = { ...appSettings, categoryDestinations: tempDestinations, printEnabled: tempPrintSettings }; await saveAppSettings(newSettings); setAppSettingsState(newSettings); setHasUnsavedDestinations(false); alert("Configurazione salvata con successo!"); };
  const handleSaveApiKey = () => { saveGoogleApiKey(apiKeyInput.trim()); alert("Chiave API salvata!"); };
  const handleSaveProfile = async () => { const newProfile = { ...profileForm }; const newSettings: AppSettings = { ...appSettings, restaurantProfile: newProfile }; await saveAppSettings(newSettings); setAppSettingsState(newSettings); if (supabase && session?.user?.id && newProfile.name) { const { error } = await supabase.from('profiles').update({ restaurant_name: newProfile.name }).eq('id', session.user.id); if (error) console.error("Name update error:", error); } if (newProfile.name) { setRestaurantName(newProfile.name); } alert("Profilo aggiornato con successo!"); };
  const handleSocialChange = (network: string, value: string) => { setProfileForm(prev => ({ ...prev, socials: { ...prev.socials, [network]: value } })); };
  const handleCopyIban = () => { navigator.clipboard.writeText("IT73W0623074792000057589384"); setIbanCopied(true); setTimeout(() => setIbanCopied(false), 2000); };
  const handleCopyAdminEmail = () => { navigator.clipboard.writeText(adminContactEmail); setAdminEmailCopied(true); setTimeout(() => setAdminEmailCopied(false), 2000); };

  // MENU COMPLETO HELPERS
  const toggleComboItem = (itemId: string) => {
      const current = editingItem.comboItems || [];
      if (current.includes(itemId)) setEditingItem(prev => ({ ...prev, comboItems: current.filter(id => id !== itemId) }));
      else setEditingItem(prev => ({ ...prev, comboItems: [...current, itemId] }));
  };

  // Dynamic Mailto Generator
  const getPaymentMailto = () => {
      const subject = encodeURIComponent(`Conferma Pagamento - ${profileForm.name || 'Ristorante'}`);
      const body = encodeURIComponent(`Salve,

Ho effettuato il pagamento per il rinnovo dell'abbonamento RistoSync.

DATI RISTORANTE:
Nome: ${profileForm.name || ''}
Ragione Sociale: ${profileForm.businessName || ''}
P.IVA: ${profileForm.vatNumber || ''}

DETTAGLI BONIFICO:
Importo: € ${profileForm.subscriptionCost || '49.90'}
Causale: ${profileForm.businessName || profileForm.name || 'Ristorante'} - Mese/Anno

In allegato la distinta del pagamento.
Attendo conferma attivazione.

Cordiali saluti.`);
      return `mailto:${adminContactEmail}?subject=${subject}&body=${body}`;
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

  const changeDate = (days: number) => { const newDate = new Date(selectedDate); newDate.setDate(newDate.getDate() + days); setSelectedDate(newDate); setAiAnalysisResult(''); };
  const formatDate = (date: Date) => date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  const handleDeleteDailyHistory = async () => { if (confirm(`Sei sicuro di voler eliminare TUTTO lo storico del ${formatDate(selectedDate)}?\nQuesta operazione è irreversibile.`)) { await deleteHistoryByDate(selectedDate); setOrdersForAnalytics(getOrders()); } };
  
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

  const handleReprintReceipt = (order: Order) => {
      const items = order.items;
      const cleanTable = order.tableNumber.replace('_HISTORY', '');
      const dateObj = new Date(order.createdAt || order.timestamp);
      const printContent = generateAdminReceiptHtml(items, cleanTable, order.waiterName || 'Staff', restaurantName, dateObj);
      const printWindow = window.open('', `REPRINT_${order.id}`, 'height=600,width=400');
      if (printWindow) { printWindow.document.write(printContent); printWindow.document.close(); }
  };

  const handleFactoryReset = async () => { setShowResetModal(false); await performFactoryReset(); setMenuItems([]); setOrdersForAnalytics([]); alert("✅ Reset completato con successo. Tutti i dati operativi sono stati cancellati."); };
  const getCategoryIcon = (cat: Category) => { switch (cat) { case Category.MENU_COMPLETO: return <ListPlus size={18}/>; case Category.ANTIPASTI: return <UtensilsCrossed size={18} />; case Category.PANINI: return <Sandwich size={18} />; case Category.PIZZE: return <Pizza size={18} />; case Category.PRIMI: return <ChefHat size={18} />; case Category.SECONDI: return <Utensils size={18} />; case Category.DOLCI: return <CakeSlice size={18} />; case Category.BEVANDE: return <Wine size={18} />; default: return <Utensils size={18} />; } };

  if (publicMenuId) { return <DigitalMenu restaurantId={publicMenuId} />; }
  if (loadingSession) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-orange-500 font-bold">Avvio...</div>;

  // BLOCK SCREEN
  if ((isSuspended || accountDeleted || isBanned || subscriptionExpired) && !isSuperAdmin) {
      return (
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-red-900/10 blur-xl"></div>
              <div className="bg-slate-900 p-8 rounded-3xl border border-red-900/50 shadow-2xl max-w-lg w-full relative z-10">
                  <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 animate-pulse">{subscriptionExpired ? <Banknote size={40}/> : <AlertTriangle size={40}/>}</div>
                  <h1 className="text-3xl font-black text-white mb-2">{isBanned ? 'Richiesta Inviata' : accountDeleted ? 'Account Rimosso' : subscriptionExpired ? 'Abbonamento Scaduto' : 'Account Sospeso'}</h1>
                  <p className="text-slate-400 mb-6 text-lg">{subscriptionExpired ? "Il periodo di abbonamento è terminato. Rinnova per continuare a usare RistoSync." : "Contatta l'amministrazione per maggiori informazioni."}</p>
                  {subscriptionExpired && (<div className="mb-6 bg-slate-950 p-4 rounded-xl border border-slate-800 text-left"><p className="text-xs text-slate-500 uppercase font-bold mb-2">Come riattivare:</p><ul className="text-sm text-slate-300 space-y-2"><li>1. Effettua il pagamento del canone.</li><li>2. Invia la distinta al supporto (347 812 7440).</li><li>3. Il servizio verrà riattivato entro 24h.</li></ul></div>)}
                  {accountDeleted && <button onClick={handleReactivationRequest} className="w-full bg-green-600 text-white px-6 py-3 rounded-xl font-bold">Richiedi Riattivazione</button>}
                  <button onClick={signOut} className="w-full bg-slate-800 text-white px-6 py-3 rounded-xl font-bold mt-4 border border-slate-700 hover:bg-slate-700 transition-colors">Esci</button>
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
        <style>{`@keyframes float-hat { 0%, 100% { transform: translateY(0) rotate(-15deg); } 50% { transform: translateY(-12px) rotate(-5deg); } } .animate-float-hat { animation: float-hat 3.5s ease-in-out infinite; }`}</style>
        {daysRemaining !== null && daysRemaining <= 30 && !showAdmin && !showLogin && (<div className={`absolute top-0 left-0 right-0 z-40 text-center py-2 text-xs font-bold uppercase tracking-widest ${daysRemaining <= 1 ? 'bg-red-600 text-white animate-pulse' : daysRemaining <= 7 ? 'bg-orange-500 text-slate-900' : 'bg-yellow-500 text-slate-900'}`}>⚠️ Scadenza Abbonamento: {daysRemaining} Giorni ({new Date(appSettings.restaurantProfile?.subscriptionEndDate!).toLocaleDateString()})</div>)}
        <div className="absolute top-8 left-0 right-0 p-6 flex justify-between items-center z-30">
            <div className="flex items-center gap-2"><div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center"><ChefHat size={18} className="text-white"/></div><span className="text-white font-bold">{restaurantName}</span>{isSuperAdmin && <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase ml-2">Admin</span>}</div>
            <div className="flex gap-4">{isSuperAdmin && <button onClick={() => setAdminViewMode('dashboard')} className="text-slate-300 hover:text-white"><ShieldCheck size={24} /></button>}<button onClick={() => setShowAdmin(true)} className="p-3 rounded-full bg-slate-800 text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"><Settings size={24} /></button><button onClick={signOut} className="p-3 rounded-full bg-slate-800 text-red-500 hover:text-white hover:bg-red-600 transition-colors"><LogOut size={24} /></button></div>
        </div>

        {!showLogin && !showAdmin && (
            <div className="flex flex-col items-center z-20 animate-fade-in mt-10">
                <div className="text-center mb-12"><div className="w-28 h-28 bg-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-orange-500/20 transform -rotate-3 animate-float-hat"><ChefHat size={60} className="text-white" /></div><h1 className="text-6xl font-black text-white tracking-tighter mb-3">Risto<span className="text-orange-500">Sync</span> <span className="text-blue-500">AI</span></h1><p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Restaurant Management System</p></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-center">
                    <button onClick={() => setRole('kitchen')} className="group relative w-full lg:w-56 h-72 bg-slate-800 rounded-3xl border border-slate-700 hover:border-orange-500 transition-all duration-500 flex flex-col items-center justify-center gap-6 shadow-2xl hover:shadow-orange-500/20 active:scale-95"><div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center group-hover:bg-orange-500 transition-colors duration-500 border border-slate-700 group-hover:border-orange-400"><ChefHat size={40} className="text-slate-500 group-hover:text-white transition-colors duration-500" /></div><div className="text-center"><h2 className="text-xl font-black text-white mb-1">CUCINA</h2><p className="text-slate-500 text-xs font-medium group-hover:text-orange-400 transition-colors">Display Chef</p></div></button>
                    <button onClick={() => setRole('pizzeria')} className="group relative w-full lg:w-56 h-72 bg-slate-800 rounded-3xl border border-slate-700 hover:border-red-500 transition-all duration-500 flex flex-col items-center justify-center gap-6 shadow-2xl hover:shadow-red-500/20 active:scale-95"><div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center group-hover:bg-red-500 transition-colors duration-500 border border-slate-700 group-hover:border-red-400"><Pizza size={40} className="text-slate-500 group-hover:text-white transition-colors duration-500" /></div><div className="text-center"><h2 className="text-xl font-black text-white mb-1">PIZZERIA</h2><p className="text-slate-500 text-xs font-medium group-hover:text-red-400 transition-colors">Display Forno</p></div></button>
                    <button onClick={() => setRole('pub')} className="group relative w-full lg:w-56 h-72 bg-slate-800 rounded-3xl border border-slate-700 hover:border-amber-500 transition-all duration-500 flex flex-col items-center justify-center gap-6 shadow-2xl hover:shadow-amber-500/20 active:scale-95"><div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center group-hover:bg-amber-500 transition-colors duration-500 border border-slate-700 group-hover:border-amber-400"><Sandwich size={40} className="text-slate-500 group-hover:text-white transition-colors duration-500" /></div><div className="text-center"><h2 className="text-xl font-black text-white mb-1">PUB</h2><p className="text-slate-500 text-xs font-medium group-hover:text-amber-400 transition-colors">Panini & Bar</p></div></button>
                    <button onClick={handleWaiterClick} className="group relative w-full lg:w-56 h-72 bg-slate-800 rounded-3xl border border-slate-700 hover:border-blue-500 transition-all duration-500 flex flex-col items-center justify-center gap-6 shadow-2xl hover:shadow-blue-500/20 active:scale-95"><div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center group-hover:bg-blue-500 transition-colors duration-500 border border-slate-700 group-hover:border-blue-400"><UtensilsCrossed size={40} className="text-slate-500 group-hover:text-white transition-colors duration-500" /></div><div className="text-center"><h2 className="text-xl font-black text-white mb-1">SALA</h2><p className="text-slate-500 text-xs font-medium group-hover:text-blue-400 transition-colors">Pad Camerieri</p></div></button>
                </div>
            </div>
        )}

        {showLogin && (<div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-fade-in"><form onSubmit={handleLoginSubmit} className="bg-slate-800 p-8 rounded-3xl w-full max-w-sm border border-slate-700 shadow-2xl animate-slide-up"><h2 className="text-2xl font-bold text-white text-center mb-6">Chi sei?</h2><input type="text" value={waiterNameInput} onChange={(e) => setWaiterNameInput(capitalize(e.target.value))} placeholder="Nome" className="w-full bg-slate-900 rounded-xl px-4 py-4 text-white mb-4 text-center font-bold text-lg border border-slate-700" autoFocus /><div className="flex gap-3"><button type="button" onClick={() => setShowLogin(false)} className="flex-1 py-3 bg-slate-700 text-slate-300 rounded-xl font-bold">Annulla</button><button type="submit" disabled={!waiterNameInput.trim()} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">Accedi</button></div></form></div>)}

        {showAdmin && (
            <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden animate-fade-in">
                {/* ... Admin Header & Sidebar (Unchanged) ... */}
                <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900"><h2 className="text-2xl font-bold text-white flex items-center gap-3"><Settings className="text-orange-500"/> Configurazione</h2><button onClick={() => setShowAdmin(false)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full"><X /></button></div>
                <div className="flex flex-1 overflow-hidden">
                    <div className="w-64 bg-slate-900 border-r border-slate-800 p-4 space-y-2 hidden md:block">
                         <button onClick={() => setAdminTab('menu')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'menu' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Utensils size={20}/> Menu & Destinazioni</button>
                         <button onClick={() => setAdminTab('profile')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'profile' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Store size={20}/> Profilo Ristorante</button>
                         <button onClick={() => setAdminTab('subscription')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'subscription' ? 'bg-green-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><CreditCard size={20}/> Abbonamento</button>
                         <button onClick={() => setAdminTab('analytics')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'analytics' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><TrendingUp size={20}/> Analisi & Storico</button>
                         <button onClick={() => setAdminTab('notif')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'notif' ? 'bg-green-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Bell size={20}/> Notifiche</button>
                         <button onClick={() => setAdminTab('share')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'share' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><QrCode size={20}/> Menu Digitale</button>
                         <button onClick={() => setAdminTab('ai')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'ai' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Bot size={20}/> AI Intelligence</button>
                         <button onClick={() => setAdminTab('info')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${adminTab === 'info' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Info size={20}/> Legenda</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-950 relative">
                        {/* MOBILE NAV BAR UPDATED */}
                        <div className="flex md:hidden gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                            <button onClick={() => setAdminTab('menu')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'menu' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Menu</button>
                            <button onClick={() => setAdminTab('profile')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'profile' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400'}`}>Profilo</button>
                            <button onClick={() => setAdminTab('subscription')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'subscription' ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Abbonamento</button>
                            <button onClick={() => setAdminTab('analytics')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'analytics' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Analisi</button>
                            <button onClick={() => setAdminTab('share')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'share' ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Menu QR</button>
                            <button onClick={() => setAdminTab('ai')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'ai' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>AI & Key</button>
                            <button onClick={() => setAdminTab('notif')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'notif' ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Notifiche</button>
                            <button onClick={() => setAdminTab('info')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${adminTab === 'info' ? 'bg-slate-800 text-white' : 'bg-slate-800 text-slate-400'}`}>Legenda</button>
                        </div>
                        
                        {/* SUBSCRIPTION TAB - RESTORED */}
                        {adminTab === 'subscription' && (
                            <div className="max-w-4xl mx-auto pb-20 animate-fade-in">
                                <div className="flex items-center gap-3 mb-8"><div className="p-3 bg-green-500/10 rounded-2xl text-green-500"><CreditCard size={32} /></div><div><h3 className="text-2xl font-bold text-white">Stato Abbonamento</h3><p className="text-slate-400 text-sm">Gestisci il tuo piano e i pagamenti.</p></div></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Calendar size={100}/></div><div className="relative z-10"><p className="text-xs text-slate-500 uppercase font-bold mb-2">Stato Attuale</p><div className="flex items-center gap-3 mb-6"><div className={`w-4 h-4 rounded-full ${daysRemaining !== null && daysRemaining < 0 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div><span className={`text-2xl font-black ${daysRemaining !== null && daysRemaining < 0 ? 'text-red-500' : 'text-white'}`}>{daysRemaining !== null && daysRemaining < 0 ? 'SCADUTO' : 'ATTIVO'}</span><span className="bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-white border border-slate-700">{profileForm.planType === 'Trial' ? 'Periodo di Prova' : profileForm.planType || 'Pro'}</span></div><div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-4"><div className="flex justify-between text-sm mb-2"><span className="text-slate-400">Scadenza:</span><span className="text-white font-mono font-bold">{profileForm.subscriptionEndDate ? new Date(profileForm.subscriptionEndDate).toLocaleDateString() : 'Non definita'}</span></div><div className="flex justify-between text-sm"><span className="text-slate-400">Giorni Rimanenti:</span><span className={`font-mono font-bold ${daysRemaining !== null && daysRemaining <= 7 ? 'text-red-400' : 'text-green-400'}`}>{daysRemaining !== null ? daysRemaining : '∞'}</span></div></div></div></div>
                                    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-3xl border border-indigo-500/30 text-center flex flex-col justify-center items-center">
                                        <p className="text-indigo-300 font-bold uppercase text-xs mb-2">{profileForm.planType === 'Trial' ? 'Costo al rinnovo' : 'Canone Mensile'}</p>
                                        <h2 className="text-5xl font-black text-white mb-2">€ {profileForm.subscriptionCost || '49.90'}</h2>
                                        <p className="text-slate-400 text-sm mb-6">+ IVA / Mese</p>
                                        <a href={`https://paypal.me/castromassimo/${(profileForm.subscriptionCost || '49.90').replace(',', '.')}`} target="_blank" rel="noopener noreferrer" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all"><CreditCard size={18}/> {profileForm.planType === 'Trial' ? 'Attiva Piano Pro' : 'Paga con PayPal / Carta'}</a>
                                        <p className="text-[10px] text-slate-500 mt-3">Link sicuro PayPal.Me</p>
                                    </div>
                                </div>
                                <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6"><h4 className="font-bold text-white mb-6 flex items-center gap-2"><Banknote size={20} className="text-green-500"/> Coordinate Bancarie (Bonifico)</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm"><div><p className="text-slate-500 mb-1">Intestatario</p><p className="text-white font-bold text-lg mb-4">Massimo Castro</p><p className="text-slate-500 mb-1">IBAN</p><div className="flex items-center gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800"><p className="text-white font-mono select-all cursor-text text-xs md:text-sm flex-1">IT73W0623074792000057589384</p><button onClick={handleCopyIban} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors relative" title="Copia IBAN">{ibanCopied ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}</button></div></div><div><p className="text-slate-500 mb-1">Causale</p><p className="text-white font-bold mb-4">{profileForm.businessName || restaurantName} - Mese/Anno</p><div className="bg-blue-900/20 border border-blue-500/30 p-5 rounded-2xl shadow-inner"><div className="flex items-start gap-3 mb-4"><Info size={20} className="text-blue-400 shrink-0 mt-0.5" /><div><p className="text-blue-300 text-xs font-black uppercase tracking-wider mb-1">CONFERMA PAGAMENTO</p><p className="text-slate-400 text-xs leading-relaxed">Dopo il bonifico, invia la distinta a <strong>{adminContactEmail}</strong> per l'attivazione immediata.</p></div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><a href={getPaymentMailto()} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg shadow-blue-600/20"><Send size={14} /> INVIA EMAIL CON DATI</a><button onClick={handleCopyAdminEmail} className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white py-2.5 rounded-xl font-bold text-xs transition-all border border-slate-700">{adminEmailCopied ? <Check size={14} className="text-green-500"/> : <Copy size={14} />} {adminEmailCopied ? 'EMAIL COPIATA' : 'COPIA INDIRIZZO EMAIL'}</button></div></div></div></div></div>
                            </div>
                        )}

                        {/* PROFILE TAB - RESTORED FULL */}
                        {adminTab === 'profile' && (
                            <div className="max-w-2xl mx-auto pb-20 animate-fade-in">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Store className="text-slate-400"/> Dati Attività & Fatturazione</h3>
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
                                        <div className="relative"><ChefHat className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/><input type="text" value={profileForm.name || ''} onChange={e => setProfileForm({...profileForm, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white font-bold text-lg outline-none" placeholder="Il Tuo Ristorante"/></div>
                                    </div>
                                    
                                    {/* BILLING DATA */}
                                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800"><h4 className="text-slate-300 font-bold mb-4 flex items-center gap-2"><Briefcase size={18}/> Dati Fiscali</h4><div className="grid grid-cols-1 gap-4"><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Ragione Sociale</label><input type="text" value={profileForm.businessName || ''} onChange={e => setProfileForm({...profileForm, businessName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm" placeholder="Es. Rossi S.r.l."/></div><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Responsabile</label><input type="text" value={profileForm.responsiblePerson || ''} onChange={e => setProfileForm({...profileForm, responsiblePerson: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm" placeholder="Nome Cognome"/></div><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">P.IVA / CF</label><input type="text" value={profileForm.vatNumber || ''} onChange={e => setProfileForm({...profileForm, vatNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm font-mono"/></div></div>
                                    <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Codice SDI</label><input type="text" value={profileForm.sdiCode || ''} onChange={e => setProfileForm({...profileForm, sdiCode: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm font-mono uppercase" placeholder="XXXXXXX"/></div><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">PEC</label><input type="text" value={profileForm.pecEmail || ''} onChange={e => setProfileForm({...profileForm, pecEmail: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm font-mono"/></div></div>
                                    <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Indirizzo Sede Legale</label><input type="text" value={profileForm.address || ''} onChange={e => setProfileForm({...profileForm, address: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm" placeholder="Via Roma 1, Milano"/></div><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Indirizzo Fatturazione (Opzionale)</label><input type="text" value={profileForm.billingAddress || ''} onChange={e => setProfileForm({...profileForm, billingAddress: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm" placeholder="Se diverso dalla sede legale"/></div></div></div>
                                    
                                    {/* CONTACTS DATA */}
                                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800"><h4 className="text-slate-300 font-bold mb-4 flex items-center gap-2"><PhoneCall size={18}/> Contatti Pubblici</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Email Contatto</label><input type="email" value={profileForm.email || ''} onChange={e => setProfileForm({...profileForm, email: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm"/></div><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Cellulare</label><input type="text" value={profileForm.phoneNumber || ''} onChange={e => setProfileForm({...profileForm, phoneNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm"/></div><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">WhatsApp</label><input type="text" value={profileForm.whatsappNumber || ''} onChange={e => setProfileForm({...profileForm, whatsappNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm"/></div><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Telefono Fisso</label><input type="text" value={profileForm.landlineNumber || ''} onChange={e => setProfileForm({...profileForm, landlineNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm"/></div><div className="col-span-full"><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Sito Web</label><input type="text" value={profileForm.website || ''} onChange={e => setProfileForm({...profileForm, website: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm text-blue-400" placeholder="https://"/></div></div></div>
                                    
                                    {/* SOCIAL DATA */}
                                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800"><h4 className="text-slate-300 font-bold mb-4 flex items-center gap-2"><Share2 size={18}/> Social Networks</h4><div className="space-y-3"><div className="flex items-center gap-3"><Instagram className="text-pink-500"/><input type="text" value={profileForm.socials?.instagram || ''} onChange={e => handleSocialChange('instagram', e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm" placeholder="Link Instagram"/></div><div className="flex items-center gap-3"><Facebook className="text-blue-600"/><input type="text" value={profileForm.socials?.facebook || ''} onChange={e => handleSocialChange('facebook', e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm" placeholder="Link Facebook"/></div><div className="flex items-center gap-3"><Store className="text-blue-400"/><input type="text" value={profileForm.socials?.google || ''} onChange={e => handleSocialChange('google', e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm" placeholder="Link Google Business"/></div><div className="flex items-center gap-3"><Compass className="text-green-500"/><input type="text" value={profileForm.socials?.tripadvisor || ''} onChange={e => handleSocialChange('tripadvisor', e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm" placeholder="Link TripAdvisor"/></div></div></div>
                                    
                                    <div className="pt-4 border-t border-slate-800"><button onClick={handleSaveProfile} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 active:scale-95 transition-all"><Save size={20}/> SALVA PROFILO</button></div>
                                </div>
                            </div>
                        )}

                        {/* SHARE TAB - RESTORED */}
                        {adminTab === 'share' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start max-w-5xl mx-auto h-full animate-fade-in"><div className="text-center lg:text-left flex flex-col items-center lg:items-start"><div className="bg-white p-4 rounded-3xl inline-block mb-6 shadow-2xl"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`https://risto-sync.vercel.app/?menu=${session?.user?.id || 'demo'}`)}`} alt="QR Code Menu" className="w-48 h-48 bg-gray-200 rounded-xl" /></div><h3 className="text-3xl font-black text-white mb-2">Il tuo Menu Digitale</h3><p className="text-slate-400 mb-8 max-w-sm mx-auto lg:mx-0">I clienti possono scansionare questo codice per vedere il menu completo, allergeni e foto dei piatti.</p><div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4 mb-6 max-w-md mx-auto lg:mx-0 w-full"><code className="text-xs text-blue-400 font-mono truncate flex-1">https://risto-sync.vercel.app/?menu={session?.user?.id || '...'}</code><button onClick={() => { if (session?.user?.id) { navigator.clipboard.writeText(`https://risto-sync.vercel.app/?menu=${session.user.id}`); alert("Link copiato!"); } }} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 text-white"><Copy size={16}/></button></div><div className="flex gap-4 justify-center lg:justify-start mb-8"><a href={`https://risto-sync.vercel.app/?menu=${session?.user?.id || ''}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3 bg-pink-600 text-white font-bold rounded-xl hover:bg-pink-500 shadow-lg shadow-pink-600/20"><ExternalLink size={18}/> Apri Esterno</a><button className="px-6 py-3 bg-slate-800 text-white font-bold rounded-xl border border-slate-700 cursor-default">Status: Online</button></div></div><div className="flex flex-col items-center"><p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-4">Anteprima Live</p><div className="border-[8px] border-slate-900 rounded-[3rem] overflow-hidden h-[600px] w-[320px] relative shadow-2xl bg-slate-950 flex flex-col"><div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-slate-900 rounded-b-xl z-50"></div><div className="h-full w-full overflow-hidden bg-slate-50 flex-1 relative"><DigitalMenu restaurantId={session?.user?.id || 'preview'} isPreview={true} activeMenuData={menuItems} activeRestaurantName={restaurantName} /></div></div></div></div>
                        )}

                        {/* MENU TAB (Standard) */}
                        {adminTab === 'menu' && (
                             <div className="max-w-4xl mx-auto pb-20 animate-fade-in"><div className="flex justify-between items-center mb-6"><div><h3 className="text-xl font-bold text-white">Gestione Menu</h3><p className="text-slate-400 text-sm">Aggiungi, modifica o rimuovi piatti.</p></div><div className="flex gap-2"><button onClick={() => bulkInputRef.current?.click()} className="bg-slate-800 hover:bg-slate-700 text-blue-400 px-4 py-2 rounded-xl font-bold flex items-center gap-2 border border-slate-700 transition-all active:scale-95" title="Carica foto in massa (Nome file = Nome piatto)"><FileImage size={18}/> Foto Smart</button><input type="file" ref={bulkInputRef} multiple accept="image/*" onChange={handleBulkImageUpload} className="hidden"/><button onClick={() => { setIsEditingItem(true); setEditingItem({}); }} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-orange-600/20 active:scale-95"><Plus size={18}/> Nuovo Piatto</button></div></div><div className="space-y-8">{ADMIN_CATEGORY_ORDER.map(category => { const items = menuItems.filter(i => i.category === category); if (items.length === 0) return null; return ( <div key={category} className="mb-8"><h4 className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-slate-800 pb-2">{getCategoryIcon(category)} {category}</h4><div className="space-y-3">{items.map(item => ( <div key={item.id} onDoubleClick={() => { setEditingItem(item); setIsEditingItem(true); }} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center hover:border-slate-700 transition-colors group cursor-pointer select-none"><div className="flex items-center gap-4"><div className="text-orange-500 font-black text-lg min-w-[3.5rem] text-center">€ {item.price.toFixed(2)}</div><div><div className="flex items-center gap-2"><h4 className="font-bold text-white text-lg">{item.name}</h4>{item.image && <ImageIcon size={14} className="text-green-500" />}</div><div className="flex items-center gap-2 text-xs"><span className="text-slate-500">{item.description || 'Nessuna descrizione'}</span></div></div></div><div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setEditingItem(item); setIsEditingItem(true); }} className="p-2 bg-slate-800 text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white"><Edit2 size={16}/></button><button onClick={() => setItemToDelete(item)} className="p-2 bg-slate-800 text-red-400 rounded-lg hover:bg-red-600 hover:text-white"><Trash2 size={16}/></button></div></div> ))}</div></div> ) })}</div><div className="mt-12 pt-12 border-t border-slate-800"><div className="flex justify-between items-center mb-6"><div><h3 className="text-xl font-bold text-white">Configurazione Reparti</h3><p className="text-slate-400 text-sm">Dove inviare e stampare le comande?</p></div>{hasUnsavedDestinations && <button onClick={saveDestinationsToCloud} className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg animate-pulse">Salva Modifiche</button>}</div><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">{ADMIN_CATEGORY_ORDER.map(cat => ( <div key={cat} className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800"><span className="font-bold text-slate-300 uppercase flex items-center gap-2"><div className="w-2 h-2 bg-orange-500 rounded-full"></div>{cat}</span><div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800 overflow-x-auto"><button onClick={() => handleTempDestinationChange(cat, 'Cucina')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${tempDestinations[cat] === 'Cucina' ? 'bg-orange-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}>CUCINA</button><button onClick={() => handleTempDestinationChange(cat, 'Sala')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${tempDestinations[cat] === 'Sala' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}>SALA</button><button onClick={() => handleTempDestinationChange(cat, 'Pizzeria')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${tempDestinations[cat] === 'Pizzeria' ? 'bg-red-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}>PIZZERIA</button><button onClick={() => handleTempDestinationChange(cat, 'Pub')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${tempDestinations[cat] === 'Pub' ? 'bg-amber-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}>PUB</button></div></div> ))}</div><div className="bg-slate-900 rounded-2xl border border-slate-800 p-6"><div className="flex items-center gap-2 mb-4"><Printer className="text-white"/><h4 className="font-bold text-white uppercase tracking-wider">Stampanti Wi-Fi (Scontrino Fisico)</h4></div><p className="text-slate-400 text-sm mb-6">Abilitando queste opzioni, il <strong>Terminale del Reparto (es. Cucina)</strong> lancerà automaticamente la stampa quando arriva un nuovo ordine.<br/>La "Cassa / Totale" viene invece stampata subito dal terminale di Sala.</p><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{(['Cucina', 'Pizzeria', 'Pub', 'Cassa'] as string[]).map(dept => ( <div key={dept} className="flex justify-between items-center bg-slate-950 p-4 rounded-xl border border-slate-800"><div className="flex items-center gap-3">{dept === 'Cucina' && <ChefHat size={18} className="text-orange-500"/>}{dept === 'Pizzeria' && <Pizza size={18} className="text-red-500"/>}{dept === 'Pub' && <Sandwich size={18} className="text-amber-500"/>}{dept === 'Cassa' && <Receipt size={18} className="text-green-500"/>}<div className="flex flex-col"><span className="font-bold text-white">{dept === 'Cassa' ? 'Cassa / Totale' : dept}</span><span className="text-[9px] text-slate-500 uppercase">{dept === 'Cassa' ? 'Stampa da Sala' : 'Stampa al Reparto'}</span></div></div><button onClick={() => toggleTempPrint(dept)} className={`w-12 h-6 rounded-full relative transition-colors ${tempPrintSettings[dept] ? 'bg-green-500' : 'bg-slate-700'}`}><div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${tempPrintSettings[dept] ? 'left-7' : 'left-1'}`}></div></button></div> ))}</div></div></div></div>
                        )}
                        
                        {/* Analytics Tab - RESTORED */}
                        {adminTab === 'analytics' && (
                             <div className="max-w-5xl mx-auto pb-20 animate-fade-in">
                                <div className="flex justify-between items-center mb-6 bg-slate-900 p-4 rounded-2xl border border-slate-800">
                                    <div><h3 className="text-xl font-bold text-white">Analisi & Cassa</h3><p className="text-slate-400 text-sm">Resoconto Giornaliero</p></div>
                                    <div className="flex items-center bg-slate-950 rounded-xl p-1 border border-slate-800"><button onClick={() => changeDate(-1)} className="p-3 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><ChevronLeft/></button><div className="px-6 font-bold text-white flex items-center gap-2 uppercase tracking-wide"><Calendar size={18} className="text-orange-500"/> {formatDate(selectedDate)}</div><button onClick={() => changeDate(1)} className="p-3 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><ChevronRight/></button></div>
                                </div>
                                <div className="flex mb-6 bg-slate-900 p-1 rounded-xl w-max border border-slate-800">
                                    <button onClick={() => setAnalyticsView('stats')} className={`px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${analyticsView === 'stats' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}><BarChart3 size={16}/> Statistiche</button>
                                    <button onClick={() => setAnalyticsView('receipts')} className={`px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${analyticsView === 'receipts' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}><FileSpreadsheet size={16}/> Registro Scontrini</button>
                                </div>
                                {analyticsView === 'stats' ? (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800"><div className="flex justify-between items-start mb-2"><div className="p-3 bg-green-900/20 rounded-xl text-green-500"><DollarSign/></div><span className="text-xs font-bold text-slate-500 uppercase">Incasso</span></div><p className="text-3xl font-black text-white">€ {stats.totalRevenue.toFixed(2)}</p></div>
                                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800"><div className="flex justify-between items-start mb-2"><div className="p-3 bg-blue-900/20 rounded-xl text-blue-500"><UtensilsCrossed/></div><span className="text-xs font-bold text-slate-500 uppercase">Piatti</span></div><p className="text-3xl font-black text-white">{stats.totalItems}</p></div>
                                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800"><div className="flex justify-between items-start mb-2"><div className="p-3 bg-purple-900/20 rounded-xl text-purple-500"><History/></div><span className="text-xs font-bold text-slate-500 uppercase">Attesa Media</span></div><p className="text-3xl font-black text-white">{stats.avgWait} <span className="text-base font-medium text-slate-500">min</span></p></div>
                                        </div>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                                                <h4 className="text-white font-bold mb-6 flex items-center gap-2"><Star size={18} className="text-yellow-500"/> Piatti Più Venduti</h4>
                                                <div className="space-y-4">
                                                    {stats.topDishes.map((dish, idx) => (
                                                        <div key={idx} className="relative">
                                                            <div className="flex justify-between text-sm mb-1 z-10 relative">
                                                                <span className="font-bold text-slate-200">{dish.name}</span>
                                                                <span className="text-slate-400">{dish.count} ordini</span>
                                                            </div>
                                                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(dish.count / (stats.topDishes[0]?.count || 1)) * 100}%` }}></div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {stats.topDishes.length === 0 && <p className="text-slate-500 text-sm text-center py-4">Nessun dato disponibile</p>}
                                                </div>
                                            </div>
                                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                                                <h4 className="text-white font-bold mb-6 flex items-center gap-2"><Clock size={18} className="text-orange-500"/> Affluenza Oraria</h4>
                                                <div className="flex items-end justify-between h-40 gap-1 pt-4 border-b border-slate-800">
                                                    {stats.chartHours.map((h, i) => (
                                                        <div key={i} className="flex-1 flex flex-col justify-end items-center group">
                                                            {h.count > 0 && (<div className="mb-1 text-[9px] text-white font-bold bg-slate-700 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity absolute -translate-y-6">{h.count}</div>)}
                                                            <div className={`w-full rounded-t-sm transition-all hover:bg-orange-400 ${h.count > 0 ? 'bg-orange-500' : 'bg-slate-800'}`} style={{ height: `${(h.count / stats.maxHourly) * 100}%` }}></div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex justify-between text-[9px] text-slate-500 mt-2 font-mono uppercase"><span>00:00</span><span>12:00</span><span>23:00</span></div>
                                            </div>
                                        </div>
                                        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-3xl border border-indigo-500/30 shadow-lg shadow-indigo-900/20">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3 text-indigo-400"><Bot size={32} /><h3 className="text-2xl font-bold text-white">AI Strategy Advisor</h3></div>
                                                <button onClick={handleRunAiAnalysis} disabled={isAnalyzing} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">{isAnalyzing ? <Loader className="animate-spin" size={18}/> : <Sparkles size={18}/>}{isAnalyzing ? 'Analisi in corso...' : 'Genera Strategia'}</button>
                                            </div>
                                            {aiAnalysisResult ? (<div className="bg-slate-950/50 p-6 rounded-2xl border border-indigo-500/20 text-indigo-100 leading-relaxed whitespace-pre-wrap animate-fade-in shadow-inner">{aiAnalysisResult}</div>) : (<p className="text-slate-400 text-sm">Clicca su "Genera Strategia" per analizzare i dati di oggi con l'Intelligenza Artificiale.</p>)}
                                        </div>
                                    </>
                                ) : (
                                    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
                                        <div className="p-6 border-b border-slate-800 flex items-center gap-3"><Receipt size={24} className="text-green-500"/><h3 className="text-xl font-bold text-white">Archivio Scontrini</h3></div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-bold"><tr><th className="p-4">Ora</th><th className="p-4">Tavolo</th><th className="p-4">Staff</th><th className="p-4 text-right">Totale</th><th className="p-4 text-center">Azioni</th></tr></thead>
                                                <tbody className="divide-y divide-slate-800">
                                                    {filteredHistoryOrders.map(order => (
                                                        <tr key={order.id} className="hover:bg-slate-800/50 transition-colors">
                                                            <td className="p-4 font-mono text-slate-300">{new Date(order.createdAt || order.timestamp).toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}</td>
                                                            <td className="p-4 font-bold text-white">{order.tableNumber.replace('_HISTORY', '')}</td>
                                                            <td className="p-4 text-slate-400 text-sm">{order.waiterName || 'Staff'}</td>
                                                            <td className="p-4 text-right font-black text-green-400">€ {order.items.reduce((acc, i) => acc + (i.menuItem.price * i.quantity), 0).toFixed(2)}</td>
                                                            <td className="p-4 text-center"><div className="flex items-center justify-center gap-2"><button onClick={() => setViewOrderDetails(order)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-500/50 flex items-center gap-2 transition-colors shadow-lg shadow-blue-600/20"><Eye size={14}/> VISUALIZZA</button><button onClick={() => handleReprintReceipt(order)} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-700 flex items-center gap-2 transition-colors"><Printer size={14}/> RISTAMPA</button></div></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                             </div>
                        )}

                        {/* AI & Notif & Info tabs - RESTORED */}
                        {adminTab === 'ai' && (
                            <div className="max-w-xl mx-auto pb-20 animate-fade-in">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Bot className="text-indigo-500"/> AI Configuration</h3>
                                <div className="bg-slate-900 p-6 rounded-2xl border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
                                    <div className="mb-4">
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">API Key (Google Gemini)</label>
                                        <input type="password" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-4 pr-4 text-white focus:border-indigo-500 outline-none font-mono" placeholder="AIzaSy..."/>
                                    </div>
                                    <button onClick={handleSaveApiKey} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"><Save size={18}/> SALVA CHIAVE</button>
                                </div>
                            </div>
                        )}
                        
                        {adminTab === 'notif' && (
                            <div className="max-w-md mx-auto animate-fade-in">
                                <h3 className="text-xl font-bold text-white mb-6">Impostazioni Notifiche</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
                                        <div className="flex items-center gap-3"><div className="p-2 bg-orange-500/20 rounded-lg text-orange-500"><Bell size={20}/></div><div><p className="font-bold text-white">Suoni Cucina</p><p className="text-xs text-slate-400">Audio all'arrivo ordini</p></div></div>
                                        <button onClick={() => toggleNotif('kitchenSound')} className={`w-12 h-6 rounded-full relative transition-colors ${notifSettings.kitchenSound ? 'bg-green-500' : 'bg-slate-700'}`}><div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${notifSettings.kitchenSound ? 'left-7' : 'left-1'}`}></div></button>
                                    </div>
                                    <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
                                        <div className="flex items-center gap-3"><div className="p-2 bg-blue-500/20 rounded-lg text-blue-500"><Smartphone size={20}/></div><div><p className="font-bold text-white">Suoni Sala</p><p className="text-xs text-slate-400">Audio piatti pronti</p></div></div>
                                        <button onClick={() => toggleNotif('waiterSound')} className={`w-12 h-6 rounded-full relative transition-colors ${notifSettings.waiterSound ? 'bg-green-500' : 'bg-slate-700'}`}><div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${notifSettings.waiterSound ? 'left-7' : 'left-1'}`}></div></button>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {adminTab === 'info' && (
                            <div className="max-w-2xl mx-auto pb-20 animate-fade-in">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Info className="text-slate-400"/> Legenda Stati & Icone</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
                                        <h4 className="text-slate-400 text-xs font-bold uppercase mb-4 tracking-widest">Stati Ordine</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-yellow-500"></div><span className="text-white font-bold">In Attesa (Giallo)</span></div>
                                            <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-orange-500"></div><span className="text-white font-bold">In Preparazione (Arancio)</span></div>
                                            <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-green-500"></div><span className="text-white font-bold">Pronto (Verde)</span></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {isEditingItem && (
            <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                {/* Editor Modal UI */}
                <div className="bg-slate-900 border border-orange-500/30 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-slide-up relative flex flex-col max-h-[90vh]">
                    <div className="flex justify-between items-center mb-6 shrink-0">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Edit2 className="text-orange-500"/> {editingItem.id ? 'Modifica Piatto' : 'Nuovo Piatto'}</h2>
                        <button onClick={() => setIsEditingItem(false)} className="text-slate-400 hover:text-white p-2 rounded-full bg-slate-800"><X /></button>
                    </div>
                    
                    <div className="space-y-4 overflow-y-auto custom-scroll pr-2 flex-1">
                        {/* Form Inputs ... */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nome Piatto / Menu</label><input type="text" value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: capitalize(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-bold" autoFocus /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Prezzo (€)</label><input type="number" value={editingItem.price || ''} onChange={e => setEditingItem({...editingItem, price: parseFloat(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-right" placeholder="0.00" /></div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Categoria</label>
                            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700 overflow-x-auto">
                                {ADMIN_CATEGORY_ORDER.map(cat => (
                                    <button key={cat} onClick={() => setEditingItem({...editingItem, category: cat})} className={`flex-1 py-2 px-3 text-[10px] font-bold uppercase rounded-lg transition-all whitespace-nowrap ${editingItem.category === cat ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{cat === Category.MENU_COMPLETO ? '✨ MENU COMBO' : cat}</button>
                                ))}
                            </div>
                        </div>
                        
                        {/* IMAGE UPLOAD (Available for all) */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Foto</label>
                            <div className="flex items-center gap-4">
                                {editingItem.image ? (
                                    <div className="relative group"><img src={editingItem.image} alt="Preview" className="w-16 h-16 rounded-xl object-cover border-2 border-orange-500" /><button onClick={removeImage} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button></div>
                                ) : (
                                    <div className="w-16 h-16 bg-slate-950 rounded-xl border border-dashed border-slate-700 flex items-center justify-center text-slate-500"><ImageIcon size={20}/></div>
                                )}
                                <div className="flex-1"><input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" id="dish-image-upload"/><label htmlFor="dish-image-upload" className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase rounded-lg cursor-pointer transition-colors border border-slate-700"><Upload size={14}/> Carica Foto</label><p className="text-[10px] text-slate-500 mt-1">Formati: JPG, PNG. Max 1MB consigliato.</p></div>
                            </div>
                        </div>

                        {/* --- MENU COMPLETO SPECIFIC LOGIC (NO DEPT SELECTOR) --- */}
                        {editingItem.category === Category.MENU_COMPLETO ? (
                            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-700/50 space-y-4">
                                <div className="max-h-60 overflow-y-auto custom-scroll">
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block flex items-center gap-2"><ListPlus size={12}/> Componi Menu (Seleziona Piatti)</label>
                                    <p className="text-[10px] text-slate-400 mb-2">I piatti scelti verranno inviati ai rispettivi reparti automaticamente (es. Pizza al Forno, Bibita alla Sala).</p>
                                    <div className="space-y-1">
                                        {menuItems.filter(i => i.category !== Category.MENU_COMPLETO).map(item => {
                                            const isSelected = editingItem.comboItems?.includes(item.id);
                                            return (
                                                <button key={item.id} onClick={() => toggleComboItem(item.id)} className={`w-full flex justify-between items-center p-2 rounded-lg text-left transition-colors ${isSelected ? 'bg-orange-500/20 border border-orange-500' : 'bg-slate-900 border border-slate-800 hover:bg-slate-800'}`}>
                                                    <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-400'}`}>{item.name}</span>
                                                    {isSelected && <Check size={14} className="text-orange-500"/>}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* --- STANDARD DISH LOGIC --- */
                            <>
                                {/* ALLERGENS */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block flex items-center gap-2"><AlertTriangle size={12} className="text-orange-500"/> Allergeni</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {ALLERGENS_CONFIG.map(alg => {
                                            const isSelected = editingItem.allergens?.includes(alg.id);
                                            return (
                                                <button key={alg.id} onClick={() => toggleAllergen(alg.id)} className={`flex items-center justify-center gap-2 py-2 px-1 rounded-lg border text-[10px] font-bold uppercase transition-all ${isSelected ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'}`}>
                                                    <alg.icon size={12}/> {alg.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* INGREDIENTS BOX */}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase block">Ingredienti</label>
                                        <button onClick={handleGenerateIngredients} disabled={isGeneratingIngr || !editingItem.name} className="flex items-center gap-1 text-[10px] font-bold bg-indigo-600/50 hover:bg-indigo-500 text-indigo-100 px-2 py-1 rounded-lg transition-colors disabled:opacity-50">
                                            {isGeneratingIngr ? <Loader size={10} className="animate-spin"/> : <Sparkles size={10}/>} Genera
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <textarea value={editingItem.ingredients || ''} onChange={e => setEditingItem({...editingItem, ingredients: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm h-16 resize-none pr-10" placeholder="Es. Pomodoro, Mozzarella..." />
                                        <button onClick={() => handleDictation('ingr')} className={`absolute right-3 bottom-3 p-2 rounded-lg transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>{isListening ? <MicOff size={16}/> : <Mic size={16}/>}</button>
                                    </div>
                                </div>

                                {/* DESCRIPTION BOX */}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase block">Descrizione Menu</label>
                                        <button onClick={handleGenerateDescription} disabled={isGeneratingDesc || !editingItem.name} className="flex items-center gap-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                            {isGeneratingDesc ? <Loader size={10} className="animate-spin"/> : <Sparkles size={10}/>} ✨ Genera Descrizione
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <textarea value={editingItem.description || ''} onChange={e => setEditingItem({...editingItem, description: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm h-24 resize-none pr-10" placeholder="Descrizione poetica..." />
                                        <button onClick={() => handleDictation('desc')} className={`absolute right-3 bottom-3 p-2 rounded-lg transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>{isListening ? <MicOff size={16}/> : <Mic size={16}/>}</button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    
                    <button onClick={handleSaveMenu} className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-600/20 mt-4 flex items-center justify-center gap-2 shrink-0"><Save size={20}/> SALVA PIATTO</button>
                </div>
            </div>
        )}

        {viewOrderDetails && (
            <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-700 flex flex-col max-h-[80vh] relative animate-slide-up">
                    <button onClick={() => setViewOrderDetails(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full transition-colors"><X size={18}/></button>
                    <div className="text-center mb-6 pb-4 border-b border-slate-800"><h3 className="text-xl font-bold text-white mb-1">{restaurantName}</h3><div className="flex items-center justify-center gap-2 text-slate-400 text-xs uppercase font-bold tracking-widest"><Receipt size={14}/> Dettaglio Ordine</div></div>
                    <div className="flex justify-between items-center mb-4 bg-slate-950 p-3 rounded-xl border border-slate-800"><div><p className="text-[10px] text-slate-500 uppercase font-bold">Tavolo</p><p className="text-lg font-black text-white">{viewOrderDetails.tableNumber.replace('_HISTORY', '')}</p></div><div className="text-right"><p className="text-[10px] text-slate-500 uppercase font-bold">Data & Ora</p><p className="text-sm font-mono text-slate-300">{new Date(viewOrderDetails.createdAt || viewOrderDetails.timestamp).toLocaleDateString('it-IT')} <br/>{new Date(viewOrderDetails.createdAt || viewOrderDetails.timestamp).toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}</p></div></div>
                    <div className="flex-1 overflow-y-auto mb-4 custom-scroll pr-1"><div className="space-y-3">{viewOrderDetails.items.map((item, idx) => (<div key={idx} className="flex justify-between items-start text-sm"><div className="flex gap-3"><span className="font-bold text-white w-6 text-center bg-slate-800 rounded">{item.quantity}</span><div><span className="text-slate-200 font-bold block">{item.menuItem.name}</span>{item.notes && <span className="text-xs text-slate-500 italic block">Note: {item.notes}</span>}</div></div><span className="font-mono text-slate-400">€ {(item.menuItem.price * item.quantity).toFixed(2)}</span></div>))}</div></div>
                    <div className="pt-4 border-t border-slate-800"><div className="flex justify-between items-end mb-4"><span className="text-slate-400 font-bold uppercase text-xs">Totale</span><span className="text-2xl font-black text-green-500">€ {viewOrderDetails.items.reduce((acc, i) => acc + (i.menuItem.price * i.quantity), 0).toFixed(2)}</span></div><div className="flex gap-2"><button onClick={() => setViewOrderDetails(null)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors">Chiudi</button><button onClick={() => { handleReprintReceipt(viewOrderDetails); }} className="flex-1 py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"><Printer size={18}/> Stampa</button></div></div>
                </div>
            </div>
        )}

        {showResetModal && (
            <div className="absolute inset-0 z-[100] bg-red-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"><div className="bg-slate-900 w-full max-w-md rounded-3xl p-8 shadow-2xl border-2 border-red-600 flex flex-col items-center text-center animate-slide-up relative overflow-hidden"><div className="absolute top-0 left-0 w-full h-2 bg-red-600 animate-pulse"></div><div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center mb-6 text-red-500 animate-pulse border border-red-500/50"><Trash2 size={40} /></div><h2 className="text-3xl font-black text-white mb-2">SEI SICURO?</h2><p className="text-slate-300 mb-6 font-medium leading-relaxed">Stai per cancellare <strong className="text-red-400">TUTTI GLI ORDINI</strong>, il <strong className="text-red-400">MENU</strong> e le <strong className="text-red-400">STATISTICHE</strong>.<br/><br/>Questa operazione è <span className="underline decoration-red-500">irreversibile</span>.<br/>Le impostazioni del profilo e l'API Key rimarranno salvate.</p><div className="flex flex-col gap-3 w-full"><button onClick={handleFactoryReset} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black text-lg rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.4)] active:scale-95 transition-all">SÌ, CANCELLA TUTTO</button><button onClick={() => setShowResetModal(false)} className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all">ANNULLA</button></div></div></div>
        )}

        {itemToDelete && (
            <div className="absolute inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-slate-900 border border-red-500/30 rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center"><Trash2 size={48} className="text-red-500 mx-auto mb-4"/><h3 className="text-xl font-bold text-white mb-2">Eliminare {itemToDelete.name}?</h3><p className="text-slate-400 text-sm mb-6">Questa azione non può essere annullata.</p><div className="flex gap-3"><button onClick={() => setItemToDelete(null)} className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold">Annulla</button><button onClick={confirmDeleteMenu} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-600/20">Elimina</button></div></div></div>
        )}
      </div>
  );
}