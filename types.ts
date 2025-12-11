
export enum OrderStatus {
  PENDING = 'In Attesa',
  COOKING = 'In Preparazione',
  READY = 'Pronto',
  DELIVERED = 'Servito'
}

export enum Category {
  MENU_COMPLETO = 'Menu Completo', // New Combo Category
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

export interface AgentInfo {
  name?: string;
  commissionType?: 'Monthly' | 'Annual' | 'Percentage' | 'OneOff';
  commissionValue?: string;
  lastPaymentDate?: string;
  nextPaymentDate?: string;
}

export interface RestaurantProfile {
  name?: string; // Nome Visualizzato (Insegna)
  
  // Dati Fatturazione
  businessName?: string; // Ragione Sociale
  responsiblePerson?: string; // Nome e Cognome Responsabile
  vatNumber?: string; // P.IVA / CF
  sdiCode?: string;
  pecEmail?: string;
  address?: string; // Sede Legale
  billingAddress?: string; // Sede Fatturazione (se diversa)
  
  // Contatti
  phoneNumber?: string; // Cellulare
  landlineNumber?: string; // Fisso
  whatsappNumber?: string; // WhatsApp
  email?: string; // Email Contatto/Fatturazione
  website?: string;
  
  socials?: SocialLinks;
  
  // Subscription Fields
  subscriptionEndDate?: string; // ISO Date String
  planType?: 'Trial' | 'Pro' | 'Enterprise' | 'Free' | 'Demo';
  subscriptionCost?: string; // Custom cost set by Admin (string to allow formatting like "29.90")
  
  // Agent Data
  agent?: AgentInfo;
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
  ingredients?: string; // New: Specific ingredients field
  allergens?: string[]; // Array of allergen names (e.g., 'Glutine', 'Latte')
  image?: string; // Base64 encoded image
  
  // Combo / Menu Completo specific fields
  isCombo?: boolean;
  comboItems?: string[]; // Array of IDs of other dishes included
  specificDepartment?: Department; // Overrides category destination (e.g. Pizza Menu goes to Pizzeria, Burger Menu to Pub)
}

export interface OrderItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
  completed?: boolean; // Kitchen finished cooking (Global or Single Item)
  served?: boolean;    // Waiter delivered to table
  isAddedLater?: boolean; // New: Tracks items added via modification
  
  // NEW: Tracks which specific sub-items of a Combo are done.
  // Example: ['pizza_id_1'] means the pizza part is done/cooked.
  comboCompletedParts?: string[]; 
  
  // NEW: Tracks which specific sub-items have been SERVED to the table.
  comboServedParts?: string[];
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