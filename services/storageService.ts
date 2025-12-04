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
        // We create a unique channel for this user/restaurant
        const channel = supabase.channel(`room:${currentUserId}`);

        channel
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'orders' 
                // Removed filter: 'user_id=eq...' to rely on Server-Side RLS. 
                // This fixes issues where INSERT events are missed due to filter mismatch.
            }, (payload) => {
                // console.log('Realtime Order Event:', payload);
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
        // Every 30 seconds, force a fetch to ensure sync even if socket drops
        if (pollingInterval) clearInterval(pollingInterval);
        pollingInterval = setInterval(() => {
            fetchFromCloud();
        }, 30000);
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
        if (error) console.error("Cloud Sync Error", error);
    }
};

export const saveOrders = (orders: Order[]) => {
  saveLocallyAndNotify(orders);
};

export const addOrder = (order: Order) => {
  const orders = getOrders();
  const cleanOrder = {
      ...order,
      items: order.items.map(i => ({ ...i, completed: false }))
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
    if (!order) return;

    const updatedOrder = { ...order, items: newItems.map(i => ({...i, completed: false})), timestamp: Date.now() };
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

    // Smart Status Logic
    const allCompleted = newItems.every(i => i.completed);
    const anyCompleted = newItems.some(i => i.completed);
    
    let newStatus = order.status;
    if (order.status !== OrderStatus.DELIVERED) {
        if (allCompleted) newStatus = OrderStatus.READY;
        else if (anyCompleted) newStatus = OrderStatus.COOKING;
        else if (!anyCompleted && (order.status === OrderStatus.COOKING || order.status === OrderStatus.READY)) {
            newStatus = OrderStatus.PENDING;
        }
    }

    const updatedOrder = { ...order, items: newItems, status: newStatus };
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

export const freeTable = async (tableNumber: string) => {
    const orders = getOrders();
    // Identify orders to remove (archiving)
    const ordersToRemove = orders.filter(o => o.tableNumber === tableNumber);
    const newOrders = orders.filter(o => o.tableNumber !== tableNumber);
    
    saveLocallyAndNotify(newOrders);

    if (supabase && currentUserId) {
        // Delete from cloud
        for (const o of ordersToRemove) {
            await supabase.from('orders').delete().eq('id', o.id);
        }
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
            allergens: item.allergens
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

// --- SETTINGS (NOTIFICATIONS) ---
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