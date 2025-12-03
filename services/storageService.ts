import { Order, OrderStatus } from '../types';

const STORAGE_KEY = 'ristosync_orders';

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
}