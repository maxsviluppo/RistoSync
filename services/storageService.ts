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
                    // Aggressively trim delivered orders if local storage is full
                    const streamlined = orders.filter(o => o.status !== OrderStatus.DELIVERED);
                    localStorage.setItem(key, JSON.stringify(streamlined));
                } catch (cleanError) {}
            }
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
        await Promise.all([
            fetchFromCloud(),
            fetchFromCloudMenu(),
            fetchSettingsFromCloud()
        ]);
        
        // 2. Sync Profile Settings (API KEY)
        const { data: profile } = await supabase.from('profiles').select('google_api_key').eq('id', currentUserId).single();
        if (profile?.google_api_key) {
            safeLocalStorageSave(GOOGLE_API_KEY_STORAGE, profile.google_api_key);
        }

        // 3. Realtime Subscription (Robust Mode)
        // Unsubscribe existing channels to prevent duplicates
        supabase.getChannels().forEach(channel => {
            if (channel.topic.includes(`room:${currentUserId}`)) supabase.removeChannel(channel);
        });

        const channel = supabase.channel(`room:${currentUserId}`);

        channel
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'orders',
                filter: `user_id=eq.${currentUserId}` 
            }, () => {
                fetchFromCloud(); 
            })
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'menu_items',
                filter: `user_id=eq.${currentUserId}` 
            }, () => {
                fetchFromCloudMenu();
            })
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
                 if (status === 'SUBSCRIBED') console.log("🟢 Realtime Connected");
            });

        // 4. Fallback Polling (Heartbeat) - Slightly increased interval to reduce load
        if (pollingInterval) clearInterval(pollingInterval);
        pollingInterval = setInterval(() => {
            fetchFromCloud();
            fetchSettingsFromCloud();
        }, 20000);
    }
};

const handleSupabaseError = (error: any) => {
    if (!error) return;
    console.error("Supabase Error:", error.message || JSON.stringify(error));
    // Don't throw, just log. We want the app to survive network blips.
    return error;
}

const fetchFromCloud = async () => {
    if (!supabase || !currentUserId || isSyncing) return;
    isSyncing = true;
    
    try {
        // OPTIMIZATION: Fixed Query Timeout
        // Instead of complex OR, we fetch everything from last 48 hours.
        // This covers active orders AND recent history, which is what we need.
        const lookbackWindow = new Date();
        lookbackWindow.setDate(lookbackWindow.getDate() - 2); // 48 Hours

        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', currentUserId)
            .gte('created_at', lookbackWindow.toISOString());

        if (error) {
            handleSupabaseError(error);
            isSyncing = false;
            return;
        }
        
        // Convert Cloud Orders
        const cloudOrders: Order[] = data.map((row: any) => ({
            id: row.id,
            table_number: row.table_number,
            tableNumber: row.table_number, 
            status: row.status as OrderStatus,
            timestamp: parseInt(row.timestamp) || new Date(row.created_at).getTime(),
            createdAt: new Date(row.created_at).getTime(), 
            items: row.items,
            waiterName: row.waiter_name
        }));

        // SMART MERGE STRATEGY
        const localOrders = getOrders();
        const now = Date.now();
        const mergedOrders: Order[] = [];
        const processedIds = new Set<string>();

        // 1. Merge Cloud Orders (checking against Local)
        cloudOrders.forEach(cloudOrder => {
            processedIds.add(cloudOrder.id);
            const localOrder = localOrders.find(l => l.id === cloudOrder.id);

            if (localOrder) {
                // If local is recent (< 1 min) and newer timestamp, trust local
                // This prevents the "disappearing item" bug while sync is in flight
                const isLocalRecent = (now - localOrder.timestamp) < 60000;
                const isLocalNewer = localOrder.timestamp > cloudOrder.timestamp;

                if (isLocalRecent && isLocalNewer) {
                    mergedOrders.push(localOrder);
                    // Force push this newer local state to cloud in background
                    addOrder(localOrder, true); 
                    return;
                }
            }
            mergedOrders.push(cloudOrder);
        });

        // 2. Keep Local Orders NOT in Cloud yet (Pending Creation)
        // But only if they are relatively recent (< 24h) to avoid zombie orders
        localOrders.forEach(localOrder => {
            if (!processedIds.has(localOrder.id)) {
                // If it's very recent (< 5 mins), it's likely pending upload. Keep it.
                // If it's older, check if it was supposed to be deleted.
                // We keep it safe for now.
                 mergedOrders.push(localOrder);
                 
                 // If it's a new order that hasn't synced, retry sync
                 if ((now - localOrder.timestamp) > 5000 && (now - localOrder.timestamp) < 300000) {
                     addOrder(localOrder, true);
                 }
            }
        });

        // Sort by timestamp
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
    if (!supabase || !currentUserId) return;
    
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
        specificDepartment: row.specific_department
    }));

    safeLocalStorageSave(MENU_KEY, JSON.stringify(cloudMenu));
    window.dispatchEvent(new Event('local-menu-update'));
};

const fetchSettingsFromCloud = async () => {
    if (!supabase || !currentUserId) return;
    try {
        const { data, error } = await supabase.from('profiles').select('settings').eq('id', currentUserId).single();
        if(data?.settings) {
            safeLocalStorageSave(APP_SETTINGS_KEY, JSON.stringify(data.settings));
            window.dispatchEvent(new Event('local-settings-update'));
        }
    } catch (e) {
        // Ignore single fetch errors
    }
};

// --- CRUD OPERATIONS ---

export const getOrders = (): Order[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

// silent = true suppresses UI events for background syncs
export const addOrder = async (order: Order, silent = false) => {
    if (!silent) {
        const orders = getOrders();
        // Check duplication
        if (!orders.find(o => o.id === order.id)) {
            orders.push(order);
            safeLocalStorageSave(STORAGE_KEY, JSON.stringify(orders));
            window.dispatchEvent(new Event('local-storage-update'));
        }
    }
    
    if (supabase && currentUserId) {
        // Fire and forget (don't await) to keep UI snappy
        supabase.from('orders').upsert({
            id: order.id,
            user_id: currentUserId,
            table_number: order.tableNumber,
            status: order.status,
            items: order.items,
            timestamp: order.timestamp,
            created_at: new Date(order.createdAt).toISOString(),
            waiter_name: order.waiterName
        }).then(({ error }) => {
            if (error) console.error("Cloud push failed", error);
        });
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

        if (supabase && currentUserId) {
             await supabase.from('orders').update({ status: status, timestamp: order.timestamp }).eq('id', orderId);
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

        if (supabase && currentUserId) {
             await supabase.from('orders').update({ items: order.items, timestamp: order.timestamp }).eq('id', orderId);
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

        if (supabase && currentUserId) {
             await supabase.from('orders').update({ items: order.items }).eq('id', orderId);
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
        
        if (supabase && currentUserId) {
             await supabase.from('orders').update({ items: order.items }).eq('id', orderId);
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
    
    if (supabase && currentUserId) {
        for (const o of tableOrders) {
            await supabase.from('orders').update({ status: OrderStatus.DELIVERED, timestamp: o.timestamp }).eq('id', o.id);
        }
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
    }
};

export const updateMenuItem = async (item: MenuItem) => {
    const items = getMenuItems();
    const index = items.findIndex(i => i.id === item.id);
    if (index !== -1) {
        items[index] = item;
        safeLocalStorageSave(MENU_KEY, JSON.stringify(items));
        window.dispatchEvent(new Event('local-menu-update'));
        
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
        }
    }
};

export const deleteMenuItem = async (id: string) => {
    const items = getMenuItems().filter(i => i.id !== id);
    safeLocalStorageSave(MENU_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('local-menu-update'));
    
    if (supabase && currentUserId) {
        await supabase.from('menu_items').delete().eq('id', id);
    }
};

export const deleteAllMenuItems = async () => {
    safeLocalStorageSave(MENU_KEY, JSON.stringify([]));
    window.dispatchEvent(new Event('local-menu-update'));
    if (supabase && currentUserId) {
        await supabase.from('menu_items').delete().eq('user_id', currentUserId);
    }
};

export const importDemoMenu = async () => {
    const items = DEMO_MENU_ITEMS;
    safeLocalStorageSave(MENU_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('local-menu-update'));
    
    if (supabase && currentUserId) {
        for (const item of items) {
            await addMenuItem(item);
        }
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
    
    if (supabase && currentUserId) {
        await supabase.from('profiles').update({ settings: settings }).eq('id', currentUserId);
    }
};

export const getGoogleApiKey = (): string | null => {
    return localStorage.getItem(GOOGLE_API_KEY_STORAGE);
};

export const saveGoogleApiKey = async (key: string) => {
    localStorage.setItem(GOOGLE_API_KEY_STORAGE, key);
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
    
    if (supabase && currentUserId) {
        await supabase.from('orders').delete().eq('user_id', currentUserId).lt('created_at', date.toISOString());
    }
};

export const performFactoryReset = async () => {
    localStorage.clear();
    window.location.reload();
    if (supabase && currentUserId) {
        await supabase.from('orders').delete().eq('user_id', currentUserId);
        await supabase.from('menu_items').delete().eq('user_id', currentUserId);
    }
};
