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
        if (e.name === 'QuotaExceededError' || e.message?.toLowerCase().includes('quota')) {
            console.warn("⚠️ STORAGE FULL: Operating in Cloud-Only mode.");
            if (key === STORAGE_KEY) {
                try {
                    const orders = JSON.parse(value) as Order[];
                    const streamlined = orders.filter(o => o.status !== OrderStatus.DELIVERED);
                    localStorage.setItem(key, JSON.stringify(streamlined));
                } catch (cleanError) {}
            }
        }
    }
};

const ensureUserId = async () => {
    if (!supabase) return null;
    
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.id) {
        currentUserId = data.session.user.id;
        return currentUserId;
    }
    
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user?.id) {
        currentUserId = userData.user.id;
        return currentUserId;
    }

    return null;
};

const broadcastUpdate = async (type: 'orders' | 'menu') => {
    if (realtimeChannel && currentUserId && isConnected) {
        await realtimeChannel.send({
            type: 'broadcast',
            event: 'sync_update',
            payload: { type }
        });
    }
};

const setConnectionStatus = (status: boolean) => {
    isConnected = status;
    window.dispatchEvent(new CustomEvent('connection-status-change', { detail: { connected: status } }));
};

export const getConnectionStatus = () => isConnected;

// Initialize Realtime Subscription
export const initSupabaseSync = async () => {
    if (!supabase) return;

    await ensureUserId();
    
    if (currentUserId) {
        // 1. Initial Sync - Slight delay to ensure connection is ready
        setTimeout(() => {
            Promise.all([
                fetchFromCloud(),
                fetchFromCloudMenu(),
                fetchSettingsFromCloud(true) 
            ]).catch(e => console.error("Initial Sync Failed", e));
        }, 1000);
        
        supabase.from('profiles').select('google_api_key').eq('id', currentUserId).single().then(({data}) => {
             if (data?.google_api_key) safeLocalStorageSave(GOOGLE_API_KEY_STORAGE, data.google_api_key);
        });

        // 3. Realtime Subscription
        if (realtimeChannel) await supabase.removeChannel(realtimeChannel);

        // Unique channel name per user to ensure isolation
        realtimeChannel = supabase.channel(`room:${currentUserId}`);

        realtimeChannel
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'orders'
            }, () => {
                console.log("🔔 DB Order Update");
                fetchFromCloud(); 
            })
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'menu_items'
            }, () => {
                console.log("🔔 DB Menu Update");
                fetchFromCloudMenu();
            })
            .on('broadcast', { event: 'sync_update' }, (payload: any) => {
                console.log("📡 Broadcast Received:", payload);
                if (payload.payload?.type === 'orders') fetchFromCloud();
                if (payload.payload?.type === 'menu') fetchFromCloudMenu();
            })
            .subscribe((status: string) => {
                 if (status === 'SUBSCRIBED') {
                     console.log("🟢 Realtime Connected");
                     setConnectionStatus(true);
                 } else {
                     console.log("🔴 Realtime Disconnected:", status);
                     setConnectionStatus(false);
                 }
            });

        // 4. Fallback Polling (Heartbeat) - 5s (More aggressive)
        if (pollingInterval) clearInterval(pollingInterval);
        pollingInterval = setInterval(() => {
            fetchFromCloud();
            // Also check settings periodically
            if (Math.random() > 0.7) fetchSettingsFromCloud();
        }, 5000);
    }
};

export const forceCloudSync = async () => {
    console.log("🔄 Forcing Cloud Sync...");
    await ensureUserId();
    await fetchFromCloud();
    await fetchFromCloudMenu();
    await fetchSettingsFromCloud(true); 
    return true;
};

const handleSupabaseError = (error: any) => {
    if (!error) return;
    console.error("Supabase Error:", error.message || JSON.stringify(error));
    // If error suggests auth issue, maybe trigger logout? For now just log.
    return error;
}

const fetchFromCloud = async () => {
    if (!supabase || isSyncing) return;
    await ensureUserId();
    if (!currentUserId) return;

    isSyncing = true;
    
    try {
        // PERFORMANCE OPTIMIZATION: Reduced limit to 50 to prevent timeouts
        // Index on (user_id, created_at) is required for this to be fast
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', currentUserId)
            .order('created_at', { ascending: false }) // Get latest first
            .limit(50); // REDUCED LIMIT

        if (error) {
            handleSupabaseError(error);
            setConnectionStatus(false);
            isSyncing = false;
            return;
        }
        
        setConnectionStatus(true);

        // Convert Cloud Orders
        const cloudOrders: Order[] = data.map((row: any) => ({
            id: row.id,
            tableNumber: row.table_number, 
            status: row.status as OrderStatus,
            timestamp: parseInt(row.timestamp) || new Date(row.created_at).getTime(),
            createdAt: new Date(row.created_at).getTime(), 
            items: row.items,
            waiterName: row.waiter_name
        }));

        // SMART MERGE STRATEGY
        const localOrders = getOrders();
        const mergedOrders: Order[] = [];
        const processedIds = new Set<string>();

        // 1. Merge Cloud Orders (Priority)
        cloudOrders.forEach(cloudOrder => {
            processedIds.add(cloudOrder.id);
            // If we have a local version that is newer (modified within last 3 seconds), keep local to prevent jitter
            // Otherwise trust cloud
            const localOrder = localOrders.find(l => l.id === cloudOrder.id);
            if (localOrder && localOrder.timestamp > cloudOrder.timestamp && (Date.now() - localOrder.timestamp < 3000)) {
                 mergedOrders.push(localOrder);
            } else {
                 mergedOrders.push(cloudOrder);
            }
        });

        // 2. Keep Local Orders NOT in Cloud yet (Optimistic)
        localOrders.forEach(localOrder => {
            if (!processedIds.has(localOrder.id)) {
                 mergedOrders.push(localOrder);
                 // Retry push if it's been a while (e.g. connection restored)
                 if ((Date.now() - localOrder.timestamp) > 5000) {
                     addOrder(localOrder, true);
                 }
            }
        });

        const sorted = mergedOrders.sort((a, b) => a.timestamp - b.timestamp);
        safeLocalStorageSave(STORAGE_KEY, JSON.stringify(sorted));
        window.dispatchEvent(new Event('local-storage-update'));
    } catch (e) {
        console.error("Sync Exception:", e);
    } finally {
        isSyncing = false;
    }
};

const fetchFromCloudMenu = async () => {
    if (!supabase) return;
    await ensureUserId();
    if (!currentUserId) return;
    
    const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('user_id', currentUserId);

    if (error) {
        handleSupabaseError(error);
        return;
    }
    
    const cloudMenu: MenuItem[] = data.map((row: any) => ({
        id: row.id,
        name: row.name,
        price: row.price,
        category: row.category,
        description: row.description,
        ingredients: row.ingredients,
        allergens: row.allergens,
        image: row.image,
        isCombo: row.category === Category.MENU_COMPLETO,
        comboItems: row.combo_items,
        specific_department: row.specific_department
    }));

    safeLocalStorageSave(MENU_KEY, JSON.stringify(cloudMenu));
    window.dispatchEvent(new Event('local-menu-update'));
};

const fetchSettingsFromCloud = async (forceOverwrite = false) => {
    if (!supabase) return;
    await ensureUserId();
    if (!currentUserId) return;

    try {
        const { data, error } = await supabase.from('profiles').select('settings').eq('id', currentUserId).single();
        if (data?.settings) {
            safeLocalStorageSave(APP_SETTINGS_KEY, JSON.stringify(data.settings));
            window.dispatchEvent(new Event('local-settings-update'));
        }
    } catch (e) {
        console.error("Settings Sync Error", e);
    }
};

// --- CRUD OPERATIONS ---

export const getOrders = (): Order[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

export const addOrder = async (order: Order, silent = false) => {
    // 1. Optimistic Update (Local)
    if (!silent) {
        const orders = getOrders();
        if (!orders.find(o => o.id === order.id)) {
            orders.push(order);
            safeLocalStorageSave(STORAGE_KEY, JSON.stringify(orders));
            window.dispatchEvent(new Event('local-storage-update'));
        }
    }
    
    // 2. Cloud Sync
    await ensureUserId();
    if (supabase && currentUserId) {
        const { error } = await supabase.from('orders').upsert({
            id: order.id,
            user_id: currentUserId,
            table_number: order.tableNumber,
            status: order.status,
            items: order.items,
            timestamp: order.timestamp,
            created_at: new Date(order.createdAt).toISOString(),
            waiter_name: order.waiterName
        });

        if (error) {
            console.error("🔴 CLOUD SYNC FAILED (addOrder):", error.message);
            setConnectionStatus(false);
        } else {
            console.log("✅ Order Pushed to Cloud:", order.id);
            setConnectionStatus(true);
            broadcastUpdate('orders'); // BROADCAST SUCCESS
        }
    } else {
        console.warn("🔴 No User ID found. Order saved LOCALLY only.");
    }
};

export const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.status = status;
        order.timestamp = Date.now();
        safeLocalStorageSave(STORAGE_KEY, JSON.stringify(orders));
        window.dispatchEvent(new Event('local-storage-update'));

        await ensureUserId();
        if (supabase && currentUserId) {
             const { error } = await supabase.from('orders').update({ status: status, timestamp: order.timestamp }).eq('id', orderId);
             if (error) console.error("Update Status Error", error);
             else broadcastUpdate('orders');
        }
    }
};

export const updateOrderItems = async (orderId: string, newItems: OrderItem[]) => {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.items = [...order.items, ...newItems.map(i => ({...i, isAddedLater: true}))];
        order.timestamp = Date.now();
        safeLocalStorageSave(STORAGE_KEY, JSON.stringify(orders));
        window.dispatchEvent(new Event('local-storage-update'));

        await ensureUserId();
        if (supabase && currentUserId) {
             const { error } = await supabase.from('orders').update({ items: order.items, timestamp: order.timestamp }).eq('id', orderId);
             if (error) console.error("Update Items Error", error);
             else broadcastUpdate('orders');
        }
    }
};

export const toggleOrderItemCompletion = async (orderId: string, itemIndex: number, subItemId?: string) => {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    if (order && order.items[itemIndex]) {
        const item = order.items[itemIndex];
        
        if (subItemId) {
            if (!item.comboCompletedParts) item.comboCompletedParts = [];
            if (item.comboCompletedParts.includes(subItemId)) {
                item.comboCompletedParts = item.comboCompletedParts.filter(id => id !== subItemId);
            } else {
                item.comboCompletedParts.push(subItemId);
            }
        } else {
            item.completed = !item.completed;
        }

        safeLocalStorageSave(STORAGE_KEY, JSON.stringify(orders));
        window.dispatchEvent(new Event('local-storage-update'));

        await ensureUserId();
        if (supabase && currentUserId) {
             const { error } = await supabase.from('orders').update({ items: order.items }).eq('id', orderId);
             if(!error) broadcastUpdate('orders');
        }
    }
};

export const serveItem = async (orderId: string, itemIndex: number) => {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    if (order && order.items[itemIndex]) {
        order.items[itemIndex].served = true;
        safeLocalStorageSave(STORAGE_KEY, JSON.stringify(orders));
        window.dispatchEvent(new Event('local-storage-update'));
        
        await ensureUserId();
        if (supabase && currentUserId) {
             const { error } = await supabase.from('orders').update({ items: order.items }).eq('id', orderId);
             if(!error) broadcastUpdate('orders');
        }
    }
};

export const freeTable = async (tableNumber: string) => {
    const orders = getOrders();
    const tableOrders = orders.filter(o => o.tableNumber === tableNumber && o.status !== OrderStatus.DELIVERED);
    
    tableOrders.forEach(o => {
        o.status = OrderStatus.DELIVERED;
        o.timestamp = Date.now();
    });
    
    safeLocalStorageSave(STORAGE_KEY, JSON.stringify(orders));
    window.dispatchEvent(new Event('local-storage-update'));
    
    await ensureUserId();
    if (supabase && currentUserId) {
        for (const o of tableOrders) {
            await supabase.from('orders').update({ status: OrderStatus.DELIVERED, timestamp: o.timestamp }).eq('id', o.id);
        }
        broadcastUpdate('orders');
    }
};

// Menu
export const getMenuItems = (): MenuItem[] => {
    const data = localStorage.getItem(MENU_KEY);
    return data ? JSON.parse(data) : [];
};

export const addMenuItem = async (item: MenuItem) => {
    const items = getMenuItems();
    items.push(item);
    safeLocalStorageSave(MENU_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('local-menu-update'));
    
    await ensureUserId();
    if (supabase && currentUserId) {
        await supabase.from('menu_items').upsert({
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
        });
        broadcastUpdate('menu');
    }
};

export const updateMenuItem = async (item: MenuItem) => {
    const items = getMenuItems();
    const index = items.findIndex(i => i.id === item.id);
    if (index !== -1) {
        items[index] = item;
        safeLocalStorageSave(MENU_KEY, JSON.stringify(items));
        window.dispatchEvent(new Event('local-menu-update'));
        
        await ensureUserId();
        if (supabase && currentUserId) {
            await supabase.from('menu_items').update({
                name: item.name,
                price: item.price,
                category: item.category,
                description: item.description,
                ingredients: item.ingredients,
                allergens: item.allergens,
                image: item.image,
                combo_items: item.comboItems,
                specific_department: item.specificDepartment
            }).eq('id', item.id);
            broadcastUpdate('menu');
        }
    }
};

export const deleteMenuItem = async (id: string) => {
    const items = getMenuItems().filter(i => i.id !== id);
    safeLocalStorageSave(MENU_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('local-menu-update'));
    
    await ensureUserId();
    if (supabase && currentUserId) {
        await supabase.from('menu_items').delete().eq('id', id);
        broadcastUpdate('menu');
    }
};

export const deleteAllMenuItems = async () => {
    safeLocalStorageSave(MENU_KEY, JSON.stringify([]));
    window.dispatchEvent(new Event('local-menu-update'));
    await ensureUserId();
    if (supabase && currentUserId) {
        await supabase.from('menu_items').delete().eq('user_id', currentUserId);
        broadcastUpdate('menu');
    }
};

export const importDemoMenu = async () => {
    const items = DEMO_MENU_ITEMS;
    safeLocalStorageSave(MENU_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('local-menu-update'));
    
    await ensureUserId();
    if (supabase && currentUserId) {
        for (const item of items) {
            await addMenuItem(item);
        }
        broadcastUpdate('menu');
    }
};

// Settings
export const getAppSettings = (): AppSettings => {
    const data = localStorage.getItem(APP_SETTINGS_KEY);
    return data ? JSON.parse(data) : { 
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
        printEnabled: { 'Cucina': false, 'Pizzeria': false, 'Pub': false, 'Sala': false, 'Cassa': false } 
    };
};

export const saveAppSettings = async (settings: AppSettings) => {
    safeLocalStorageSave(APP_SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event('local-settings-update'));
    
    await ensureUserId();
    if (supabase && currentUserId) {
        await supabase.from('profiles').update({ settings: settings }).eq('id', currentUserId);
    }
};

export const getGoogleApiKey = (): string | null => {
    return localStorage.getItem(GOOGLE_API_KEY_STORAGE);
};

export const saveGoogleApiKey = async (key: string) => {
    localStorage.setItem(GOOGLE_API_KEY_STORAGE, key);
    await ensureUserId();
    if (supabase && currentUserId) {
        await supabase.from('profiles').update({ google_api_key: key }).eq('id', currentUserId);
    }
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

export const getTableCount = (): number => {
    const settings = getAppSettings();
    return settings.restaurantProfile?.tableCount || 12;
};

export const getNotificationSettings = (): NotificationSettings => {
    const data = localStorage.getItem(SETTINGS_NOTIFICATIONS_KEY);
    return data ? JSON.parse(data) : { kitchenSound: true, waiterSound: true, pushEnabled: false };
};

export const saveNotificationSettings = (settings: NotificationSettings) => {
    safeLocalStorageSave(SETTINGS_NOTIFICATIONS_KEY, JSON.stringify(settings));
};

export const deleteHistoryByDate = async (date: Date) => {
    safeLocalStorageSave(STORAGE_KEY, JSON.stringify([])); 
    window.dispatchEvent(new Event('local-storage-update'));
    
    await ensureUserId();
    if (supabase && currentUserId) {
        await supabase.from('orders').delete().eq('user_id', currentUserId).lt('created_at', date.toISOString());
        broadcastUpdate('orders');
    }
};

export const performFactoryReset = async () => {
    localStorage.clear();
    window.location.reload();
    await ensureUserId();
    if (supabase && currentUserId) {
        await supabase.from('orders').delete().eq('user_id', currentUserId);
        await supabase.from('menu_items').delete().eq('user_id', currentUserId);
        broadcastUpdate('orders');
    }
};
