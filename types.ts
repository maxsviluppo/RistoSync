export enum OrderStatus {
  PENDING = 'In Attesa',
  COOKING = 'In Preparazione',
  READY = 'Pronto',
  DELIVERED = 'Servito'
}

export enum Category {
  ANTIPASTI = 'Antipasti',
  PRIMI = 'Primi',
  SECONDI = 'Secondi',
  DOLCI = 'Dolci',
  BEVANDE = 'Bevande'
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: Category;
  description?: string; // Used for AI context
}

export interface OrderItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

export interface Order {
  id: string;
  tableNumber: string;
  items: OrderItem[];
  status: OrderStatus;
  timestamp: number;
}
