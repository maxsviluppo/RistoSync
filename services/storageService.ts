import { Order, OrderStatus, OrderItem, MenuItem, AppSettings, Category, Department } from '../types';
import { supabase } from './supabase';

const STORAGE_KEY = 'ristosync_orders';
const TABLES_COUNT_KEY = 'ristosync_table_count';
const WAITER_KEY = 'ristosync_waiter_name';
const MENU_KEY = 'ristosync_menu_items';
const SETTINGS_NOTIFICATIONS_KEY = 'ristosync_settings_notifications';
const APP_SETTINGS_KEY = 'ristosync_app_settings'; // New Global Settings Key
const GOOGLE_API_KEY_STORAGE = 'ristosync_google_api_key';

// --- DEMO DATASET ---
const DEMO_MENU_ITEMS: MenuItem[] = [
    // ANTIPASTI
    { id: 'demo_a1', name: 'Tagliere del Contadino', price: 18, category: Category.ANTIPASTI, description: 'Selezione di salumi nostrani, formaggi stagionati, miele di castagno e noci.', allergens: ['Latticini', 'Frutta a guscio'], ingredients: 'Prosciutto crudo, Salame felino, Pecorino, Miele, Noci' },
    { id: 'demo_a2', name: 'Bruschette Miste', price: 8, category: Category.ANTIPASTI, description: 'Tris di bruschette: pomodoro fresco, patè di olive, crema di carciofi.', allergens: ['Glutine'], ingredients: 'Pane casereccio, Pomodoro, Aglio, Olio EVO, Olive' },
    { id: 'demo_a3', name: 'Insalata di Mare', price: 14, category: Category.ANTIPASTI, description: 'Molluschi e crostacei freschi marinati al limone e prezzemolo.', allergens: ['Pesce', 'Molluschi'], ingredients: 'Polpo, Calamari, Gamberi, Sedano, Carote' },
    
    // PRIMI
    { id: 'demo_p1', name: 'Spaghetti alla Carbonara', price: 12, category: Category.PRIMI, description: 'La vera ricetta romana con guanciale croccante, uova bio e pecorino.', allergens: ['Glutine', 'Uova', 'Latticini'], ingredients: 'Spaghetti, Guanciale, Tuorlo d\'uovo, Pecorino Romano, Pepe nero' },
    { id: 'demo_p2', name: 'Tonnarelli Cacio e Pepe', price: 11, category: Category.PRIMI, description: 'Cremosità unica con pecorino romano DOP e pepe nero tostato.', allergens: ['Glutine', 'Latticini'], ingredients: 'Tonnarelli freschi, Pecorino Romano, Pepe nero' },
    { id: 'demo_p3', name: 'Risotto ai Funghi Porcini', price: 14, category: Category.PRIMI, description: 'Riso Carnaroli mantecato con funghi porcini freschi e prezzemolo.', allergens: ['Latticini'], ingredients: 'Riso Carnaroli, Funghi Porcini, Burro, Parmigiano, Brodo vegetale' },
    { id: 'demo_p4', name: 'Lasagna alla Bolognese', price: 13, category: Category.PRIMI, description: 'Sfoglia fresca, ragù a lunga cottura e besciamella fatta in casa.', allergens: ['Glutine', 'Latticini', 'Uova', 'Sedano'], ingredients: 'Sfoglia all\'uovo, Carne macinata, Pomodoro, Besciamella' },

    // SECONDI
    { id: 'demo_s1', name: 'Tagliata di Manzo', price: 22, category: Category.SECONDI, description: 'Controfiletto servito con rucola selvatica e scaglie di grana.', allergens: ['Latticini'], ingredients: 'Manzo, Rucola, Grana Padano, Aceto Balsamico' },
    { id: 'demo_s2', name: 'Filetto al Pepe Verde', price: 24, category: Category.SECONDI, description: 'Tenero filetto scottato in salsa cremosa al pepe verde.', allergens: ['Latticini', 'Senape'], ingredients: 'Filetto di manzo, Panna fresca, Pepe verde in salamoia, Brandy' },
    { id: 'demo_s3', name: 'Grigliata Mista di Pesce', price: 26, category: Category.SECONDI, description: 'Gamberoni, calamari e pescato del giorno alla griglia.', allergens: ['Pesce', 'Crostacei'], ingredients: 'Gamberoni, Calamari, Pesce spada, Orata' },
    { id: 'demo_s4', name: 'Parmigiana di Melanzane', price: 12, category: Category.SECONDI, description: 'Melanzane fritte, pomodoro San Marzano, mozzarella fior di latte e basilico.', allergens: ['Latticini', 'Glutine'], ingredients: 'Melanzane, Salsa di pomodoro, Mozzarella, Parmigiano, Basilico' },

    // PIZZE
    { id: 'demo_pz1', name: 'Margherita DOP', price: 8, category: Category.PIZZE, description: 'Pomodoro San Marzano, Mozzarella di Bufala, Basilico fresco.', allergens: ['Glutine', 'Latticini'], ingredients: 'Impasto, Pomodoro, Mozzarella di Bufala, Basilico, Olio EVO' },
    { id: 'demo_pz2', name: 'Diavola', price: 9, category: Category.PIZZE, description: 'Per chi ama il piccante: salame napoli piccante e olio santo.', allergens: ['Glutine', 'Latticini', 'Piccante'], ingredients: 'Impasto, Pomodoro, Mozzarella, Salame Piccante' },
    { id: 'demo_pz3', name: 'Quattro Formaggi', price: 10, category: Category.PIZZE, description: 'Selezione di formaggi: Gorgonzola, Taleggio, Fontina e Mozzarella.', allergens: ['Glutine', 'Latticini'], ingredients: 'Impasto, Mozzarella, Gorgonzola, Fontina, Parmigiano' },
    { id: 'demo_pz4', name: 'Vegetariana', price: 9.5, category: Category.PIZZE, description: 'Verdure di stagione grigliate su base rossa.', allergens: ['Glutine', 'Latticini', 'Vegano'], ingredients: 'Impasto, Pomodoro, Mozzarella, Melanzane, Zucchine, Peperoni' },

    // PANINI (PUB)
    { id: 'demo_pn1', name: 'Classic Burger', price: 12, category: Category.PANINI, description: 'Burger di manzo 180g, lattuga, pomodoro, salsa BBQ. Con patatine.', allergens: ['Glutine', 'Sesamo'], ingredients: 'Bun, Hamburger Manzo, Lattuga, Pomodoro, Salsa BBQ' },
    { id: 'demo_pn2', name: 'Bacon Cheeseburger', price: 14, category: Category.PANINI, description: 'Doppio cheddar fuso, bacon croccante e cipolla caramellata.', allergens: ['Glutine', 'Latticini', 'Sesamo'], ingredients: 'Bun, Hamburger Manzo, Cheddar, Bacon, Cipolla' },
    { id: 'demo_pn3', name: 'Club Sandwich', price: 13, category: Category.PANINI, description: 'Triplo strato con pollo, bacon, uovo, lattuga e maionese.', allergens: ['Glutine', 'Uova'], ingredients: 'Pane in cassetta, Pollo grigliato, Bacon, Uovo sodo, Maionese' },

    // DOLCI
    { id: 'demo_d1', name: 'Tiramisù Classico', price: 6, category: Category.DOLCI, description: 'Fatto in casa con mascarpone fresco e caffè espresso.', allergens: ['Latticini', 'Uova', 'Glutine'], ingredients: 'Savoiardi, Mascarpone, Uova, Caffè, Cacao' },
    { id: 'demo_d2', name: 'Cheesecake ai Frutti di Bosco', price: 7, category: Category.DOLCI, description: 'Base di biscotto croccante e crema al formaggio fresco.', allergens: ['Latticini', 'Glutine'], ingredients: 'Biscotti digestive, Burro, Formaggio spalmabile, Panna, Frutti di bosco' },
    { id: 'demo_d3', name: 'Tortino al Cioccolato', price: 7, category: Category.DOLCI, description: 'Cuore caldo fondente servito con gelato alla vaniglia.', allergens: ['Latticini', 'Uova', 'Glutine'], ingredients: 'Cioccolato fondente, Burro, Uova, Farina, Zucchero' },

    // BEVANDE
    { id: 'demo_b1', name: 'Acqua Naturale 0.75cl', price: 2.5, category: Category.BEVANDE, description: 'Bottiglia in vetro.' },
    { id: 'demo_b2', name: 'Coca Cola 33cl', price: 3.5, category: Category.BEVANDE, description: 'In vetro.' },
    { id: 'demo_b3', name: 'Birra Artigianale IPA', price: 6, category: Category.BEVANDE, description: 'Note agrumate e finale amaro persistente.', allergens: ['Glutine'] },
    { id: 'demo_b4', name: 'Calice Chianti Classico', price: 7, category: Category.BEVANDE, description: 'Rosso fermo, Toscana DOCG.' },
    { id: 'demo_b5', name: 'Caffè Espresso', price: 1.5, category: Category.BEVANDE, description: 'Miscela 100% Arabica.' }
];

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
                table: 'orders',
                filter: `user_id=eq.${currentUserId}` // Filter by user ID
            }, (payload) => {
                fetchFromCloud(); 
            })
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'menu_items',
                filter: `user_id=eq.${currentUserId}` // Filter by user ID
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
    // CRITICAL FIX: Explicitly filter by user_id to prevent data mixing
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', currentUserId);

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
    // CRITICAL FIX: Explicitly filter by user_id. 
    // Since we enabled "Public Read" for the digital menu, select('*') returns EVERYONE'S menu without this filter.
    const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('user_id', currentUserId);

    if (!error && data) {
         // Map DB snake_case columns back to camelCase for App
         const appMenuItems: MenuItem[] = data.map((row: any) => ({
             id: row.id,
             name: row.name,
             price: row.price,
             category: row.category,
             description: row.description,
             ingredients: row.ingredients, // Ensure simple fields map
             allergens: row.allergens,
             image: row.image,
             // COMBO MAPPING FIX
             isCombo: row.category === Category.MENU_COMPLETO, 
             comboItems: row.combo_items || [], // Map snake_case from DB
             specificDepartment: row.specific_department // Map snake_case from DB
         }));

         localStorage.setItem(MENU_KEY, JSON.stringify(appMenuItems));
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
              isAddedLater: false,
              comboCompletedParts: [], // Init empty array for combos cooking
              comboServedParts: []     // Init empty array for combos serving
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
                isAddedLater: true,
                comboCompletedParts: existing.comboCompletedParts || [],
                comboServedParts: existing.comboServedParts || []
            };
        } else {
            // ADD NEW ITEM: Append to list
            const isSala = settings.categoryDestinations[newItem.menuItem.category] === 'Sala';
            mergedItems.push({
                ...newItem,
                completed: isSala,
                served: false,
                isAddedLater: true,
                comboCompletedParts: [],
                comboServedParts: []
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

export const toggleOrderItemCompletion = (orderId: string, itemIndex: number, subItemId?: string) => {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const newItems = [...order.items];
    const targetItem = newItems[itemIndex];

    if (targetItem) {
        // COMBO LOGIC: If a subItemId is provided, toggle ONLY that part
        if (subItemId && targetItem.menuItem.category === Category.MENU_COMPLETO && targetItem.menuItem.comboItems) {
            const currentParts = targetItem.comboCompletedParts || [];
            let newParts;
            
            if (currentParts.includes(subItemId)) {
                newParts = currentParts.filter(id => id !== subItemId);
            } else {
                newParts = [...currentParts, subItemId];
            }
            
            // Update the parts list
            newItems[itemIndex] = {
                ...targetItem,
                comboCompletedParts: newParts
            };

            // CHECK IF ALL PARTS ARE DONE to mark main item completed
            const allPartsDone = targetItem.menuItem.comboItems.every(id => newParts.includes(id));
            newItems[itemIndex].completed = allPartsDone;

        } else {
            // STANDARD LOGIC: Toggle the whole item
            newItems[itemIndex] = { 
                ...targetItem, 
                completed: !targetItem.completed 
            };
        }
    }

    // Smart Status Logic for Kitchen (Ready if all cooked)
    const allCooked = newItems.every(i => i.completed);
    const anyCooked = newItems.some(i => i.completed || (i.comboCompletedParts && i.comboCompletedParts.length > 0));
    
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

export const serveItem = (orderId: string, itemIndex: number, subItemId?: string) => {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const newItems = [...order.items];
    const targetItem = newItems[itemIndex];

    if (targetItem) {
        // COMBO LOGIC: Serve Specific Part
        if (subItemId && targetItem.menuItem.category === Category.MENU_COMPLETO && targetItem.menuItem.comboItems) {
            const currentServed = targetItem.comboServedParts || [];
            let newServed = currentServed;
            
            if (!currentServed.includes(subItemId)) {
                newServed = [...currentServed, subItemId];
            }

            newItems[itemIndex] = { 
                ...targetItem, 
                comboServedParts: newServed
            };

            // Check if ALL parts are served
            const allPartsServed = targetItem.menuItem.comboItems.every(id => newServed.includes(id));
            if (allPartsServed) {
                newItems[itemIndex].served = true;
            }

        } else {
            // STANDARD LOGIC
            newItems[itemIndex] = { 
                ...targetItem, 
                served: true 
            };
        }
    }

    // If all items are served, mark order as DELIVERED
    const allServed = newItems.every(i => i.served);
    let newStatus = order.status;
    if (allServed) {
        newStatus = OrderStatus.DELIVERED;
    }

    // UPDATE TIMESTAMP TO RESET TIMERS
    const updatedOrder = { 
        ...order, 
        items: newItems, 
        status: newStatus,
        timestamp: Date.now() 
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

// --- MENU DELETION (BULK) ---
export const deleteAllMenuItems = async () => {
    // 1. Clear Local Menu
    localStorage.setItem(MENU_KEY, '[]');
    window.dispatchEvent(new Event('local-menu-update'));

    // 2. Clear Cloud Menu Items
    if (supabase && currentUserId) {
        await supabase.from('menu_items').delete().eq('user_id', currentUserId);
    }
};

// --- IMPORT DEMO MENU ---
export const importDemoMenu = async () => {
    if (!currentUserId || !supabase) return;

    const demoItemsWithUserId = DEMO_MENU_ITEMS.map(item => ({
        id: item.id, // Keep demo ID to prevent duplicates if imported multiple times
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
    }));

    // 1. Update Cloud (Bulk Insert)
    const { error } = await supabase.from('menu_items').upsert(demoItemsWithUserId);
    
    if (error) {
        console.error("Demo Import Error:", error);
        alert("Errore durante l'importazione demo.");
        return;
    }

    // 2. Update Local
    // We fetch current items, and merge (or just replace if empty, but merging is safer)
    const currentItems = getMenuItems();
    // Filter out items that are being replaced (though ID collision handles this naturally in DB, local array needs logic)
    const newIds = DEMO_MENU_ITEMS.map(d => d.id);
    const existingFiltered = currentItems.filter(i => !newIds.includes(i.id));
    
    const finalMenu = [...existingFiltered, ...DEMO_MENU_ITEMS];
    localStorage.setItem(MENU_KEY, JSON.stringify(finalMenu));
    window.dispatchEvent(new Event('local-menu-update'));
    
    alert("Menu Demo importato con successo!");
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
        // CHANGED: Do NOT return default items. Start with empty to avoid data mixing appearance.
        // localStorage.setItem(MENU_KEY, JSON.stringify(DEFAULT_MENU_ITEMS));
        // return DEFAULT_MENU_ITEMS;
        return [];
    }
};

const syncMenuToCloud = async (item: MenuItem, isDelete = false) => {
    if (!supabase || !currentUserId) return;
    if (isDelete) {
        await supabase.from('menu_items').delete().eq('id', item.id);
    } else {
         // MAP CAMELCASE TO SNAKE_CASE FOR DB
         const payload = {
            id: item.id,
            user_id: currentUserId,
            name: item.name,
            price: item.price,
            category: item.category,
            description: item.description,
            ingredients: item.ingredients,
            allergens: item.allergens,
            image: item.image,
            // CRITICAL: SAVE COMBO FIELDS
            combo_items: item.comboItems, 
            specific_department: item.specificDepartment
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