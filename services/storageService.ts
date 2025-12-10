import { Order, OrderStatus, OrderItem, MenuItem, AppSettings, Category, Department } from '../types';
import { MENU_ITEMS as DEFAULT_MENU_ITEMS } from '../constants';
import { supabase } from './supabase';

const STORAGE_KEY = 'ristosync_orders';
const TABLES_COUNT_KEY = 'ristosync_table_count';
const WAITER_KEY = 'ristosync_waiter_name';
const MENU_KEY = 'ristosync_menu_items';
const SETTINGS_NOTIFICATIONS_KEY = 'ristosync_settings_notifications';
const APP_SETTINGS_KEY = 'ristosync_app_settings'; // New Global Settings Key
const GOOGLE_API_KEY_STORAGE = 'ristosync_google_api_key';

// --- SYNC ENGINE STATE ---
let currentUserId: string | null = null;
let pollingInterval: any = null;

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
            localStorage.setItem(GOOGLE_API_KEY_STORAGE, profile.google_api_key);
        }

        // 3. Realtime Subscription (Robust Mode)
        // We create a unique channel for this user/restaurant
        const channel = supabase.channel(`room:${currentUserId}`);

        channel
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'orders' 
            }, (payload) => {
                fetchFromCloud(); 
            })
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'menu_items' 
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
                    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(payload.new.settings));
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

const fetchFromCloud = async () => {
    if (!supabase || !currentUserId) return;
    const { data, error } = await supabase.from('orders').select('*');
    if (error) {
        console.error('Error fetching orders:', error);
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

    // Update Local Cache
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appOrders));
    window.dispatchEvent(new Event('local-storage-update'));
};

const fetchFromCloudMenu = async () => {
    if (!supabase || !currentUserId) return;
    const { data, error } = await supabase.from('menu_items').select('*');
    if (!error && data) {
         localStorage.setItem(MENU_KEY, JSON.stringify(data));
         window.dispatchEvent(new Event('local-menu-update'));
    }
};

// NEW: Fetch Global Settings (Categories destinations, etc)
const fetchSettingsFromCloud = async () => {
    if (!supabase || !currentUserId) return;
    const { data, error } = await supabase.from('profiles').select('settings').eq('id', currentUserId).single();
    if (!error && data?.settings) {
        localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(data.settings));
        window.dispatchEvent(new Event('local-settings-update'));
    }
};

// --- ORDER MANAGEMENT ---
export const getOrders = (): Order[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

const saveLocallyAndNotify = (orders: Order[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    window.dispatchEvent(new Event('local-storage-update'));
};

// HELPER: Sync individual order to Cloud
const syncOrderToCloud = async (order: Order, isDelete = false) => {
    if (!supabase || !currentUserId) return;
    
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
            // Note: we don't sync createdAt manually as column is auto-generated, 
            // but for updates it's fine.
        };
        const { error } = await supabase.from('orders').upsert(payload);
        if (error) console.error("Cloud Sync Error", error);
    }
};

export const saveOrders = (orders: Order[]) => {
  saveLocallyAndNotify(orders);
};

export const addOrder = (order: Order) => {
  const orders = getOrders();
  const settings = getAppSettings(); // Get settings
  const now = Date.now();

  const cleanOrder: Order = {
      ...order,
      timestamp: now,
      createdAt: now, // Explicitly set creation time
      items: order.items.map(i => {
          // AUTO-COMPLETE logic for Sala items
          const isSala = settings.categoryDestinations[i.menuItem.category] === 'Sala';
          return { 
              ...i, 
              completed: isSala, // Sala items are automatically "cooked/ready"
              served: false, 
              isAddedLater: false 
          };
      })
  };
  const newOrders = [...orders, cleanOrder];
  
  saveLocallyAndNotify(newOrders);
  syncOrderToCloud(cleanOrder); // Trigger Cloud Sync
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

export const updateOrderItems = (orderId: string, newItems: OrderItem[]) => {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    const settings = getAppSettings();
    if (!order) return;

    // CRITICAL FIX: MERGE LOGIC instead of Replace
    // We start with the existing items
    const mergedItems = [...order.items];

    newItems.forEach(newItem => {
        // Check if this item (same ID and same Notes) already exists in the order
        const existingIndex = mergedItems.findIndex(old => 
            old.menuItem.id === newItem.menuItem.id && 
            (old.notes || '') === (newItem.notes || '')
        );

        if (existingIndex >= 0) {
            // UPDATE EXISTING: Add Quantity
            const existing = mergedItems[existingIndex];
            const isQuantityIncreased = newItem.quantity > 0; // In this context (adding), it's always > 0
            
            mergedItems[existingIndex] = {
                ...existing,
                quantity: existing.quantity + newItem.quantity,
                // If we add quantity, we reset completion so kitchen sees it again
                completed: false, 
                served: false,
                isAddedLater: true
            };
        } else {
            // ADD NEW ITEM: Append to list
            const isSala = settings.categoryDestinations[newItem.menuItem.category] === 'Sala';
            mergedItems.push({
                ...newItem,
                completed: isSala,
                served: false,
                isAddedLater: true
            });
        }
    });

    // RE-ACTIVATE ORDER if it was DELIVERED/SERVED or READY
    let newStatus = order.status;
    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.READY) {
        newStatus = OrderStatus.PENDING; 
    }

    // Update Order with MERGED items
    const updatedOrder = { 
        ...order, 
        items: mergedItems, 
        timestamp: Date.now(), // Bump timestamp to bring to top
        status: newStatus 
    };
    const newOrders = orders.map(o => o.id === orderId ? updatedOrder : o);

    saveLocallyAndNotify(newOrders);
    syncOrderToCloud(updatedOrder);
};

export const toggleOrderItemCompletion = (orderId: string, itemIndex: number) => {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const newItems = [...order.items];
    if (newItems[itemIndex]) {
        newItems[itemIndex] = { 
            ...newItems[itemIndex], 
            completed: !newItems[itemIndex].completed 
        };
    }

    // Smart Status Logic for Kitchen (Ready if all cooked)
    const allCooked = newItems.every(i => i.completed);
    const anyCooked = newItems.some(i => i.completed);
    
    let newStatus = order.status;
    // Don't downgrade from Delivered automatically here
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

export const serveItem = (orderId: string, itemIndex: number) => {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const newItems = [...order.items];
    if (newItems[itemIndex]) {
        newItems[itemIndex] = { 
            ...newItems[itemIndex], 
            served: true 
        };
    }

    // If all items are served, mark order as DELIVERED
    const allServed = newItems.every(i => i.served);
    let newStatus = order.status;
    if (allServed) {
        newStatus = OrderStatus.DELIVERED;
    }

    // UPDATE TIMESTAMP TO RESET TIMERS AND MARK COMPLETION TIME
    // This effectively resets the kitchen timer and the waiter delay counter
    // for the remaining items/next course.
    const updatedOrder = { 
        ...order, 
        items: newItems, 
        status: newStatus,
        timestamp: Date.now() // This acts as "Completed At" when status becomes Delivered
    };
    
    const newOrders = orders.map(o => o.id === orderId ? updatedOrder : o);
    
    saveLocallyAndNotify(newOrders);
    syncOrderToCloud(updatedOrder);
};

export const clearHistory = async () => {
  const orders = getOrders();
  const activeOrders = orders.filter(o => o.status !== OrderStatus.DELIVERED);
  saveLocallyAndNotify(activeOrders);
  
  if (supabase && currentUserId) {
      // In cloud, we delete delivered orders
      await supabase.from('orders').delete().eq('user_id', currentUserId).eq('status', OrderStatus.DELIVERED);
  }
};

// NEW: Delete history only for a specific date
export const deleteHistoryByDate = async (targetDate: Date) => {
    const orders = getOrders();
    
    // Filter out orders that match the date AND are delivered
    const ordersToKeep = orders.filter(o => {
        if (o.status !== OrderStatus.DELIVERED) return true; // Keep active
        const orderDate = new Date(o.createdAt || o.timestamp);
        const isSameDay = orderDate.getDate() === targetDate.getDate() &&
                          orderDate.getMonth() === targetDate.getMonth() &&
                          orderDate.getFullYear() === targetDate.getFullYear();
        return !isSameDay; // Keep if NOT same day
    });

    saveLocallyAndNotify(ordersToKeep);

    if (supabase && currentUserId) {
        // Calculate timestamps for range query to be safe (or just delete delivered orders locally identified)
        // For simplicity and safety with filtered local list, we iterate orders that WERE deleted locally
        // But better: use a SQL range delete.
        
        const startOfDay = new Date(targetDate); startOfDay.setHours(0,0,0,0);
        const endOfDay = new Date(targetDate); endOfDay.setHours(23,59,59,999);
        
        await supabase.from('orders')
            .delete()
            .eq('user_id', currentUserId)
            .eq('status', OrderStatus.DELIVERED)
            .gte('created_at', startOfDay.toISOString())
            .lte('created_at', endOfDay.toISOString());
    }
};

export const freeTable = async (tableNumber: string) => {
    const orders = getOrders();
    // Instead of deleting, we ARCHIVE them by:
    // 1. Ensuring status is DELIVERED (so they appear in history)
    // 2. Renaming the table number locally to something unique so WaiterPad sees table as free
    
    const tableOrders = orders.filter(o => o.tableNumber === tableNumber);
    const otherOrders = orders.filter(o => o.tableNumber !== tableNumber);
    
    const archivedOrders = tableOrders.map(o => ({
        ...o,
        status: OrderStatus.DELIVERED,
        // Append suffix to hide from Active Table view in WaiterPad (which searches strict equality)
        // But Kitchen History can still parse it
        tableNumber: `${o.tableNumber}_HISTORY`,
        timestamp: Date.now() // Update exit time
    }));

    const newOrders = [...otherOrders, ...archivedOrders];
    
    saveLocallyAndNotify(newOrders);

    if (supabase && currentUserId) {
        // Update in cloud instead of deleting
        for (const o of archivedOrders) {
            await syncOrderToCloud(o);
        }
    }
};

// --- FACTORY RESET (DANGER ZONE) ---
export const performFactoryReset = async () => {
    // 1. Clear Local Data (Orders & Menu)
    localStorage.setItem(STORAGE_KEY, '[]');
    localStorage.setItem(MENU_KEY, '[]');
    // Note: We deliberately do NOT clear:
    // - APP_SETTINGS_KEY (Printer configs, destinations)
    // - GOOGLE_API_KEY_STORAGE
    // - WAITER_KEY (Session convenience)
    // - TABLES_COUNT_KEY (Layout)
    
    // Notify Local Listeners
    window.dispatchEvent(new Event('local-storage-update'));
    window.dispatchEvent(new Event('local-menu-update'));

    // 2. Clear Cloud Data
    if (supabase && currentUserId) {
        // Delete all Orders
        await supabase.from('orders').delete().eq('user_id', currentUserId);
        
        // Delete all Menu Items
        await supabase.from('menu_items').delete().eq('user_id', currentUserId);
        
        // We do NOT delete from 'profiles' to keep API keys and Settings
    }
};

// --- DYNAMIC TABLE COUNT ---
export const getTableCount = (): number => {
    const count = localStorage.getItem(TABLES_COUNT_KEY);
    return count ? parseInt(count, 10) : 12; 
};

export const saveTableCount = (count: number) => {
    localStorage.setItem(TABLES_COUNT_KEY, count.toString());
    window.dispatchEvent(new Event('local-storage-update'));
};

// --- WAITER SESSION ---
export const getWaiterName = (): string | null => {
    return localStorage.getItem(WAITER_KEY);
};

export const saveWaiterName = (name: string) => {
    localStorage.setItem(WAITER_KEY, name);
};

export const logoutWaiter = () => {
    localStorage.removeItem(WAITER_KEY);
};

// --- MENU MANAGEMENT (CLOUD) ---
export const getMenuItems = (): MenuItem[] => {
    const data = localStorage.getItem(MENU_KEY);
    if (data) {
        return JSON.parse(data);
    } else {
        localStorage.setItem(MENU_KEY, JSON.stringify(DEFAULT_MENU_ITEMS));
        return DEFAULT_MENU_ITEMS;
    }
};

const syncMenuToCloud = async (item: MenuItem, isDelete = false) => {
    if (!supabase || !currentUserId) return;
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
            allergens: item.allergens,
            image: item.image // <--- Added: Persist image to Cloud
        };
        await supabase.from('menu_items').upsert(payload);
    }
};

export const saveMenuItems = (items: MenuItem[]) => {
    localStorage.setItem(MENU_KEY, JSON.stringify(items));
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

// --- API KEY MANAGEMENT ---
export const getGoogleApiKey = (): string | null => {
    return localStorage.getItem(GOOGLE_API_KEY_STORAGE);
};

export const saveGoogleApiKey = async (apiKey: string) => {
    localStorage.setItem(GOOGLE_API_KEY_STORAGE, apiKey);
    
    // Sync to Cloud Profile
    if (supabase && currentUserId) {
        const { error } = await supabase
            .from('profiles')
            .update({ google_api_key: apiKey })
            .eq('id', currentUserId);
            
        if (error) console.error("Failed to save API Key to cloud", error);
    }
};

// --- APP SETTINGS (DESTINATIONS) ---
const DEFAULT_SETTINGS: AppSettings = {
    categoryDestinations: {
        [Category.MENU_COMPLETO]: 'Cucina', // Default for Combo
        [Category.ANTIPASTI]: 'Cucina',
        [Category.PANINI]: 'Pub', 
        [Category.PIZZE]: 'Pizzeria', 
        [Category.PRIMI]: 'Cucina',
        [Category.SECONDI]: 'Cucina',
        [Category.DOLCI]: 'Cucina',
        [Category.BEVANDE]: 'Sala'
    },
    // DEFAULT PRINT SETTINGS (Disabled by default)
    printEnabled: {
        'Cucina': false,
        'Pizzeria': false,
        'Pub': false,
        'Sala': false,
        'Cassa': false // NEW: Default to false
    },
    restaurantProfile: {}
};

export const getAppSettings = (): AppSettings => {
    const data = localStorage.getItem(APP_SETTINGS_KEY);
    if (!data) return DEFAULT_SETTINGS;
    
    try {
        const parsed = JSON.parse(data);
        // Robustness: Merge with defaults to ensure all structure exists if user has old data
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
    // 1. Save Local
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event('local-settings-update'));

    // 2. Sync to Cloud Profile
    if (supabase && currentUserId) {
        const { error } = await supabase
            .from('profiles')
            .update({ settings: settings }) // Saves entire JSON object
            .eq('id', currentUserId);

        if (error) console.error("Failed to save App Settings to cloud", error);
    }
};

// --- SETTINGS (LOCAL NOTIFICATIONS) ---
export interface NotificationSettings {
    kitchenSound: boolean;
    waiterSound: boolean;
    pushEnabled: boolean;
}

export const getNotificationSettings = (): NotificationSettings => {
    const data = localStorage.getItem(SETTINGS_NOTIFICATIONS_KEY);
    return data ? JSON.parse(data) : { kitchenSound: true, waiterSound: true, pushEnabled: false };
};

export const saveNotificationSettings = (settings: NotificationSettings) => {
    localStorage.setItem(SETTINGS_NOTIFICATIONS_KEY, JSON.stringify(settings));
};