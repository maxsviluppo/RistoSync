
import { Order, OrderStatus, OrderItem, MenuItem, AppSettings, Category, Department, NotificationSettings } from '../types';
import { supabase } from './supabase';

const STORAGE_KEY = 'ristosync_orders';
const TABLES_COUNT_KEY = 'ristosync_table_count';
const WAITER_KEY = 'ristosync_waiter_name';
const MENU_KEY = 'ristosync_menu_items';
const SETTINGS_NOTIFICATIONS_KEY = 'ristosync_settings_notifications';
const APP_SETTINGS_KEY = 'ristosync_app_settings'; // New Global Settings Key
const GOOGLE_API_KEY_STORAGE = 'ristosync_google_api_key';

// --- DEMO DATASET ---
const DEMO_MENU_ITEMS: MenuItem[] = [
    // ANTIPASTI
    { id: 'demo_a1', name: 'Tagliere del Contadino', price: 18, category: Category.ANTIPASTI, description: 'Selezione di salumi nostrani, formaggi stagionati, miele di castagno e noci.', allergens: ['Latticini', 'Frutta a guscio'], ingredients: 'Prosciutto crudo, Salame felino, Pecorino, Miele, Noci' },
    { id: 'demo_a2', name: 'Bruschette Miste', price: 8, category: Category.ANTIPASTI, description: 'Tris di bruschette: pomodoro fresco, patè di olive, crema di carciofi.', allergens: ['Glutine'], ingredients: 'Pane casereccio, Pomodoro, Aglio, Olio EVO, Olive' },
    
    // PRIMI
    { id: 'demo_p1', name: 'Spaghetti alla Carbonara', price: 12, category: Category.PRIMI, description: 'La vera ricetta romana con guanciale croccante, uova bio e pecorino.', allergens: ['Glutine', 'Uova', 'Latticini'], ingredients: 'Spaghetti, Guanciale, Tuorlo d\'uovo, Pecorino Romano, Pepe nero' },
    { id: 'demo_p2', name: 'Tonnarelli Cacio e Pepe', price: 11, category: Category.PRIMI, description: 'Cremosità unica con pecorino romano DOP e pepe nero tostato.', allergens: ['Glutine', 'Latticini'], ingredients: 'Tonnarelli freschi, Pecorino Romano, Pepe nero' },

    // SECONDI
    { id: 'demo_s1', name: 'Tagliata di Manzo', price: 22, category: Category.SECONDI, description: 'Controfiletto servito con rucola selvatica e scaglie di grana.', allergens: ['Latticini'], ingredients: 'Manzo, Rucola, Grana Padano, Aceto Balsamico' },
    
    // PIZZE
    { id: 'demo_pz1', name: 'Margherita DOP', price: 8, category: Category.PIZZE, description: 'Pomodoro San Marzano, Mozzarella di Bufala, Basilico fresco.', allergens: ['Glutine', 'Latticini'], ingredients: 'Impasto, Pomodoro, Mozzarella di Bufala, Basilico, Olio EVO' },
    
    // BEVANDE
    { id: 'demo_b1', name: 'Acqua Naturale 0.75cl', price: 2.5, category: Category.BEVANDE, description: 'Bottiglia in vetro.' },
    { id: 'demo_b2', name: 'Coca Cola 33cl', price: 3.5, category: Category.BEVANDE, description: 'In vetro.' },
    { id: 'demo_b3', name: 'Caffè Espresso', price: 1.5, category: Category.BEVANDE, description: 'Miscela 100% Arabica.' }
];

// --- SYNC ENGINE STATE ---
let currentUserId: string | null = null;
let pollingInterval: any = null;

// HELPER: SAFE STORAGE SAVE
// Handles "QuotaExceededError" by cleaning up old delivered orders locally
const safeLocalStorageSave = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.message?.toLowerCase().includes('quota')) {
            console.warn("⚠️ STORAGE FULL: Cleaning up old local history...");
            
            // If we are saving orders, try to trim the list
            if (key === STORAGE_KEY) {
                try {
                    const orders = JSON.parse(value) as Order[];
                    // Keep ONLY Active Orders + Delivered from last 6 hours locally to free space
                    const cutoff = Date.now() - (6 * 60 * 60 * 1000);
                    const streamlined = orders.filter(o => 
                        o.status !== OrderStatus.DELIVERED || o.timestamp > cutoff
                    );
                    
                    console.log(`Cleaned ${orders.length - streamlined.length} old orders from local cache.`);
                    localStorage.setItem(key, JSON.stringify(streamlined));
                    return; // Success after clean
                } catch (cleanError) {
                    console.error("Cleanup failed:", cleanError);
                }
            }
            alert("⚠️ MEMORIA DISPOSITIVO PIENA. Impossibile salvare localmente. L'app continuerà a funzionare ma potresti perdere lo storico locale. Ricarica la pagina.");
        }
    }
};

// Initialize Realtime Subscription
export const initSupabaseSync = async () => {
    if (!supabase) return;

    // Get Current User
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
        currentUserId = session.user.id;
        
        // 1. Initial Sync
        await fetchFromCloud(); 
        await fetchFromCloudMenu();
        await fetchSettingsFromCloud(); // New: Fetch global settings
        
        // 2. Sync Profile Settings (API KEY)
        const { data: profile } = await supabase.from('profiles').select('google_api_key').eq('id', currentUserId).single();
        if (profile?.google_api_key) {
            safeLocalStorageSave(GOOGLE_API_KEY_STORAGE, profile.google_api_key);
        }

        // 3. Realtime Subscription (Robust Mode)
        // We create a unique channel for this user/restaurant
        const channel = supabase.channel(`room:${currentUserId}`);

        channel
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'orders',
                filter: `user_id=eq.${currentUserId}` // Filter by user ID
            }, (payload) => {
                fetchFromCloud(); 
            })
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'menu_items',
                filter: `user_id=eq.${currentUserId}` // Filter by user ID
            }, () => {
                fetchFromCloudMenu();
            })
            // NEW: Listen for Settings changes in Profile
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${currentUserId}`
            }, (payload) => {
                if (payload.new.settings) {
                    safeLocalStorageSave(APP_SETTINGS_KEY, JSON.stringify(payload.new.settings));
                    window.dispatchEvent(new Event('local-settings-update'));
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // console.log('Connected to Realtime Cloud');
                }
            });

        // 4. Fallback Polling (Heartbeat)
        if (pollingInterval) clearInterval(pollingInterval);
        pollingInterval = setInterval(() => {
            fetchFromCloud();
            fetchSettingsFromCloud();
        }, 15000);
    }
};

const handleSupabaseError = (error: any) => {
    if (!error) return;
    console.error("Supabase Error:", error);
    // Don't alert on Quota Exceeded during sync, just log it. We don't want to spam the user.
    // The alert will happen on explicit actions if needed.
    return error;
}

const fetchFromCloud = async () => {
    if (!supabase || !currentUserId) return;
    
    // OPTIMIZATION: Only fetch Active orders OR items created in last 48 hours to save bandwidth/storage
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', currentUserId)
        .or(`status.neq.${OrderStatus.DELIVERED},created_at.gt.${twoDaysAgo.toISOString()}`);

    if (error) {
        handleSupabaseError(error);
        return;
    }
    
    // Convert DB format to App format
    const appOrders: Order[] = data.map((row: any) => ({
        id: row.id,
        table_number: row.table_number, // Handle both snake_case from DB
        tableNumber: row.table_number,  // and camelCase for App
        status: row.status as OrderStatus,
        timestamp: parseInt(row.timestamp) || new Date(row.created_at).getTime(),
        createdAt: new Date(row.created_at).getTime(), // Map DB created_at to App createdAt
        items: row.items,
        waiterName: row.waiter_name
    }));

    // Update Local Cache using Safe Save
    safeLocalStorageSave(STORAGE_KEY, JSON.stringify(appOrders));
    window.dispatchEvent(new Event('local-storage-update'));
};

const fetchFromCloudMenu = async () => {
    if (!supabase || !currentUserId) return;
    const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('user_id', currentUserId);

    if (error) handleSupabaseError(error);

    if (!error && data) {
         const appMenuItems: MenuItem[] = data.map((row: any) => ({
             id: row.id,
             name: row.name,
             price: row.price,
             category: row.category,
             description: row.description,
             ingredients: row.ingredients, 
             allergens: row.allergens,
             image: row.image,
             isCombo: row.category === Category.MENU_COMPLETO, 
             comboItems: row.combo_items || [], 
             specificDepartment: row.specific_department
         }));

         safeLocalStorageSave(MENU_KEY, JSON.stringify(appMenuItems));
         window.dispatchEvent(new Event('local-menu-update'));
    }
};

const fetchSettingsFromCloud = async () => {
    if (!supabase || !currentUserId) return;
    const { data, error } = await supabase.from('profiles').select('settings').eq('id', currentUserId).single();
    if (!error && data?.settings) {
        safeLocalStorageSave(APP_SETTINGS_KEY, JSON.stringify(data.settings));
        window.dispatchEvent(new Event('local-settings-update'));
    }
};

// --- ORDER MANAGEMENT ---
export const getOrders = (): Order[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

const saveLocallyAndNotify = (orders: Order[]) => {
    safeLocalStorageSave(STORAGE_KEY, JSON.stringify(orders));
    window.dispatchEvent(new Event('local-storage-update'));
};

// HELPER: Sync individual order to Cloud (NON-BLOCKING)
const syncOrderToCloud = async (order: Order, isDelete = false) => {
    if (!supabase || !currentUserId) return;
    
    // We do NOT await this in critical paths to avoid UI blocking if DB is slow/full
    try {
        if (isDelete) {
            await supabase.from('orders').delete().eq('id', order.id);
        } else {
            const payload = {
                id: order.id,
                user_id: currentUserId,
                table_number: order.tableNumber,
                status: order.status,
                items: order.items,
                timestamp: order.timestamp,
                waiter_name: order.waiterName
            };
            await supabase.from('orders').upsert(payload);
        }
    } catch (e) {
        console.warn("Cloud sync failed (Offline mode active):", e);
    }
};

export const saveOrders = (orders: Order[]) => {
  saveLocallyAndNotify(orders);
};

export const addOrder = async (order: Order) => {
  const orders = getOrders();
  const settings = getAppSettings(); 
  const now = Date.now();

  const cleanOrder: Order = {
      ...order,
      timestamp: now,
      createdAt: now, 
      items: order.items.map(i => {
          const dest = settings.categoryDestinations ? settings.categoryDestinations[i.menuItem.category] : 'Cucina';
          const isSala = dest === 'Sala';
          
          return { 
              ...i, 
              completed: isSala, 
              served: false, 
              isAddedLater: false,
              comboCompletedParts: [],
              comboServedParts: []
          };
      })
  };
  const newOrders = [...orders, cleanOrder];
  
  // 1. SAVE LOCALLY IMMEDIATELY (Critical for speed/stability)
  saveLocallyAndNotify(newOrders);
  
  // 2. SYNC TO CLOUD IN BACKGROUND
  syncOrderToCloud(cleanOrder);
};

export const updateOrderStatus = (orderId: string, status: OrderStatus) => {
  const orders = getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  const updatedOrder = { ...order, status };
  const newOrders = orders.map(o => o.id === orderId ? updatedOrder : o);
  
  saveLocallyAndNotify(newOrders);
  syncOrderToCloud(updatedOrder);
};

export const updateOrderItems = async (orderId: string, newItems: OrderItem[]) => {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    const settings = getAppSettings();
    if (!order) return;

    const mergedItems = [...order.items];

    newItems.forEach(newItem => {
        const existingIndex = mergedItems.findIndex(old => 
            old.menuItem.id === newItem.menuItem.id && 
            (old.notes || '') === (newItem.notes || '')
        );

        if (existingIndex >= 0) {
            const existing = mergedItems[existingIndex];
            mergedItems[existingIndex] = {
                ...existing,
                quantity: existing.quantity + newItem.quantity,
                completed: false, 
                served: false,
                isAddedLater: true,
                comboCompletedParts: existing.comboCompletedParts || [],
                comboServedParts: existing.comboServedParts || []
            };
        } else {
            const dest = settings.categoryDestinations ? settings.categoryDestinations[newItem.menuItem.category] : 'Cucina';
            const isSala = dest === 'Sala';
            
            mergedItems.push({
                ...newItem,
                completed: isSala,
                served: false,
                isAddedLater: true,
                comboCompletedParts: [],
                comboServedParts: []
            });
        }
    });

    let newStatus = order.status;
    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.READY) {
        newStatus = OrderStatus.PENDING; 
    }

    const updatedOrder = { 
        ...order, 
        items: mergedItems, 
        timestamp: Date.now(), 
        status: newStatus 
    };
    const newOrders = orders.map(o => o.id === orderId ? updatedOrder : o);

    // 1. SAVE LOCALLY IMMEDIATELY
    saveLocallyAndNotify(newOrders);
    
    // 2. SYNC TO CLOUD
    syncOrderToCloud(updatedOrder);
};

export const toggleOrderItemCompletion = (orderId: string, itemIndex: number, subItemId?: string) => {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const newItems = [...order.items];
    const targetItem = newItems[itemIndex];

    if (targetItem) {
        if (subItemId && targetItem.menuItem.category === Category.MENU_COMPLETO && targetItem.menuItem.comboItems) {
            const currentParts = targetItem.comboCompletedParts || [];
            let newParts;
            if (currentParts.includes(subItemId)) {
                newParts = currentParts.filter(id => id !== subItemId);
            } else {
                newParts = [...currentParts, subItemId];
            }
            newItems[itemIndex] = { ...targetItem, comboCompletedParts: newParts };
            const allPartsDone = targetItem.menuItem.comboItems.every(id => newParts.includes(id));
            newItems[itemIndex].completed = allPartsDone;
        } else {
            newItems[itemIndex] = { ...targetItem, completed: !targetItem.completed };
        }
    }

    const allCooked = newItems.every(i => i.completed);
    const anyCooked = newItems.some(i => i.completed || (i.comboCompletedParts && i.comboCompletedParts.length > 0));
    
    let newStatus = order.status;
    if (order.status !== OrderStatus.DELIVERED) {
        if (allCooked) newStatus = OrderStatus.READY;
        else if (anyCooked) newStatus = OrderStatus.COOKING;
        else if (!anyCooked) newStatus = OrderStatus.PENDING;
    }

    const updatedOrder = { ...order, items: newItems, status: newStatus };
    const newOrders = orders.map(o => o.id === orderId ? updatedOrder : o);
    
    saveLocallyAndNotify(newOrders);
    syncOrderToCloud(updatedOrder);
};

export const serveItem = (orderId: string, itemIndex: number, subItemId?: string) => {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const newItems = [...order.items];
    const targetItem = newItems[itemIndex];

    if (targetItem) {
        if (subItemId && targetItem.menuItem.category === Category.MENU_COMPLETO && targetItem.menuItem.comboItems) {
            const currentServed = targetItem.comboServedParts || [];
            let newServed = currentServed;
            if (!currentServed.includes(subItemId)) {
                newServed = [...currentServed, subItemId];
            }
            newItems[itemIndex] = { ...targetItem, comboServedParts: newServed };
            const allPartsServed = targetItem.menuItem.comboItems.every(id => newServed.includes(id));
            if (allPartsServed) newItems[itemIndex].served = true;
        } else {
            newItems[itemIndex] = { ...targetItem, served: true };
        }
    }

    const allServed = newItems.every(i => i.served);
    let newStatus = order.status;
    if (allServed && (newStatus === OrderStatus.READY || newStatus === OrderStatus.COOKING)) {
        newStatus = OrderStatus.PENDING;
    }

    const updatedOrder = { ...order, items: newItems, status: newStatus, timestamp: Date.now() };
    const newOrders = orders.map(o => o.id === orderId ? updatedOrder : o);
    
    saveLocallyAndNotify(newOrders);
    syncOrderToCloud(updatedOrder);
};

export const clearHistory = async () => {
  const orders = getOrders();
  const activeOrders = orders.filter(o => o.status !== OrderStatus.DELIVERED);
  saveLocallyAndNotify(activeOrders);
  
  if (supabase && currentUserId) {
      await supabase.from('orders').delete().eq('user_id', currentUserId).eq('status', OrderStatus.DELIVERED);
  }
};

export const deleteHistoryByDate = async (targetDate: Date) => {
    const orders = getOrders();
    const ordersToKeep = orders.filter(o => {
        if (o.status !== OrderStatus.DELIVERED) return true; 
        const orderDate = new Date(o.createdAt || o.timestamp);
        const isSameDay = orderDate.getDate() === targetDate.getDate() &&
                          orderDate.getMonth() === targetDate.getMonth() &&
                          orderDate.getFullYear() === targetDate.getFullYear();
        return !isSameDay; 
    });

    saveLocallyAndNotify(ordersToKeep);

    if (supabase && currentUserId) {
        const startOfDay = new Date(targetDate); startOfDay.setHours(0,0,0,0);
        const endOfDay = new Date(targetDate); endOfDay.setHours(23,59,59,999);
        const { error } = await supabase.from('orders')
            .delete()
            .eq('user_id', currentUserId)
            .eq('status', OrderStatus.DELIVERED)
            .gte('created_at', startOfDay.toISOString())
            .lte('created_at', endOfDay.toISOString());
        if (error) handleSupabaseError(error);
    }
};

export const freeTable = async (tableNumber: string) => {
    const orders = getOrders();
    const tableOrders = orders.filter(o => o.tableNumber === tableNumber);
    const otherOrders = orders.filter(o => o.tableNumber !== tableNumber);
    
    const archivedOrders = tableOrders.map(o => ({
        ...o,
        status: OrderStatus.DELIVERED,
        tableNumber: `${o.tableNumber}_HISTORY`,
        timestamp: Date.now() 
    }));

    const newOrders = [...otherOrders, ...archivedOrders];
    saveLocallyAndNotify(newOrders);

    if (supabase && currentUserId) {
        for (const o of archivedOrders) {
            await syncOrderToCloud(o);
        }
    }
};

export const performFactoryReset = async () => {
    localStorage.setItem(STORAGE_KEY, '[]');
    localStorage.setItem(MENU_KEY, '[]');
    window.dispatchEvent(new Event('local-storage-update'));
    window.dispatchEvent(new Event('local-menu-update'));

    if (supabase && currentUserId) {
        await supabase.from('orders').delete().eq('user_id', currentUserId);
        await supabase.from('menu_items').delete().eq('user_id', currentUserId);
    }
};

export const deleteAllMenuItems = async () => {
    localStorage.setItem(MENU_KEY, '[]');
    window.dispatchEvent(new Event('local-menu-update'));

    if (supabase && currentUserId) {
        const { error } = await supabase.from('menu_items').delete().eq('user_id', currentUserId);
        if (error) handleSupabaseError(error);
    }
};

export const importDemoMenu = async () => {
    if (!currentUserId || !supabase) return;

    const demoItemsWithUserId = DEMO_MENU_ITEMS.map(item => ({
        id: item.id,
        user_id: currentUserId,
        name: item.name,
        price: item.price,
        category: item.category,
        description: item.description,
        ingredients: item.ingredients,
        allergens: item.allergens,
        image: item.image,
        combo_items: item.comboItems, 
        specific_department: item.specificDepartment
    }));

    const { error } = await supabase.from('menu_items').upsert(demoItemsWithUserId);
    if (error) {
        handleSupabaseError(error);
        alert("Errore durante l'importazione demo.");
        return;
    }

    const currentItems = getMenuItems();
    const newIds = DEMO_MENU_ITEMS.map(d => d.id);
    const existingFiltered = currentItems.filter(i => !newIds.includes(i.id));
    const finalMenu = [...existingFiltered, ...DEMO_MENU_ITEMS];
    safeLocalStorageSave(MENU_KEY, JSON.stringify(finalMenu));
    window.dispatchEvent(new Event('local-menu-update'));
    alert("Menu Demo importato con successo!");
};

export const getTableCount = (): number => {
    const settings = getAppSettings();
    return settings.restaurantProfile?.tableCount || 12;
};

export const saveTableCount = (count: number) => {
    safeLocalStorageSave(TABLES_COUNT_KEY, count.toString());
    window.dispatchEvent(new Event('local-storage-update'));
};

export const getWaiterName = (): string | null => {
    return localStorage.getItem(WAITER_KEY);
};

export const saveWaiterName = (name: string) => {
    localStorage.setItem(WAITER_KEY, name);
};

export const logoutWaiter = () => {
    localStorage.removeItem(WAITER_KEY);
};

export const getMenuItems = (): MenuItem[] => {
    const data = localStorage.getItem(MENU_KEY);
    return data ? JSON.parse(data) : [];
};

const syncMenuToCloud = async (item: MenuItem, isDelete = false) => {
    if (!supabase || !currentUserId) return;
    try {
        if (isDelete) {
            await supabase.from('menu_items').delete().eq('id', item.id);
        } else {
             const payload = {
                id: item.id,
                user_id: currentUserId,
                name: item.name,
                price: item.price,
                category: item.category,
                description: item.description,
                ingredients: item.ingredients,
                allergens: item.allergens,
                image: item.image,
                combo_items: item.comboItems, 
                specific_department: item.specificDepartment
            };
            await supabase.from('menu_items').upsert(payload);
        }
    } catch (e) { console.warn("Menu sync failed", e); }
};

export const saveMenuItems = (items: MenuItem[]) => {
    safeLocalStorageSave(MENU_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('local-menu-update'));
};

export const addMenuItem = (item: MenuItem) => {
    const items = getMenuItems();
    items.push(item);
    saveMenuItems(items);
    syncMenuToCloud(item);
};

export const updateMenuItem = (updatedItem: MenuItem) => {
    const items = getMenuItems();
    const newItems = items.map(i => i.id === updatedItem.id ? updatedItem : i);
    saveMenuItems(newItems);
    syncMenuToCloud(updatedItem);
};

export const deleteMenuItem = (id: string) => {
    const items = getMenuItems();
    const itemToDelete = items.find(i => i.id === id);
    const newItems = items.filter(i => i.id !== id);
    saveMenuItems(newItems);
    if (itemToDelete) syncMenuToCloud(itemToDelete, true);
};

export const getGoogleApiKey = (): string | null => {
    return localStorage.getItem(GOOGLE_API_KEY_STORAGE);
};

export const saveGoogleApiKey = async (apiKey: string) => {
    localStorage.setItem(GOOGLE_API_KEY_STORAGE, apiKey);
    if (supabase && currentUserId) {
        const { error } = await supabase
            .from('profiles')
            .update({ google_api_key: apiKey })
            .eq('id', currentUserId);
        if (error) console.error("Failed to save API Key to cloud", error);
    }
};

const DEFAULT_SETTINGS: AppSettings = {
    categoryDestinations: {
        [Category.MENU_COMPLETO]: 'Cucina',
        [Category.ANTIPASTI]: 'Cucina',
        [Category.PANINI]: 'Pub', 
        [Category.PIZZE]: 'Pizzeria', 
        [Category.PRIMI]: 'Cucina',
        [Category.SECONDI]: 'Cucina',
        [Category.DOLCI]: 'Cucina',
        [Category.BEVANDE]: 'Sala'
    },
    printEnabled: {
        'Cucina': false,
        'Pizzeria': false,
        'Pub': false,
        'Sala': false,
        'Cassa': false
    },
    restaurantProfile: {
        tableCount: 12
    }
};

export const getAppSettings = (): AppSettings => {
    const data = localStorage.getItem(APP_SETTINGS_KEY);
    if (!data) return DEFAULT_SETTINGS;
    try {
        const parsed = JSON.parse(data);
        return {
            ...DEFAULT_SETTINGS,
            ...parsed,
            categoryDestinations: {
                ...DEFAULT_SETTINGS.categoryDestinations,
                ...(parsed.categoryDestinations || {})
            },
            printEnabled: {
                ...DEFAULT_SETTINGS.printEnabled,
                ...(parsed.printEnabled || {})
            },
            restaurantProfile: {
                ...DEFAULT_SETTINGS.restaurantProfile,
                ...(parsed.restaurantProfile || {})
            }
        };
    } catch (e) {
        return DEFAULT_SETTINGS;
    }
};

export const saveAppSettings = async (settings: AppSettings) => {
    safeLocalStorageSave(APP_SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event('local-settings-update'));
    window.dispatchEvent(new Event('local-storage-update')); 

    if (supabase && currentUserId) {
        try {
            await supabase.from('profiles').update({ settings: settings }).eq('id', currentUserId);
        } catch (e) { console.warn("Settings sync failed", e); }
    }
};

export const getNotificationSettings = (): NotificationSettings => {
    const data = localStorage.getItem(SETTINGS_NOTIFICATIONS_KEY);
    return data ? JSON.parse(data) : { kitchenSound: true, waiterSound: true, pushEnabled: false };
};

export const saveNotificationSettings = (settings: NotificationSettings) => {
    localStorage.setItem(SETTINGS_NOTIFICATIONS_KEY, JSON.stringify(settings));
};
