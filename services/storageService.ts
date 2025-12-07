import { Order, OrderStatus, OrderItem, MenuItem } from '../types';
import { MENU_ITEMS as DEFAULT_MENU_ITEMS } from '../constants';
import { supabase } from './supabase';

const STORAGE_KEY = 'ristosync_orders';
const TABLES_COUNT_KEY = 'ristosync_table_count';
const WAITER_KEY = 'ristosync_waiter_name';
const MENU_KEY = 'ristosync_menu_items';
const SETTINGS_NOTIFICATIONS_KEY = 'ristosync_settings_notifications';
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
        
        // 2. Sync Profile Settings (API KEY)
        const { data: profile } = await supabase.from('profiles').select('google_api_key').eq('id', currentUserId).single();
        if (profile?.google_api_key) {
            localStorage.setItem(GOOGLE_API_KEY_STORAGE, profile.google_api_key);
        }

        // 3. Realtime Subscription (Robust Mode)
        const channel = supabase.channel(`room:${currentUserId}`);

        channel
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'orders' 
            }, () => {
                fetchFromCloud(); 
            })
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'menu_items' 
            }, () => {
                fetchFromCloudMenu();
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
        tableNumber: row.table_number,
        status: row.status as OrderStatus,
        timestamp: parseInt(row.timestamp) || new Date(row.created_at).getTime(),
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
        };
        const { error } = await supabase.from('orders').upsert(payload);
        if (error) console.error("Sync error", error);
    }
};

// --- EXPORTED FUNCTIONS ---

// 1. Google API Key
export const getGoogleApiKey = () => {
    return localStorage.getItem(GOOGLE_API_KEY_STORAGE) || '';
};

export const saveGoogleApiKey = async (key: string) => {
    localStorage.setItem(GOOGLE_API_KEY_STORAGE, key);
    if (supabase && currentUserId) {
        await supabase.from('profiles').update({ google_api_key: key }).eq('id', currentUserId);
    }
};

// 2. Orders
export const addOrder = (order: Order) => {
    const orders = getOrders();
    orders.push(order);
    saveLocallyAndNotify(orders);
    syncOrderToCloud(order);
};

export const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.status = status;
        saveLocallyAndNotify(orders);
        syncOrderToCloud(order);
    }
};

export const updateOrderItems = (orderId: string, newItems: OrderItem[]) => {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.items = newItems;
        saveLocallyAndNotify(orders);
        syncOrderToCloud(order);
    }
};

export const toggleOrderItemCompletion = (orderId: string, itemIndex: number) => {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    if (order && order.items[itemIndex]) {
        order.items[itemIndex].completed = !order.items[itemIndex].completed;
        saveLocallyAndNotify(orders);
        syncOrderToCloud(order);
    }
};

export const freeTable = (tableNumber: string) => {
    const orders = getOrders();
    // Delete all orders for this table (Active or Delivered) to clear it completely
    const ordersToDelete = orders.filter(o => o.tableNumber === tableNumber);
    const ordersToKeep = orders.filter(o => o.tableNumber !== tableNumber);
    
    saveLocallyAndNotify(ordersToKeep);
    ordersToDelete.forEach(o => syncOrderToCloud(o, true));
};

export const clearHistory = () => {
    const orders = getOrders();
    const activeOrders = orders.filter(o => o.status !== OrderStatus.DELIVERED);
    const historyOrders = orders.filter(o => o.status === OrderStatus.DELIVERED);
    
    saveLocallyAndNotify(activeOrders);
    historyOrders.forEach(o => syncOrderToCloud(o, true));
};

// 3. Settings & Profile
export const getTableCount = () => parseInt(localStorage.getItem(TABLES_COUNT_KEY) || '12', 10);

export const saveTableCount = (count: number) => {
    localStorage.setItem(TABLES_COUNT_KEY, count.toString());
    window.dispatchEvent(new Event('local-storage-update'));
};

export const getWaiterName = () => localStorage.getItem(WAITER_KEY) || '';
export const saveWaiterName = (name: string) => localStorage.setItem(WAITER_KEY, name);
export const logoutWaiter = () => localStorage.removeItem(WAITER_KEY);

export interface NotificationSettings {
  kitchenSound: boolean;
  waiterSound: boolean;
  pushEnabled: boolean;
}

export const getNotificationSettings = (): NotificationSettings => {
    const s = localStorage.getItem(SETTINGS_NOTIFICATIONS_KEY);
    return s ? JSON.parse(s) : { kitchenSound: true, waiterSound: true, pushEnabled: false };
};

export const saveNotificationSettings = (settings: NotificationSettings) => {
    localStorage.setItem(SETTINGS_NOTIFICATIONS_KEY, JSON.stringify(settings));
};

// 4. Menu
export const getMenuItems = (): MenuItem[] => {
    const data = localStorage.getItem(MENU_KEY);
    return data ? JSON.parse(data) : DEFAULT_MENU_ITEMS;
};

const syncMenuToCloud = async (item: MenuItem, isDelete = false) => {
    if (!supabase || !currentUserId) return;
    if (isDelete) {
        await supabase.from('menu_items').delete().eq('id', item.id);
    } else {
        await supabase.from('menu_items').upsert({ ...item, user_id: currentUserId });
    }
};

export const addMenuItem = (item: MenuItem) => {
    const items = getMenuItems();
    items.push(item);
    localStorage.setItem(MENU_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('local-menu-update'));
    syncMenuToCloud(item);
};

export const updateMenuItem = (item: MenuItem) => {
    const items = getMenuItems();
    const idx = items.findIndex(i => i.id === item.id);
    if (idx > -1) {
        items[idx] = item;
        localStorage.setItem(MENU_KEY, JSON.stringify(items));
        window.dispatchEvent(new Event('local-menu-update'));
        syncMenuToCloud(item);
    }
};

export const deleteMenuItem = (id: string) => {
    let items = getMenuItems();
    const item = items.find(i => i.id === id);
    items = items.filter(i => i.id !== id);
    localStorage.setItem(MENU_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('local-menu-update'));
    if (item) syncMenuToCloud(item, true);
};