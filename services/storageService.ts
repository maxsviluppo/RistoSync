
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
let isSyncing = false; // Prevent overlapping syncs
let realtimeChannel: any = null;
let isConnected = false;

// HELPER: SAFE STORAGE SAVE
const safeLocalStorageSave = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
             alert("Memoria locale piena! Contatta l'assistenza o cancella la cronologia.");
             throw e;
        }
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
        // Merge existing items with new ones or replace depending on logic.
        // For simple waiter pad "Add to order", we usually append.
        // But the WaiterPad logic currently sends the "Cart" which implies addition.
        // We will treat this as an "add" operation to existing items if items already exist,
        // marking new ones with 'isAddedLater' if the order was not pending.
        
        const existingItems = order.items || [];
        // Determine if we should flag these as added later
        const isLateAddition = order.status !== OrderStatus.PENDING;
        
        const itemsToAdd = newItems.map(i => ({
            ...i,
            isAddedLater: isLateAddition ? true : i.isAddedLater,
            served: false,
            completed: false
        }));
        
        order.items = [...existingItems, ...itemsToAdd];
        order.timestamp = Date.now();
        
        // If order was delivered, reopen it? Usually not allowed from UI but safeguard:
        if (order.status === OrderStatus.DELIVERED) {
            order.status = OrderStatus.COOKING; 
        } else if (order.status === OrderStatus.READY) {
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
        // Toggle specific sub-item for combos
        let completedParts = item.comboCompletedParts || [];
        if (completedParts.includes(subItemId)) {
            completedParts = completedParts.filter(id => id !== subItemId);
        } else {
            completedParts.push(subItemId);
        }
        item.comboCompletedParts = completedParts;
        
        // Check if all parts are done (optional logic, maybe just partial is enough)
        // For now, we don't auto-complete the main item based on parts to allow manual control
    } else {
        // Toggle main item
        item.completed = !item.completed;
    }
    
    // Check if entire order is complete
    const allItemsCompleted = order.items.every(i => {
         // If it's a combo, maybe check parts? For now stick to main flag
         return i.completed; 
    });

    if (allItemsCompleted && order.status === OrderStatus.COOKING) {
        order.status = OrderStatus.READY;
        order.timestamp = Date.now();
    } else if (!allItemsCompleted && order.status === OrderStatus.READY) {
        // Revert to cooking if untoggled
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
    saveOrders(orders);
};

export const deleteHistoryByDate = (date: Date) => {
    const orders = getOrders();
    // Keep orders that are NOT delivered OR (are delivered but NOT from the specified date)
    // Actually typically "Delete History" means delete OLD delivered orders.
    // The UI button says "Reset Storico" and passes new Date().
    
    // Let's interpret as: Remove all DELIVERED orders.
    const activeOrders = orders.filter(o => o.status !== OrderStatus.DELIVERED);
    saveOrders(activeOrders);
};

export const freeTable = (tableNumber: string) => {
    const orders = getOrders();
    let updated = false;
    orders.forEach(o => {
        if (o.tableNumber === tableNumber && o.status !== OrderStatus.DELIVERED) {
            o.status = OrderStatus.DELIVERED;
            o.timestamp = Date.now();
            updated = true;
        }
    });
    if (updated) saveOrders(orders);
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
    
    // Also save profile to Supabase if connected
    if (settings.restaurantProfile && supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
             // Create a deep copy to avoid mutating state
             const profileToSave = JSON.parse(JSON.stringify(settings.restaurantProfile));
             // Don't overwrite critical fields if they are missing in local state
             
             const updatePayload: any = { 
                 restaurant_name: profileToSave.name,
             };
             
             // We need to fetch current settings to merge, or just update the restaurantProfile key
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

        // 1. Initial Pull
        await forceCloudSync();

        // 2. Setup Realtime Subscription
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

        // 3. Fallback Polling (every 30s)
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
        // Parse items if string (should be jsonb but supabase js client might return obj directly)
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
            // Merge strategy: Last timestamp wins or Cloud wins?
            // Simple: Cloud wins in realtime event
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
    // Similar logic for Menu Items
    // For brevity, we trigger a full pull on menu change to ensure consistency
    forceCloudSync();
};

const handleRealtimeProfile = (payload: any) => {
    if (isSyncing) return;
    const { new: newProfile } = payload;
    if (newProfile && newProfile.settings) {
         // Update local app settings from profile settings
         const currentLocal = getAppSettings();
         // Merge logic
         const newSettings = {
             ...currentLocal,
             ...newProfile.settings, // This might overwrite local-only settings like print config if not careful
             // Ensure restaurantProfile is synced
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
        // A. PULL ORDERS
        const { data: cloudOrders, error: ordersError } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', currentUserId);
        
        if (cloudOrders && !ordersError) {
            const parsedCloudOrders: Order[] = cloudOrders.map(r => ({
                id: r.id,
                tableNumber: r.table_number,
                status: r.status as OrderStatus,
                items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
                timestamp: r.timestamp,
                createdAt: new Date(r.created_at).getTime(),
                waiterName: r.waiter_name
            }));
            
            // Simple Conflict Resolution: Cloud overwrites Local for simplicity in this demo
            // In production, we would merge based on timestamp
            
            // However, we must preserve local orders that haven't synced yet?
            // For now, let's assume Cloud is Source of Truth.
            safeLocalStorageSave(STORAGE_KEY, JSON.stringify(parsedCloudOrders));
            window.dispatchEvent(new Event('local-storage-update'));
        }

        // B. PULL MENU
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
        
        // C. PUSH LOCAL CHANGES (Example: If we implemented a queue. For now, we save directly to cloud on action)
        // This function acts more like a "Refresh from Cloud". 
        // Actual pushes happen in addOrder/updateOrder etc.

        updateConnectionStatus(true);
    } catch (e) {
        console.error("Sync Error", e);
        updateConnectionStatus(false);
    } finally {
        isSyncing = false;
    }
};
