import { Order, OrderStatus, OrderItem, MenuItem } from '../types';
import { MENU_ITEMS as DEFAULT_MENU_ITEMS } from '../constants';

const STORAGE_KEY = 'ristosync_orders';
const TABLES_COUNT_KEY = 'ristosync_table_count';
const WAITER_KEY = 'ristosync_waiter_name';
const MENU_KEY = 'ristosync_menu_items';
const SETTINGS_NOTIFICATIONS_KEY = 'ristosync_settings_notifications';

// --- ORDER MANAGEMENT ---
export const getOrders = (): Order[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveOrders = (orders: Order[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  // Dispatch a custom event for the current tab to update
  window.dispatchEvent(new Event('local-storage-update'));
};

export const addOrder = (order: Order) => {
  const orders = getOrders();
  // Ensure items have completed: false initially
  const cleanOrder = {
      ...order,
      items: order.items.map(i => ({ ...i, completed: false }))
  };
  const newOrders = [...orders, cleanOrder];
  saveOrders(newOrders);
};

export const updateOrderStatus = (orderId: string, status: OrderStatus) => {
  const orders = getOrders();
  const newOrders = orders.map(o => o.id === orderId ? { ...o, status } : o);
  saveOrders(newOrders);
};

export const updateOrderItems = (orderId: string, newItems: OrderItem[]) => {
    const orders = getOrders();
    const newOrders = orders.map(o => {
        if (o.id === orderId) {
            return { ...o, items: newItems.map(i => ({...i, completed: false})), timestamp: Date.now() }; 
        }
        return o;
    });
    saveOrders(newOrders);
};

export const toggleOrderItemCompletion = (orderId: string, itemIndex: number) => {
    const orders = getOrders();
    const newOrders = orders.map(o => {
        if (o.id === orderId) {
            const newItems = [...o.items];
            // Toggle the specific item
            if (newItems[itemIndex]) {
                newItems[itemIndex] = { 
                    ...newItems[itemIndex], 
                    completed: !newItems[itemIndex].completed 
                };
            }

            // --- SMART STATUS LOGIC ---
            const allCompleted = newItems.every(i => i.completed);
            const anyCompleted = newItems.some(i => i.completed);
            
            let newStatus = o.status;
            
            // If currently Delivered, don't change automatically
            if (o.status !== OrderStatus.DELIVERED) {
                if (allCompleted) {
                    newStatus = OrderStatus.READY;
                } else if (anyCompleted) {
                    newStatus = OrderStatus.COOKING;
                } else if (!anyCompleted && (o.status === OrderStatus.COOKING || o.status === OrderStatus.READY)) {
                    // If everything unchecked, revert to Pending
                    newStatus = OrderStatus.PENDING;
                }
            }

            return { ...o, items: newItems, status: newStatus };
        }
        return o;
    });
    saveOrders(newOrders);
};

export const clearHistory = () => {
  const orders = getOrders();
  const activeOrders = orders.filter(o => o.status !== OrderStatus.DELIVERED);
  saveOrders(activeOrders);
};

// --- NEW: FREE TABLE LOGIC ---
export const freeTable = (tableNumber: string) => {
    const orders = getOrders();
    // Keep orders that represent OTHER tables. 
    // Effectively deletes/archives orders for the specific table to free it up.
    const newOrders = orders.filter(o => o.tableNumber !== tableNumber);
    saveOrders(newOrders);
};

export const nukeAllData = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('local-storage-update'));
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

// --- MENU MANAGEMENT (NEW) ---
export const getMenuItems = (): MenuItem[] => {
    const data = localStorage.getItem(MENU_KEY);
    if (data) {
        return JSON.parse(data);
    } else {
        // Initialize with defaults if empty
        localStorage.setItem(MENU_KEY, JSON.stringify(DEFAULT_MENU_ITEMS));
        return DEFAULT_MENU_ITEMS;
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
};

export const updateMenuItem = (updatedItem: MenuItem) => {
    const items = getMenuItems();
    const newItems = items.map(i => i.id === updatedItem.id ? updatedItem : i);
    saveMenuItems(newItems);
};

export const deleteMenuItem = (id: string) => {
    const items = getMenuItems();
    const newItems = items.filter(i => i.id !== id);
    saveMenuItems(newItems);
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