
import { Order, OrderStatus, OrderItem, MenuItem, AppSettings, Category, Department, NotificationSettings } from '../types';
import { supabase } from './supabase';

const STORAGE_KEY = 'ristosync_orders';
const MENU_KEY = 'ristosync_menu_items';
const SETTINGS_NOTIFICATIONS_KEY = 'ristosync_settings_notifications';
const APP_SETTINGS_KEY = 'ristosync_app_settings'; 
const GOOGLE_API_KEY_STORAGE = 'ristosync_google_api_key';
const WAITER_KEY = 'ristosync_waiter_name';

// --- DEMO DATASET ---
const DEMO_MENU_ITEMS: MenuItem[] = [
    { id: 'demo_a1', name: 'Tagliere del Contadino', price: 18, category: Category.ANTIPASTI, description: 'Selezione di salumi nostrani, formaggi stagionati, miele di castagno e noci.', allergens: ['Latticini', 'Frutta a guscio'], ingredients: 'Prosciutto crudo, Salame felino, Pecorino, Miele, Noci' },
    { id: 'demo_a2', name: 'Bruschette Miste', price: 8, category: Category.ANTIPASTI, description: 'Tris di bruschette: pomodoro fresco, patè di olive, crema di carciofi.', allergens: ['Glutine'], ingredients: 'Pane casereccio, Pomodoro, Aglio, Olio EVO, Olive' },
    { id: 'demo_p1', name: 'Spaghetti alla Carbonara', price: 12, category: Category.PRIMI, description: 'La vera ricetta romana con guanciale croccante, uova bio e pecorino.', allergens: ['Glutine', 'Uova', 'Latticini'], ingredients: 'Spaghetti, Guanciale, Tuorlo d\'uovo, Pecorino Romano, Pepe nero' },
    { id: 'demo_p2', name: 'Tonnarelli Cacio e Pepe', price: 11, category: Category.PRIMI, description: 'Cremosità unica con pecorino romano DOP e pepe nero tostato.', allergens: ['Glutine', 'Latticini'], ingredients: 'Tonnarelli freschi, Pecorino Romano, Pepe nero' },
    { id: 'demo_s1', name: 'Tagliata di Manzo', price: 22, category: Category.SECONDI, description: 'Controfiletto servito con rucola selvatica e scaglie di grana.', allergens: ['Latticini'], ingredients: 'Manzo, Rucola, Grana Padano, Aceto Balsamico' },
    { id: 'demo_pz1', name: 'Margherita DOP', price: 8, category: Category.PIZZE, description: 'Pomodoro San Marzano, Mozzarella di Bufala, Basilico fresco.', allergens: ['Glutine', 'Latticini'], ingredients: 'Impasto, Pomodoro, Mozzarella di Bufala, Basilico, Olio EVO' },
    { id: 'demo_b1', name: 'Acqua Naturale 0.75cl', price: 2.5, category: Category.BEVANDE, description: 'Bottiglia in vetro.' },
    { id: 'demo_b2', name: 'Coca Cola 33cl', price: 3.5, category: Category.BEVANDE, description: 'In vetro.' },
    { id: 'demo_b3', name: 'Caffè Espresso', price: 1.5, category: Category.BEVANDE, description: 'Miscela 100% Arabica.' }
];

// --- SYNC ENGINE STATE ---
let currentUserId: string | null = null;
let pollingInterval: any = null;
let isSyncing = false; 
let realtimeChannel: any = null;
let isConnected = false;

// HELPER: SAFE STORAGE SAVE
const safeLocalStorageSave = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch (e: any) {
        console.error("Storage Save Error:", e);
    }
};

// --- API KEY HELPERS ---
export const getGoogleApiKey = (): string | null => {
    return localStorage.getItem(GOOGLE_API_KEY_STORAGE);
};

export const saveGoogleApiKey = (key: string) => {
    safeLocalStorageSave(GOOGLE_API_KEY_STORAGE, key);
};

// --- ORDER MANAGEMENT ---

export const getOrders = (): Order[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

export const saveOrders = (orders: Order[], skipSync = false) => {
    safeLocalStorageSave(STORAGE_KEY, JSON.stringify(orders));
    window.dispatchEvent(new Event('local-storage-update'));
    if (!skipSync) forceCloudSync();
};

export const addOrder = async (order: Order) => {
    const orders = getOrders();
    // FORCE overwrite waiter name to ensure current user can access it immediately
    order.waiterName = getWaiterName() || 'Staff';
    orders.push(order);
    saveOrders(orders);
};

export const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.status = status;
        order.timestamp = Date.now();
        saveOrders(orders);
    }
};

export const updateOrderItems = async (orderId: string, newItems: OrderItem[]) => {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
        const existingItems = order.items || [];
        const isLateAddition = order.status !== OrderStatus.PENDING;
        
        const itemsToAdd = newItems.map(i => ({
            ...i,
            isAddedLater: isLateAddition ? true : i.isAddedLater,
            served: false,
            completed: false
        }));
        
        order.items = [...existingItems, ...itemsToAdd];
        order.timestamp = Date.now();
        
        // CRITICAL FIX: Update waiter name to current user on edit
        // This ensures if "Marco" opens it, and "Giulia" adds to it, "Giulia" effectively takes over or at least has access.
        const currentWaiter = getWaiterName();
        if (currentWaiter) {
            order.waiterName = currentWaiter; 
        }

        // Reopen order if needed
        if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.READY) {
            order.status = OrderStatus.COOKING; 
        }

        saveOrders(orders);
    }
};

export const toggleOrderItemCompletion = (orderId: string, itemIndex: number, subItemId?: string) => {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order || !order.items[itemIndex]) return;

    const item = order.items[itemIndex];

    if (subItemId) {
        let completedParts = item.comboCompletedParts || [];
        if (completedParts.includes(subItemId)) {
            completedParts = completedParts.filter(id => id !== subItemId);
        } else {
            completedParts.push(subItemId);
        }
        item.comboCompletedParts = completedParts;
    } else {
        item.completed = !item.completed;
    }
    
    const allItemsCompleted = order.items.every(i => i.completed);

    if (allItemsCompleted && order.status === OrderStatus.COOKING) {
        order.status = OrderStatus.READY;
        order.timestamp = Date.now();
    } else if (!allItemsCompleted && order.status === OrderStatus.READY) {
        order.status = OrderStatus.COOKING;
        order.timestamp = Date.now();
    }

    saveOrders(orders);
};

export const serveItem = (orderId: string, itemIndex: number) => {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order || !order.items[itemIndex]) return;

    order.items[itemIndex].served = true;
    
    const allServed = order.items.every(i => i.served);
    if (allServed) {
         order.status = OrderStatus.DELIVERED;
         order.timestamp = Date.now(); 
    }

    saveOrders(orders);
};

export const deleteHistoryByDate = (date: Date) => {
    const orders = getOrders();
    const activeOrders = orders.filter(o => o.status !== OrderStatus.DELIVERED);
    saveOrders(activeOrders);
};

export const freeTable = (tableNumber: string) => {
    const orders = getOrders();
    
    // AGGRESSIVE FIX: 
    // Find ANY order for this table that is not DELIVERED and force it to DELIVERED.
    // Ignores ownership, ignores status. Just closes it.
    let modifications = 0;
    orders.forEach(o => {
        if (o.tableNumber === tableNumber && o.status !== OrderStatus.DELIVERED) {
            o.status = OrderStatus.DELIVERED;
            o.timestamp = Date.now();
            modifications++;
        }
    });
    
    if (modifications > 0) {
        saveOrders(orders);
    } else {
        // Double check: if no order was found but UI shows it, it might be stale state.
        // We force a save event anyway to refresh UI.
        window.dispatchEvent(new Event('local-storage-update'));
    }
};

// --- MENU MANAGEMENT ---

export const getMenuItems = (): MenuItem[] => {
    const data = localStorage.getItem(MENU_KEY);
    return data ? JSON.parse(data) : [];
};

export const saveMenuItems = (items: MenuItem[], skipSync = false) => {
    safeLocalStorageSave(MENU_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('local-menu-update'));
    if (!skipSync) forceCloudSync();
};

export const addMenuItem = (item: MenuItem) => {
    const items = getMenuItems();
    items.push(item);
    saveMenuItems(items);
};

export const updateMenuItem = (item: MenuItem) => {
    const items = getMenuItems();
    const index = items.findIndex(i => i.id === item.id);
    if (index !== -1) {
        items[index] = item;
        saveMenuItems(items);
    }
};

export const deleteMenuItem = (id: string) => {
    const items = getMenuItems();
    const filtered = items.filter(i => i.id !== id);
    saveMenuItems(filtered);
};

export const deleteAllMenuItems = () => {
    saveMenuItems([]);
};

export const importDemoMenu = async () => {
    saveMenuItems(DEMO_MENU_ITEMS);
};

// --- APP SETTINGS ---

export const getAppSettings = (): AppSettings => {
    const data = localStorage.getItem(APP_SETTINGS_KEY);
    const defaultSettings: AppSettings = {
        categoryDestinations: {
            [Category.MENU_COMPLETO]: 'Cucina',
            [Category.ANTIPASTI]: 'Cucina',
            [Category.PRIMI]: 'Cucina',
            [Category.SECONDI]: 'Cucina',
            [Category.PIZZE]: 'Pizzeria',
            [Category.PANINI]: 'Pub',
            [Category.DOLCI]: 'Cucina',
            [Category.BEVANDE]: 'Sala'
        },
        printEnabled: { 'Cucina': false, 'Pizzeria': false, 'Pub': false, 'Sala': false, 'Cassa': false },
        restaurantProfile: {
            tableCount: 12
        }
    };
    return data ? { ...defaultSettings, ...JSON.parse(data) } : defaultSettings;
};

export const saveAppSettings = async (settings: AppSettings) => {
    safeLocalStorageSave(APP_SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event('local-settings-update'));
    
    if (settings.restaurantProfile && supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
             const profileToSave = JSON.parse(JSON.stringify(settings.restaurantProfile));
             const { data: currentProfile } = await supabase.from('profiles').select('settings').eq('id', user.id).single();
             const currentSettings = currentProfile?.settings || {};
             
             await supabase.from('profiles').update({
                 restaurant_name: profileToSave.name,
                 settings: {
                     ...currentSettings,
                     restaurantProfile: {
                         ...currentSettings.restaurantProfile,
                         ...profileToSave
                     }
                 }
             }).eq('id', user.id);
        }
    }
};

export const getTableCount = (): number => {
    const settings = getAppSettings();
    return settings.restaurantProfile?.tableCount || 12;
};

// --- WAITER HELPERS ---

export const getWaiterName = (): string | null => {
    return localStorage.getItem(WAITER_KEY);
};

export const saveWaiterName = (name: string) => {
    localStorage.setItem(WAITER_KEY, name);
};

export const logoutWaiter = () => {
    localStorage.removeItem(WAITER_KEY);
};

// --- NOTIFICATIONS ---

export const getNotificationSettings = (): NotificationSettings => {
    const data = localStorage.getItem(SETTINGS_NOTIFICATIONS_KEY);
    return data ? JSON.parse(data) : { kitchenSound: true, waiterSound: true, pushEnabled: false };
};

export const saveNotificationSettings = (settings: NotificationSettings) => {
    safeLocalStorageSave(SETTINGS_NOTIFICATIONS_KEY, JSON.stringify(settings));
};

export const performFactoryReset = () => {
    localStorage.clear();
    window.location.reload();
};

// --- CLOUD SYNC ENGINE (SUPABASE) ---

export const getConnectionStatus = () => isConnected;

const updateConnectionStatus = (status: boolean) => {
    isConnected = status;
    window.dispatchEvent(new CustomEvent('connection-status-change', { detail: { connected: status } }));
};

export const initSupabaseSync = async () => {
    if (!supabase) {
        updateConnectionStatus(false);
        return;
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            updateConnectionStatus(false);
            return;
        }

        currentUserId = session.user.id;
        updateConnectionStatus(true);

        await forceCloudSync();

        if (!realtimeChannel) {
            realtimeChannel = supabase
                .channel('public:data_changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${currentUserId}` }, handleRealtimeOrder)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items', filter: `user_id=eq.${currentUserId}` }, handleRealtimeMenu)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${currentUserId}` }, handleRealtimeProfile)
                .subscribe((status) => {
                     if (status === 'SUBSCRIBED') {
                         console.log("Realtime Connected");
                         updateConnectionStatus(true);
                     } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                         console.log("Realtime Disconnected");
                         updateConnectionStatus(false);
                     }
                });
        }

        if (pollingInterval) clearInterval(pollingInterval);
        pollingInterval = setInterval(forceCloudSync, 30000);

    } catch (e) {
        console.error("Sync Init Error", e);
        updateConnectionStatus(false);
    }
};

const handleRealtimeOrder = (payload: any) => {
    if (isSyncing) return;
    const { eventType, new: newRow, old: oldRow } = payload;
    const localOrders = getOrders();

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const newOrder: Order = {
            id: newRow.id,
            tableNumber: newRow.table_number,
            status: newRow.status as OrderStatus,
            items: typeof newRow.items === 'string' ? JSON.parse(newRow.items) : newRow.items,
            timestamp: newRow.timestamp,
            createdAt: new Date(newRow.created_at).getTime(),
            waiterName: newRow.waiter_name
        };
        
        const idx = localOrders.findIndex(o => o.id === newOrder.id);
        if (idx >= 0) {
            localOrders[idx] = newOrder;
        } else {
            localOrders.push(newOrder);
        }
        safeLocalStorageSave(STORAGE_KEY, JSON.stringify(localOrders));
        window.dispatchEvent(new Event('local-storage-update'));
    } else if (eventType === 'DELETE') {
        const filtered = localOrders.filter(o => o.id !== oldRow.id);
        safeLocalStorageSave(STORAGE_KEY, JSON.stringify(filtered));
        window.dispatchEvent(new Event('local-storage-update'));
    }
};

const handleRealtimeMenu = (payload: any) => {
    if (isSyncing) return;
    forceCloudSync();
};

const handleRealtimeProfile = (payload: any) => {
    if (isSyncing) return;
    const { new: newProfile } = payload;
    if (newProfile && newProfile.settings) {
         const currentLocal = getAppSettings();
         const newSettings = {
             ...currentLocal,
             ...newProfile.settings, 
             restaurantProfile: {
                 ...currentLocal.restaurantProfile,
                 ...newProfile.settings.restaurantProfile
             }
         };
         safeLocalStorageSave(APP_SETTINGS_KEY, JSON.stringify(newSettings));
         window.dispatchEvent(new Event('local-settings-update'));
    }
};

export const forceCloudSync = async () => {
    if (!supabase || !currentUserId || isSyncing) return;
    isSyncing = true;

    try {
        const { data: cloudOrders, error: ordersError } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', currentUserId);
        
        if (cloudOrders && !ordersError) {
            // MERGE STRATEGY: Cloud prevails, but we don't want to lose local work if cloud is empty/slow.
            // For now, we overwrite local with cloud to ensure sync consistency.
            const parsedCloudOrders: Order[] = cloudOrders.map(r => ({
                id: r.id,
                tableNumber: r.table_number,
                status: r.status as OrderStatus,
                items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
                timestamp: r.timestamp,
                createdAt: new Date(r.created_at).getTime(),
                waiterName: r.waiter_name
            }));
            
            // Only update if we actually got data, to avoid wiping local state on a glitch
            if (parsedCloudOrders.length > 0 || getOrders().length === 0) {
                 safeLocalStorageSave(STORAGE_KEY, JSON.stringify(parsedCloudOrders));
                 window.dispatchEvent(new Event('local-storage-update'));
            }
        }

        const { data: cloudMenu, error: menuError } = await supabase
            .from('menu_items')
            .select('*')
            .eq('user_id', currentUserId);

        if (cloudMenu && !menuError) {
             const parsedMenu: MenuItem[] = cloudMenu.map(r => ({
                id: r.id,
                name: r.name,
                price: r.price,
                category: r.category,
                description: r.description,
                ingredients: r.ingredients,
                allergens: typeof r.allergens === 'string' ? JSON.parse(r.allergens) : r.allergens,
                image: r.image,
                isCombo: r.category === Category.MENU_COMPLETO,
                comboItems: typeof r.combo_items === 'string' ? JSON.parse(r.combo_items) : r.combo_items,
                specificDepartment: r.specific_department
             }));
             safeLocalStorageSave(MENU_KEY, JSON.stringify(parsedMenu));
             window.dispatchEvent(new Event('local-menu-update'));
        }
        updateConnectionStatus(true);
    } catch (e) {
        console.error("Sync Error", e);
        updateConnectionStatus(false);
    } finally {
        isSyncing = false;
    }
};
