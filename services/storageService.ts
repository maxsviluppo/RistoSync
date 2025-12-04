import { Order, OrderStatus, OrderItem } from '../types';

const STORAGE_KEY = 'ristosync_orders';
const TABLES_COUNT_KEY = 'ristosync_table_count';
const WAITER_KEY = 'ristosync_waiter_name';

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
  const newOrders = [...orders, order];
  saveOrders(newOrders);
};

export const updateOrderStatus = (orderId: string, status: OrderStatus) => {
  const orders = getOrders();
  const newOrders = orders.map(o => o.id === orderId ? { ...o, status } : o);
  saveOrders(newOrders);
};

// Update items of an existing pending order (Edit Mode)
export const updateOrderItems = (orderId: string, newItems: OrderItem[]) => {
    const orders = getOrders();
    const newOrders = orders.map(o => {
        if (o.id === orderId) {
            return { ...o, items: newItems, timestamp: Date.now() }; // Update timestamp to indicate modification
        }
        return o;
    });
    saveOrders(newOrders);
};

// Modified: Only removes orders that are explicitly deleted or we want to purge history
// In a real app, this would be "End of Day"
export const clearHistory = () => {
  const orders = getOrders();
  // Keep only pending, cooking, and ready orders (Delete 'Served')
  const activeOrders = orders.filter(o => o.status !== OrderStatus.DELIVERED);
  saveOrders(activeOrders);
};

export const nukeAllData = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('local-storage-update'));
};

// --- Dynamic Table Count Management ---
export const getTableCount = (): number => {
    const count = localStorage.getItem(TABLES_COUNT_KEY);
    return count ? parseInt(count, 10) : 12; // Default to 12 tables
};

export const saveTableCount = (count: number) => {
    localStorage.setItem(TABLES_COUNT_KEY, count.toString());
    window.dispatchEvent(new Event('local-storage-update'));
};

// --- Waiter Session Management ---
export const getWaiterName = (): string | null => {
    return localStorage.getItem(WAITER_KEY);
};

export const saveWaiterName = (name: string) => {
    localStorage.setItem(WAITER_KEY, name);
};

export const logoutWaiter = () => {
    localStorage.removeItem(WAITER_KEY);
};