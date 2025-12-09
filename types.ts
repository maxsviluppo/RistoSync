export enum OrderStatus {
  PENDING = 'In Attesa',
  COOKING = 'In Preparazione',
  READY = 'Pronto',
  DELIVERED = 'Servito'
}

export enum Category {
  ANTIPASTI = 'Antipasti',
  PANINI = 'Panini',
  PIZZE = 'Pizze',
  PRIMI = 'Primi',
  SECONDI = 'Secondi',
  DOLCI = 'Dolci',
  BEVANDE = 'Bevande'
}

export type Department = 'Cucina' | 'Sala' | 'Pizzeria' | 'Pub';

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  google?: string; // Google Business
  tripadvisor?: string;
  thefork?: string;
  youtube?: string;
  linkedin?: string;
}

export interface RestaurantProfile {
  name?: string;
  address?: string;
  billingAddress?: string;
  vatNumber?: string;
  phoneNumber?: string;
  landlineNumber?: string;
  whatsappNumber?: string;
  email?: string;
  website?: string;
  socials?: SocialLinks; // New Field
}

export interface AppSettings {
  categoryDestinations: Record<Category, Department>;
  // Updated: Record<string, boolean> to allow 'Cassa' key alongside departments
  printEnabled: Record<string, boolean>;
  restaurantProfile?: RestaurantProfile;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: Category;
  description?: string; // Used for AI context
  allergens?: string[]; // Array of allergen names (e.g., 'Glutine', 'Latte')
}

export interface OrderItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
  completed?: boolean; // Kitchen finished cooking
  served?: boolean;    // Waiter delivered to table
  isAddedLater?: boolean; // New: Tracks items added via modification
}

export interface Order {
  id: string;
  tableNumber: string;
  items: OrderItem[];
  status: OrderStatus;
  timestamp: number; // Last updated timestamp (acts as exit time when Delivered)
  createdAt: number; // New: Creation timestamp (entry time)
  waiterName?: string;
}