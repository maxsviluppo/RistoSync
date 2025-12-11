import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Category, MenuItem, Order, OrderItem, OrderStatus, AppSettings, Department } from '../types';
import { addOrder, getOrders, getTableCount, saveTableCount, updateOrderItems, getWaiterName, logoutWaiter, getMenuItems, freeTable, updateOrderStatus, getAppSettings, serveItem } from '../services/storageService';
import { askChefAI } from '../services/geminiService';
import { ShoppingBag, Send, X, Plus, Minus, Bot, History, Clock, ChevronUp, ChevronDown, Trash2, Search, Utensils, ChefHat, Pizza, CakeSlice, Wine, Edit2, Check, AlertTriangle, Info, LayoutGrid, Users, Settings, Save, User, LogOut, Home, Wheat, Milk, Egg, Nut, Fish, Bean, Flame, Leaf, DoorOpen, Bell, ArrowRight, Lock, PlusCircle, Coffee, CheckCircle, Mic, MicOff, AlertOctagon, Flag, UtensilsCrossed, Sandwich, Printer, ListPlus, CornerDownRight } from 'lucide-react';

const CATEGORY_ORDER = [Category.ANTIPASTI, Category.PANINI, Category.PIZZE, Category.PRIMI, Category.SECONDI, Category.DOLCI, Category.BEVANDE];

const capitalize = (str: string) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

const playWaiterNotification = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        
        // Bell sound (DRIN)
        const osc1 = ctx.createOscillator(); osc1.type = 'sine'; osc1.frequency.setValueAtTime(880, now); osc1.frequency.exponentialRampToValueAtTime(440, now + 0.15); osc1.connect(gain);
        const osc2 = ctx.createOscillator(); osc2.type = 'triangle'; osc2.frequency.setValueAtTime(554, now + 0.2); osc2.frequency.exponentialRampToValueAtTime(277, now + 0.4); osc2.connect(gain);
        const osc3 = ctx.createOscillator(); osc3.type = 'square'; osc3.frequency.setValueAtTime(880, now + 0.45); osc3.frequency.setValueAtTime(1108, now + 0.55); osc3.connect(gain);
        
        gain.gain.setValueAtTime(0.4, now); 
        gain.gain.linearRampToValueAtTime(0, now + 0.8);
        
        osc1.start(now); osc1.stop(now + 0.2); 
        osc2.start(now + 0.2); osc2.stop(now + 0.45); 
        osc3.start(now + 0.45); osc3.stop(now + 0.8);
    } catch (e) { console.error("Audio error", e); }
};

interface SwipeableItemProps {
    item: OrderItem;
    index: number;
    onEdit: () => void;
    onDelete: () => void;
    isFirst: boolean;
    appSettings: AppSettings;
    isAddition: boolean;
}

const SwipeableCartItem: React.FC<SwipeableItemProps> = ({ item, index, onEdit, onDelete, isFirst, appSettings, isAddition }) => {
    const [offsetX, setOffsetX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startX = useRef<number>(0);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const THRESHOLD = 60;

    const handleTouchStart = (e: React.TouchEvent) => { setHasInteracted(true); setIsAnimating(false); setIsDragging(true); startX.current = e.touches[0].clientX; };
    const handleTouchMove = (e: React.TouchEvent) => { if (!isDragging) return; const diff = e.touches[0].clientX - startX.current; if (diff > -150 && diff < 150) setOffsetX(diff); };
    const handleTouchEnd = () => { setIsDragging(false); if (offsetX > THRESHOLD) { onEdit(); setOffsetX(0); } else if (offsetX < -THRESHOLD) { onDelete(); setOffsetX(0); } else { setOffsetX(0); } };

    useEffect(() => {
        if (!isFirst || hasInteracted) return;
        const interval = setInterval(() => { if (!hasInteracted) { setIsAnimating(true); setTimeout(() => { if (!hasInteracted) setIsAnimating(false); }, 2500); } }, 6000);
        const initialTimeout = setTimeout(() => { if (!hasInteracted) { setIsAnimating(true); setTimeout(() => setIsAnimating(false), 2500); } }, 1000);
        return () => { clearInterval(interval); clearTimeout(initialTimeout); };
    }, [isFirst, hasInteracted]);

    const getBgColor = () => { if (isAnimating) return 'animate-bg-color'; if (offsetX > 20) return 'bg-orange-500'; if (offsetX < -20) return 'bg-red-600'; return 'bg-slate-700'; };
    
    // Check Destination
    const isSala = appSettings.categoryDestinations[item.menuItem.category] === 'Sala';

    return (
        <div className={`relative h-[72px] rounded-2xl overflow-hidden mb-2 select-none transition-colors duration-200 touch-pan-y ${getBgColor()}`} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
            <div className="absolute inset-0 flex justify-between items-center px-5 text-white font-black">
                <div className={`flex items-center gap-2 transition-all duration-300 ${isAnimating ? 'animate-fade-edit' : (offsetX > 30 ? 'opacity-100 scale-100' : 'opacity-0 scale-90')}`}><Edit2 size={22} /> <span className="text-xs uppercase tracking-widest">Modifica</span></div>
                <div className={`flex items-center gap-2 transition-all duration-300 ${isAnimating ? 'animate-fade-delete' : (offsetX < -30 ? 'opacity-100 scale-100' : 'opacity-0 scale-90')}`}><span className="text-xs uppercase tracking-widest">Elimina</span> <Trash2 size={22} /></div>
            </div>
            <div className={`absolute inset-0 bg-slate-800 px-4 flex flex-col justify-center border border-slate-700 shadow-md ${isAnimating ? 'animate-card-swipe' : ''}`} style={{ transform: isAnimating ? undefined : `translateX(${offsetX}px)`, transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
                 <div className="flex justify-between items-center">
                    <div className="flex gap-3 items-center w-full">
                        <span className="bg-slate-700 text-slate-200 font-bold w-8 h-8 flex items-center justify-center rounded-lg text-sm shadow-inner shrink-0">{item.quantity}</span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-base block leading-tight truncate">{item.menuItem.name}</span>
                                {isAddition && <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold uppercase flex items-center gap-1 shadow-sm border border-blue-400/50"><PlusCircle size={8}/> INTEGRAZIONE</span>}
                            </div>
                            {item.notes && <p className="text-[10px] text-slate-400 mt-1 italic pl-2 border-l-2 border-slate-600 truncate">{item.notes}</p>}
                        </div>
                        {isSala && <div className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded text-[9px] font-bold uppercase border border-blue-500/30 flex items-center gap-1"><Coffee size={10}/> SALA</div>}
                    </div>
                </div>
            </div>
            {offsetX === 0 && !hasInteracted && isFirst && !isAnimating && (<><div className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-600/30 animate-pulse"><ChevronDown className="rotate-90" size={12} /></div><div className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-600/30 animate-pulse"><ChevronDown className="-rotate-90" size={12} /></div></>)}
        </div>
    );
};

// --- RECEIPT GENERATOR ---
const generateReceiptHtml = (items: OrderItem[], dept: string, table: string, waiter: string, restaurantName: string, allMenuItems: MenuItem[]) => {
    const time = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const date = new Date().toLocaleDateString('it-IT');
    const isMaster = dept.includes('Totale') || dept.includes('Cassa');
    
    // Calculate total if Master
    const total = isMaster ? items.reduce((acc, i) => acc + (i.menuItem.price * i.quantity), 0) : 0;

    return `
    <html>
        <head>
            <title>Scontrino ${table}</title>
            <style>
                body { font-family: 'Courier New', monospace; width: 300px; margin: 0; padding: 10px; font-size: 14px; color: black; background: white; }
                .header { text-align: center; border-bottom: 2px dashed black; padding-bottom: 10px; margin-bottom: 10px; }
                .title { font-size: 18px; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
                .dept { font-size: 24px; font-weight: bold; background: black; color: white; display: inline-block; padding: 2px 10px; margin: 5px 0; }
                .meta { font-size: 14px; margin: 2px 0; font-weight: bold; }
                .item { display: flex; margin-bottom: 4px; align-items: baseline; }
                .qty { font-weight: bold; width: 30px; font-size: 16px; }
                .name { flex: 1; font-weight: bold; font-size: 16px; }
                .notes { display: block; font-size: 12px; margin-left: 30px; font-style: italic; margin-bottom: 4px; }
                .sub-items { margin-left: 30px; font-size: 12px; margin-bottom: 8px; color: #333; }
                .footer { border-top: 2px dashed black; margin-top: 15px; padding-top: 10px; text-align: center; font-size: 10px; }
                .total { margin-top: 10px; padding-top: 5px; border-top: 1px solid black; font-weight: bold; font-size: 20px; text-align: right; }
                .price { font-size: 14px; font-weight: normal; margin-left: 10px; }
                @media print { .no-print { display: none !important; } }
                .close-btn { display: block; width: 100%; background-color: #ef4444; color: white; text-align: center; padding: 15px 0; font-weight: bold; font-size: 16px; border: none; cursor: pointer; position: fixed; bottom: 0; left: 0; right: 0; text-transform: uppercase; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">${restaurantName}</div>
                <div class="dept">${dept}</div>
                <div class="meta">TAVOLO: ${table}</div>
                <div class="meta">Staff: ${waiter}</div>
                <div style="font-size: 12px; margin-top:5px;">${date} - ${time}</div>
            </div>
            ${items.map(item => {
                let subItemsHtml = '';
                // Resolve sub-items for Menu Combo
                if (item.menuItem.category === Category.MENU_COMPLETO && item.menuItem.comboItems) {
                    const subNames = item.menuItem.comboItems.map(id => allMenuItems.find(m => m.id === id)?.name).filter(Boolean);
                    if (subNames.length > 0) {
                        subItemsHtml = `<div class="sub-items">${subNames.map(n => `<div>- ${n}</div>`).join('')}</div>`;
                    }
                }

                return `
                <div class="item">
                    <span class="qty">${item.quantity}</span>
                    <span class="name">${item.menuItem.name}</span>
                    ${isMaster ? `<span class="price">€ ${(item.menuItem.price * item.quantity).toFixed(2)}</span>` : ''}
                </div>
                ${subItemsHtml}
                ${item.notes ? `<span class="notes">Note: ${item.notes}</span>` : ''}
                `;
            }).join('')}
            
            ${isMaster ? `
            <div class="total">
                TOTALE: € ${total.toFixed(2)}
            </div>` : ''}

            <div class="footer">
                RistoSync AI - Copia di Cortesia
                <br>*** NON FISCALE ***
            </div>

            <button class="no-print close-btn" onclick="window.close()">✖ CHIUDI FINESTRA</button>
            <script>
                window.onload = function() { 
                    setTimeout(function(){ window.focus(); window.print(); }, 500); 
                }
            </script>
        </body>
    </html>
    `;
};

interface WaiterPadProps { onExit: () => void; }

const WaiterPad: React.FC<WaiterPadProps> = ({ onExit }) => {
  const [table, setTable] = useState<string>('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category>(Category.ANTIPASTI);
  const [isSending, setIsSending] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [waiterName, setWaiterName] = useState<string>('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  
  // NEW: State for Cart Visibility (replacing draggable sheet height)
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editNotes, setEditNotes] = useState('');
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [cartBump, setCartBump] = useState(false);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [freeTableConfirmOpen, setFreeTableConfirmOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiItem, setAiItem] = useState<MenuItem | null>(null);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [tableManagerOpen, setTableManagerOpen] = useState(false);
  const [existingOrders, setExistingOrders] = useState<Order[]>([]);
  const [allRestaurantOrders, setAllRestaurantOrders] = useState<Order[]>([]);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);
  const [totalTables, setTotalTables] = useState(12);
  const [isSettingTables, setIsSettingTables] = useState(false);
  const [tempTableCount, setTempTableCount] = useState(12);
  const [appSettings, setAppSettingsState] = useState<AppSettings>(getAppSettings());
  const [isListening, setIsListening] = useState(false);
  const [lateTables, setLateTables] = useState<string[]>([]);
  const [latesAcknowledged, setLatesAcknowledged] = useState(false);

  // REFERENCES FOR NOTIFICATION STATE
  const prevItemReadyStateRef = useRef<Record<string, boolean>>({});
  const seenReadyComboPartsRef = useRef<Set<string>>(new Set()); 
  const isFirstLoad = useRef(true);

  // --- HELPER FOR COMBO ITEMS ---
  const getSubItemsForCombo = (item: OrderItem): MenuItem[] => {
      if (item.menuItem.category !== Category.MENU_COMPLETO || !item.menuItem.comboItems) return [];
      // Resolve IDs to full items using menuItems state
      return menuItems.filter(m => item.menuItem.comboItems?.includes(m.id));
  };

  const loadData = () => {
      const allOrders = getOrders();
      setAllRestaurantOrders(allOrders);
      const name = getWaiterName();
      if (name) setWaiterName(name);
      
      const currentMenuItems = getMenuItems();
      const currentSettings = getAppSettings();
      setAppSettingsState(currentSettings); 

      // --- LOGICA NOTIFICHE ---
      let newlyReadyCount = 0;
      const currentItemReadyState: Record<string, boolean> = {}; // For standard items
      const currentReadyComboParts = new Set<string>(); // For Combo sub-items
      const currentLateTables: string[] = [];

      allOrders.forEach(order => {
          if (order.status === OrderStatus.DELIVERED) return; 

          // 1. CHECK DELAY
          const delayMinutes = (Date.now() - order.timestamp) / 60000;
          if (delayMinutes >= 25 && order.status !== OrderStatus.READY) {
              currentLateTables.push(order.tableNumber);
          }

          order.items.forEach((item, idx) => {
              // ==========================================
              // LOGICA STANDARD (Piatti Singoli)
              // ==========================================
              if (item.menuItem.category !== Category.MENU_COMPLETO) {
                  const mainKey = `${order.id}-${idx}`;
                  currentItemReadyState[mainKey] = item.completed || false;

                  if (!isFirstLoad.current) {
                       const wasMainReady = prevItemReadyStateRef.current[mainKey] || false;
                       if (!wasMainReady && item.completed && !item.served) {
                           newlyReadyCount++;
                       }
                  }
              }
              // ==========================================
              // LOGICA DEDICATA SOTTO-PIATTI (Combo)
              // ==========================================
              else {
                  // Recupera definizione corretta per sapere se è Sala o Cucina
                  const subIds = item.menuItem.comboItems || [];
                  const completedParts = item.comboCompletedParts || [];
                  const servedParts = item.comboServedParts || [];

                  subIds.forEach(subId => {
                      // 1. Check if it's already served
                      if (servedParts.includes(subId) || item.served) return; // Skip if served

                      // 2. Identify if it is Sala (Drink) or Kitchen
                      const canonicalSub = currentMenuItems.find(m => m.id === subId);
                      const isSala = canonicalSub && currentSettings.categoryDestinations[canonicalSub.category] === 'Sala';
                      
                      // 3. Determine Readiness
                      // READY IF: (Is Sala Item) OR (Is Kitchen Item AND Completed)
                      const isReady = isSala || completedParts.includes(subId);

                      if (isReady) {
                          const uniquePartKey = `${order.id}-${idx}-${subId}`;
                          currentReadyComboParts.add(uniquePartKey);

                          // Trigger notification if this part is NEWLY ready/seen
                          if (!isFirstLoad.current && !seenReadyComboPartsRef.current.has(uniquePartKey)) {
                              newlyReadyCount++;
                          }
                      }
                  });
              }
          });
      });
      
      // Update Late Tables State
      setLateTables(currentLateTables);
      
      // TRIGGER NOTIFICATION
      if (newlyReadyCount > 0) {
          playWaiterNotification();
          const msg = newlyReadyCount === 1 ? `1 PIATTO PRONTO DA SERVIRE` : `${newlyReadyCount} PIATTI PRONTI DA SERVIRE`;
          setNotificationToast(msg);
          setTimeout(() => setNotificationToast(null), 8000);
      }
      
      // Update Refs for next cycle
      prevItemReadyStateRef.current = currentItemReadyState;
      seenReadyComboPartsRef.current = currentReadyComboParts; 
      isFirstLoad.current = false;

      if (table) {
          const tableOrders = allOrders.filter(o => o.tableNumber === table).sort((a, b) => b.timestamp - a.timestamp);
          setExistingOrders(tableOrders);
      } else { setExistingOrders([]); }
      setTotalTables(getTableCount());
      setMenuItems(currentMenuItems);
  };

  useEffect(() => {
    loadData();
    const handleStorageChange = (e: StorageEvent) => { if (e.key === 'ristosync_orders' || e.key === 'ristosync_table_count' || e.key === 'ristosync_menu_items') loadData(); };
    const handleLocalUpdate = () => loadData();
    const handleSettingsUpdate = () => loadData(); 

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage-update', handleLocalUpdate);
    window.addEventListener('local-settings-update', handleSettingsUpdate);
    window.addEventListener('local-menu-update', handleLocalUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-update', handleLocalUpdate);
      window.removeEventListener('local-settings-update', handleSettingsUpdate);
      window.removeEventListener('local-menu-update', handleLocalUpdate);
    };
  }, [table]);

  // Reset acknowledgment if late tables clear up
  useEffect(() => {
     if (lateTables.length === 0) setLatesAcknowledged(false);
  }, [lateTables]);

  // LOGICA ICONA TAVOLO (Pulsante e Badges)
  const getTableStatusInfo = (tableNum: string) => {
      const activeOrders = allRestaurantOrders.filter(o => o.tableNumber === tableNum);
      if (activeOrders.length === 0) return { status: 'free', count: 0, owner: null, delay: 0 };
      
      const activeOrder = activeOrders[0];
      const orderDelayMinutes = Math.floor((Date.now() - activeOrder.timestamp) / 60000);
      const isLate = orderDelayMinutes > 25 && activeOrder.status !== OrderStatus.READY && activeOrder.status !== OrderStatus.DELIVERED;

      let readyToServeCount = 0;
      let totalItems = 0;
      let totalServed = 0;

      activeOrder.items.forEach(i => {
          totalItems++;
          
          if (i.menuItem.category !== Category.MENU_COMPLETO) {
              // Standard Item Logic
              if (i.served) totalServed++;
              if (i.completed && !i.served) readyToServeCount++;
          } else {
              // Combo Item Logic (Detailed)
              const subIds = i.menuItem.comboItems || [];
              subIds.forEach(subId => {
                  const canonicalSub = menuItems.find(m => m.id === subId);
                  const isSala = canonicalSub && appSettings.categoryDestinations[canonicalSub.category] === 'Sala';
                  
                  const isReady = isSala || i.comboCompletedParts?.includes(subId);
                  // Check served: if parent served OR specific part served
                  const isServed = i.served || i.comboServedParts?.includes(subId);

                  if (isReady && !isServed) readyToServeCount++;
              });
              // We don't increment totalServed/totalItems for subparts to avoid skewing logic, 
              // but we check if the MAIN item is served.
              if (i.served) totalServed++;
          }
      });

      // 1. PRIORITY: Ready to Serve (Includes Drinks & Combo Parts) -> GREEN
      if (readyToServeCount > 0) return { status: 'ready', count: readyToServeCount, owner: activeOrder.waiterName, delay: orderDelayMinutes };
      
      // 2. All Served (Eating)
      if (totalItems > 0 && totalItems === totalServed) return { status: 'eating', count: 0, owner: activeOrder.waiterName, delay: 0 };

      // 3. Late
      if (isLate) return { status: 'late', count: 0, owner: activeOrder.waiterName, delay: orderDelayMinutes };
      
      // 4. Occupied
      return { status: 'occupied', count: 0, owner: activeOrder.waiterName, delay: orderDelayMinutes };
  };

  // Check if ANY table has items ready to serve (for Header Pulse)
  const hasUnseenNotifications = useMemo(() => {
      // Loop all tables, check if any status is 'ready'
      for (let i = 1; i <= totalTables; i++) {
          const info = getTableStatusInfo(i.toString());
          if (info.status === 'ready') return true;
      }
      return false;
  }, [allRestaurantOrders, menuItems, appSettings]);

  const sortedCart = [...cart].sort((a, b) => CATEGORY_ORDER.indexOf(a.menuItem.category) - CATEGORY_ORDER.indexOf(b.menuItem.category));

  // REMOVED DRAGGABLE SHEET LOGIC - REPLACED WITH FIXED TOGGLE
  const toggleCart = () => setIsCartOpen(!isCartOpen);

  const handleSelectTable = (tId: string) => {
      if (table === tId) { setTable(''); setCart([]); setEditingOrderId(null); return; }
      setTable(tId);
      // We don't filter by status here, we want the active context even if everything is served
      const activeOrder = allRestaurantOrders.find(o => o.tableNumber === tId);
      setCart([]); setEditingOrderId(activeOrder ? activeOrder.id : null); // Set ID directly here for logic
      setTableManagerOpen(true);
      // Ensure we set acknowledged when interacting
      setLatesAcknowledged(true);
  };

  const startEditing = (item: MenuItem) => { setEditingItemId(item.id); setEditQty(1); setEditNotes(''); };
  const cancelEditing = (e?: React.MouseEvent) => { if(e) e.stopPropagation(); setEditingItemId(null); setEditQty(1); setEditNotes(''); };
  const confirmItem = (item: MenuItem) => {
      setCart(prev => {
        const existingIndex = prev.findIndex(i => i.menuItem.id === item.id && i.notes === editNotes);
        if (existingIndex >= 0) { const newCart = [...prev]; newCart[existingIndex].quantity += editQty; return newCart; } 
        else return [...prev, { menuItem: item, quantity: editQty, notes: editNotes }];
      });
      setEditingItemId(null); setJustAddedId(item.id); setTimeout(() => setJustAddedId(null), 600); setCartBump(true); setTimeout(() => setCartBump(false), 300); if(tableManagerOpen) setTableManagerOpen(false);
  };

  const requestDelete = (index: number) => setDeleteConfirmIndex(index);
  const confirmDelete = () => { if (deleteConfirmIndex !== null) { const itemToRemove = sortedCart[deleteConfirmIndex]; setCart(prev => prev.filter(i => i !== itemToRemove)); setDeleteConfirmIndex(null); } };
  const editCartItem = (index: number) => { const itemToEdit = sortedCart[index]; setCart(prev => prev.filter(i => i !== itemToEdit)); setSelectedCategory(itemToEdit.menuItem.category); setEditingItemId(itemToEdit.menuItem.id); setEditQty(itemToEdit.quantity); setEditNotes(itemToEdit.notes || ''); setIsCartOpen(false); };

  const requestSendOrder = () => { if (!table || cart.length === 0) return; setSendConfirmOpen(true); };
  
  const handleSendOrder = () => {
    setSendConfirmOpen(false); 
    if (!table || cart.length === 0) return; 
    setIsSending(true);

    const currentOrderItems = [...cart]; // Copy for printing before clearing

    // Find ANY active order for this table
    const activeOrder = allRestaurantOrders.find(o => o.tableNumber === table);
    
    if (activeOrder) {
        updateOrderItems(activeOrder.id, cart);
    } else {
        addOrder({ id: Date.now().toString(), tableNumber: table, items: cart, status: OrderStatus.PENDING, timestamp: Date.now(), waiterName: waiterName || 'Cameriere', createdAt: Date.now() });
    }

    // NOTE: Department Printing is now handled by the Kitchen Display terminals automatically when they receive the order.
    // Cassa Printing is handled in handleFreeTable (End of Meal).
    
    setTimeout(() => { setCart([]); setIsSending(false); setIsCartOpen(false); setEditingOrderId(null); loadData(); setTable(''); }, 500);
  };

  const handleFreeTable = () => {
      if (table) {
          // 1. AGGREGATE ALL ITEMS FOR THE FINAL RECEIPT
          // Filter all restaurant orders to find those belonging to this table
          // Note: In a real DB scenario we might query specifically, here we use local cache state
          const tableOrders = allRestaurantOrders.filter(o => o.tableNumber === table);
          
          let allItems: OrderItem[] = [];
          tableOrders.forEach(o => {
              allItems = [...allItems, ...o.items];
          });

          // 2. PRINT CASSA RECEIPT (Total Bill)
          if (appSettings && appSettings.printEnabled && appSettings.printEnabled['Cassa']) {
                if (allItems.length > 0) {
                    const printContent = generateReceiptHtml(
                        allItems,
                        'Cassa / Totale',
                        table,
                        waiterName || 'Staff',
                        appSettings.restaurantProfile?.name || 'Ristorante',
                        menuItems // Pass full menu for resolution
                    );
                    
                    // Open print window - Browser will open "Save as PDF" if no printer connected
                    const printWindow = window.open('', `PRINT_CASSA_${Date.now()}`, 'height=600,width=400');
                    if (printWindow) {
                        printWindow.document.write(printContent);
                        printWindow.document.close();
                        // print() is called via onload in HTML
                    }
                }
          }

          // 3. FREE TABLE LOGIC
          freeTable(table);
          setTable('');
          setCart([]);
          setEditingOrderId(null);
          setFreeTableConfirmOpen(false);
          loadData();
      }
  };
  
  // UPDATED: handleServeItem now accepts subItemId for combo parts
  const handleServeItem = (orderId: string, itemIndex: number, subItemId?: string) => {
      serveItem(orderId, itemIndex, subItemId);
      // DO NOT CLOSE MODAL. Keep waiter in flow.
  };

  const proceedToOrder = () => {
    setTableManagerOpen(false);
  };

  const requestFreeTable = () => {
    setTableManagerOpen(false);
    setFreeTableConfirmOpen(true);
  };

  const handleSaveSettings = () => { saveTableCount(tempTableCount); setIsSettingTables(false); };
  const handleLogout = () => { logoutWaiter(); onExit(); };
  const handleAskAI = async () => { if (!aiQuery.trim()) return; setAiLoading(true); const response = await askChefAI(aiQuery, aiItem); setAiResponse(response); setAiLoading(false); };
  const openAiFor = (item: MenuItem | null) => { setAiItem(item); setAiQuery(''); setAiResponse(''); setAiModalOpen(true); };
  
  const handleOpenTableManager = () => {
      setTableManagerOpen(!tableManagerOpen);
      if (!tableManagerOpen) {
          // Taking vision of delays
          setLatesAcknowledged(true);
      }
  };

  const getCategoryIcon = (cat: Category, size: number = 18) => {
    switch (cat) { case Category.ANTIPASTI: return <UtensilsCrossed size={size} />; case Category.PANINI: return <Sandwich size={size} />; case Category.PIZZE: return <Pizza size={size} />; case Category.PRIMI: return <ChefHat size={size} />; case Category.SECONDI: return <Utensils size={size} />; case Category.DOLCI: return <CakeSlice size={size} />; case Category.BEVANDE: return <Wine size={size} />; default: return <Utensils size={size} />; }
  };
  
  const handleDictation = () => {
    if (isListening) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Dettatura non supportata."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setEditNotes(prev => prev ? `${prev} ${transcript}` : transcript);
        setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  // --- NEW: TOP EDITOR DATA ---
  const editingItemData = menuItems.find(i => i.id === editingItemId);
  
  // Late Flash Logic for Header Icon
  const shouldFlashLate = lateTables.length > 0 && !latesAcknowledged && !tableManagerOpen;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 max-w-md mx-auto shadow-2xl overflow-hidden relative border-x border-slate-800 font-sans selection:bg-orange-500 selection:text-white">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center"><ChefHat size={400} className="text-white opacity-[0.03] transform -rotate-12 translate-x-20 translate-y-10" /></div>
      {notificationToast && <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[60] bg-green-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-slide-down border-2 border-green-300 w-[90%] justify-center"><Bell className="animate-swing shrink-0" size={20} /><span className="font-bold text-sm truncate">{notificationToast}</span></div>}
      <style>{`@keyframes swipe-card { 0%, 100% { transform: translateX(0); } 20%, 30% { transform: translateX(50px); } 50% { transform: translateX(0); } 70%, 80% { transform: translateX(-50px); } } @keyframes swipe-bg { 0%, 100% { background-color: rgb(51, 65, 85); } 20%, 30% { background-color: rgb(249, 115, 22); } 50% { background-color: rgb(51, 65, 85); } 70%, 80% { background-color: rgb(220, 38, 38); } } @keyframes fade-edit { 0%, 50%, 100% { opacity: 0; transform: scale(0.9); } 20%, 30% { opacity: 1; transform: scale(1); } } @keyframes fade-delete { 0%, 50%, 100% { opacity: 0; transform: scale(0.9); } 70%, 80% { opacity: 1; transform: scale(1); } } @keyframes success-pop { 0% { transform: scale(1); box-shadow: 0 0 0 rgba(0,0,0,0); } 50% { transform: scale(1.03); box-shadow: 0 0 20px rgba(34, 197, 94, 0.4); border-color: rgba(34, 197, 94, 0.8); background-color: rgba(34, 197, 94, 0.1); } 100% { transform: scale(1); box-shadow: 0 0 0 rgba(0,0,0,0); } } @keyframes neon-pulse { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); border-color: rgba(34, 197, 94, 0.8); transform: scale(1); } 50% { box-shadow: 0 0 40px 15px rgba(34, 197, 94, 0.9), inset 0 0 20px rgba(34, 197, 94, 0.5); border-color: #ffffff; transform: scale(1.05); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); border-color: rgba(34, 197, 94, 0.8); transform: scale(1); } } @keyframes red-flash { 0%, 100% { background-color: rgb(51, 65, 85); border-color: rgb(51, 65, 85); } 50% { background-color: rgb(220, 38, 38); border-color: rgb(252, 165, 165); box-shadow: 0 0 15px rgba(220, 38, 38, 0.7); } } .animate-neon-pulse { animation: neon-pulse 1s infinite cubic-bezier(0.4, 0, 0.6, 1); } .animate-red-flash { animation: red-flash 0.8s infinite; } .animate-card-swipe { animation: swipe-card 2.5s ease-in-out; } .animate-bg-color { animation: swipe-bg 2.5s ease-in-out; } .animate-fade-edit { animation: fade-edit 2.5s ease-in-out; } .animate-fade-delete { animation: fade-delete 2.5s ease-in-out; } .animate-success-pop { animation: success-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); }`}</style>

      {/* --- HEADER --- */}
      <div className="bg-slate-900 pt-5 pb-2 px-5 z-40 flex justify-between items-center sticky top-0 border-b border-white/5 bg-opacity-95 backdrop-blur-sm shadow-md h-16 shrink-0">
        <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 border border-orange-400/30 transform -rotate-3"><Utensils size={18} className="text-white" /></div><div><h1 className="font-bold text-sm tracking-tight text-white leading-none mb-0.5">Risto<span className="text-orange-500">Sync</span></h1><p className="text-[10px] text-slate-400 font-medium">Ciao, {waiterName || 'Staff'}</p></div></div>
        <div className="flex items-center gap-3">
             <button onClick={() => setProfileOpen(true)} className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all active:scale-95"><User size={18} /></button>
            <button onClick={handleOpenTableManager} className={`flex items-center rounded-xl pl-4 pr-2 py-1.5 border-2 transition-all duration-300 transform group active:scale-95 relative ${shouldFlashLate ? 'animate-red-flash text-white' : !table ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-slate-900 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)] scale-105 ring-1 ring-green-500/20'} ${hasUnseenNotifications && !tableManagerOpen && !shouldFlashLate && 'animate-neon-pulse'}`}>
                <div className="flex flex-col items-end mr-3"><span className={`text-[10px] font-black uppercase tracking-wider leading-none ${!table ? 'text-slate-500' : 'text-white'} ${hasUnseenNotifications && !tableManagerOpen && !shouldFlashLate ? 'text-green-500' : ''} ${shouldFlashLate ? 'text-white' : ''}`}>TAVOLO</span>{table && <span className="font-black text-xl text-green-500 leading-none drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]">{table}</span>}</div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all relative ${!table && !shouldFlashLate ? 'bg-slate-700 text-slate-400' : shouldFlashLate ? 'bg-white/20 text-white' : 'bg-green-500 text-white shadow-lg'} ${hasUnseenNotifications && !tableManagerOpen && !shouldFlashLate ? 'bg-green-500 text-white' : ''}`}>
                    {shouldFlashLate ? <AlertOctagon size={20}/> : <LayoutGrid size={20} className={!table && !hasUnseenNotifications ? "opacity-50" : ""} />}
                </div>
            </button>
        </div>
      </div>

      {/* --- QUICK INPUT PANEL (TOP FIXED) --- */}
      {editingItemData && (
          <div className="fixed top-[64px] left-0 right-0 z-50 bg-slate-800/95 backdrop-blur-md border-b border-orange-500/30 shadow-2xl p-4 animate-slide-down">
              <div className="max-w-md mx-auto">
                <h3 className="font-black text-white text-lg mb-3 text-center flex items-center justify-center gap-2">
                    <span className="text-orange-500">{editingItemData.category}</span>
                    <span className="opacity-50">•</span>
                    {editingItemData.name}
                </h3>
                
                <div className="flex items-center justify-between mb-4 bg-slate-900/50 p-2 rounded-xl border border-slate-700">
                      <div className="flex items-center gap-3 flex-1">
                          <button onClick={() => setEditQty(Math.max(1, editQty - 1))} className="w-12 h-12 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg shadow-sm text-white active:scale-95 transition-all"><Minus size={20} /></button>
                          <span className="font-black text-white w-10 text-center text-3xl">{editQty}</span>
                          <button onClick={() => setEditQty(editQty + 1)} className="w-12 h-12 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg shadow-sm text-white active:scale-95 transition-all"><Plus size={20} /></button>
                      </div>
                      <div className="h-10 w-px bg-slate-700 mx-3"></div>
                      <div className="flex-1 relative">
                          <input type="text" value={editNotes} onChange={(e) => setEditNotes(capitalize(e.target.value))} placeholder="Note..." className="w-full bg-transparent border-none text-white text-base focus:ring-0 placeholder-slate-500 pr-8" />
                          <button onClick={handleDictation} className={`absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-full ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-white'}`}>
                              {isListening ? <MicOff size={18}/> : <Mic size={18}/>}
                          </button>
                      </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={cancelEditing} className="flex-1 py-4 rounded-xl bg-slate-700 text-slate-300 font-bold text-sm hover:bg-slate-600 transition-colors">ANNULLA</button>
                    <button onClick={() => confirmItem(editingItemData)} className="flex-[2] py-4 rounded-xl bg-orange-500 text-white font-bold text-lg hover:bg-orange-600 shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 active:scale-95 transition-transform"><Check size={24} /> AGGIUNGI</button>
                </div>
                <div className="mt-3 text-center"><button onClick={() => openAiFor(editingItemData)} className="text-indigo-400 text-[10px] font-bold uppercase tracking-wide flex items-center justify-center gap-1 hover:text-white"><Bot size={12}/> Info AI</button></div>
              </div>
          </div>
      )}

      {/* --- CATEGORY BAR (FIXED) --- */}
      <div className="z-30 pt-2 pb-2 bg-slate-900 border-b border-white/5 shrink-0">
        <div className="flex px-4 gap-3 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory">
            {Object.values(Category).map(cat => {
                const isActive = selectedCategory === cat;
                return <button key={cat} onClick={() => setSelectedCategory(cat)} className={`flex flex-row items-center justify-center gap-2 py-3 px-5 rounded-lg transition-all duration-300 snap-center shrink-0 border ${isActive ? 'bg-orange-500 border-orange-400 text-white shadow-lg shadow-orange-500/25 font-bold' : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}><span className={`transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>{getCategoryIcon(cat)}</span><span className="text-xs uppercase tracking-wide">{cat}</span></button>;
            })}
        </div>
      </div>

      {/* --- MENU GRID (SCROLLABLE) --- */}
      <div className={`flex-1 overflow-y-auto pb-48 relative scroll-smooth touch-pan-y transition-all ${editingItemId ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
          <div className="px-3 pt-4 grid grid-cols-2 gap-3 pb-32">
              {menuItems.filter(i => i.category === selectedCategory).map(item => {
                  const isPopping = justAddedId === item.id;
                  return (
                    <button key={item.id} onClick={() => startEditing(item)} className={`group relative overflow-hidden transition-all duration-300 rounded-2xl border flex flex-col items-center justify-center text-center ${isPopping ? 'animate-success-pop bg-slate-700 border-green-500 aspect-square' : 'bg-gradient-to-br from-gray-700 to-gray-800 border-gray-600 shadow-lg active:scale-95 p-2 aspect-square'}`}>
                        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">{getCategoryIcon(item.category, 80)}</div>
                        <div className="w-full relative z-10">
                            <h3 className="font-extrabold bg-gradient-to-b from-slate-50 to-slate-400 bg-clip-text text-transparent text-lg md:text-xl leading-tight tracking-tight drop-shadow-md break-words w-full px-2">{item.name}</h3>
                        </div>
                    </button>
                  );
              })}
          </div>
        <button onClick={() => openAiFor(null)} className={`fixed right-5 w-14 h-14 bg-indigo-600 border border-indigo-400 text-white rounded-full shadow-[0_8px_30px_rgba(79,70,229,0.4)] flex items-center justify-center z-20 transition-all duration-500 hover:scale-110 hover:shadow-indigo-500/60`} style={{ bottom: isCartOpen ? '90vh' : '110px' }}><Bot size={28} /></button>
      </div>

      {/* --- FIXED BOTTOM DOCK & FULL CART --- */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 bg-slate-800 border-t border-slate-700 transition-all duration-300 ease-out shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)] flex flex-col ${isCartOpen ? 'top-20 bottom-0 h-auto rounded-t-3xl border-t-white/10' : 'h-[90px]'}`}>
          
          {/* HEADER / TOGGLE BAR (TALLER SHOULDER) */}
          <div onClick={toggleCart} className={`h-[90px] min-h-[90px] flex items-center justify-between px-6 cursor-pointer active:bg-slate-700/50 transition-colors ${isCartOpen ? 'border-b border-white/5' : ''}`}>
              <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 bg-slate-700 rounded-full flex items-center justify-center text-white font-bold relative transition-transform duration-300 ${cartBump ? 'scale-125 bg-orange-500 text-white ring-2 ring-orange-300' : ''}`}>
                      <ShoppingBag size={26} />
                      {totalItems > 0 && <span className="absolute -top-1 -right-1 bg-orange-500 text-[10px] w-6 h-6 rounded-full flex items-center justify-center border-2 border-slate-800 shadow-md">{totalItems}</span>}
                  </div>
                  <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{editingOrderId ? 'MODIFICA ORDINE' : 'NUOVO ORDINE'}</p>
                      <div className="flex items-center gap-2">
                          <span className="text-xl font-black text-white">TAVOLO</span>
                          <span className="text-3xl font-black text-orange-500">{table || '?'}</span>
                      </div>
                  </div>
              </div>
              <div className="bg-slate-700 p-3 rounded-full text-slate-300 shadow-lg">
                  {isCartOpen ? <ChevronDown size={28}/> : <ChevronUp size={28}/>}
              </div>
          </div>

          {/* EXPANDED CONTENT */}
          {isCartOpen && (
              <div className="flex flex-col flex-1 overflow-hidden bg-slate-900/95 backdrop-blur-xl">
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-4 custom-scroll">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-4">
                                <ShoppingBag size={64} className="opacity-20" />
                                <p className="font-bold text-lg">Il carrello è vuoto</p>
                                <button onClick={() => setIsCartOpen(false)} className="bg-slate-700 text-white px-8 py-3 rounded-xl text-base font-bold shadow-lg">Aggiungi Piatti</button>
                            </div>
                        ) : (
                            <>
                                <p className="text-xs text-center text-slate-500 mb-2 uppercase tracking-wider">← Scorri per Eliminare • Modificare →</p>
                                {sortedCart.map((item, index) => <SwipeableCartItem key={index} index={index} item={item} onEdit={() => editCartItem(index)} onDelete={() => requestDelete(index)} isFirst={index === 0} appSettings={appSettings} isAddition={!!editingOrderId} />)}
                            </>
                        )}
                  </div>
                  <div className="p-4 bg-slate-800 border-t border-slate-700 pb-8 shrink-0">
                       <button onClick={requestSendOrder} disabled={!table || isSending || cart.length === 0} className={`w-full py-5 h-20 rounded-2xl font-black text-2xl tracking-wide flex items-center justify-center gap-3 shadow-xl transition-all relative overflow-hidden active:scale-95 ${(!table || isSending || cart.length === 0) ? 'bg-slate-700 text-slate-500 cursor-not-allowed shadow-none border border-slate-600' : editingOrderId ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/20' : 'bg-orange-500 text-white hover:bg-orange-600 shadow-orange-500/20'}`}>
                            {isSending ? <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-white"></div> : <><Send size={28}/> {editingOrderId ? 'AGGIORNA' : 'INVIA IN CUCINA'}</>}
                            {!table && !isSending && <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-sm text-red-400 font-bold uppercase backdrop-blur-sm border-2 border-red-500/20 rounded-2xl">SELEZIONA PRIMA UN TAVOLO</div>}
                       </button>
                  </div>
              </div>
          )}
      </div>

      {tableManagerOpen && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-700 flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-6">
                      {!isSettingTables ? (<div><h2 className="text-2xl font-bold text-white">Mappa Tavoli</h2>{table ? <p className="text-orange-400 text-sm font-bold">Selezionato: TAVOLO {table}</p> : <p className="text-slate-400 text-sm">Seleziona un tavolo</p>}</div>) : (<div><h2 className="text-xl font-bold text-white">Impostazioni</h2><p className="text-slate-400 text-sm">Numero tavoli sala</p></div>)}
                      <div className="flex gap-2">
                        {!isSettingTables && <button onClick={() => { setIsSettingTables(true); setTempTableCount(totalTables); }} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><Settings size={20} /></button>}
                        <button onClick={() => { setTableManagerOpen(false); setIsSettingTables(false); setTable(''); setCart([]); setEditingOrderId(null); }} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><X size={20} /></button>
                      </div>
                  </div>
                  {isSettingTables ? (
                      <div className="flex flex-col items-center justify-center flex-1 py-10">
                          <div className="flex items-center gap-4 mb-8"><button onClick={() => setTempTableCount(Math.max(1, tempTableCount - 1))} className="p-4 bg-slate-800 rounded-xl text-white active:scale-95"><Minus/></button><span className="text-6xl font-black text-orange-500 font-mono">{tempTableCount}</span><button onClick={() => setTempTableCount(Math.min(50, tempTableCount + 1))} className="p-4 bg-slate-800 rounded-xl text-white active:scale-95"><Plus/></button></div>
                          <button onClick={handleSaveSettings} className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Save size={20}/> SALVA CONFIGURAZIONE</button>
                      </div>
                  ) : (
                    <>
                        <div className="grid grid-cols-3 gap-3 overflow-y-auto p-1 custom-scroll mb-4 flex-1">
                            {Array.from({ length: totalTables }, (_, i) => (i + 1).toString()).map(tId => {
                                const info = getTableStatusInfo(tId);
                                const isSelected = table === tId;
                                const isLocked = info.owner && info.owner !== waiterName; 
                                
                                // Base Status Styling (Logic priority: Locked > Ready > Late > Eating > Occupied > Free)
                                let bgClass = 'bg-slate-800 border-slate-700 text-slate-400';
                                let statusText = 'LIBERO';
                                let badge = null;

                                if (isLocked) { 
                                    bgClass = 'bg-slate-900 border-slate-800 text-slate-600 opacity-70 cursor-not-allowed'; 
                                    statusText = 'BLOCCATO'; 
                                } 
                                else if (info.status === 'ready') { 
                                    bgClass = 'bg-green-600/20 border-green-500 text-green-400 animate-pulse'; 
                                    statusText = 'SERVIMI';
                                    badge = <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md bg-green-600 border border-green-400 animate-bounce">{info.count}</div>;
                                }
                                else if (info.status === 'eating') { 
                                    bgClass = 'bg-orange-600 border-orange-400 text-white shadow-[0_0_20px_rgba(249,115,22,0.8)] animate-pulse'; 
                                    statusText = 'IN ATTESA'; 
                                }
                                else if (info.status === 'late') { 
                                    bgClass = 'bg-red-900/40 border-red-500 text-red-100 shadow-[0_0_20px_rgba(220,38,38,0.6)] animate-pulse'; 
                                    statusText = 'RITARDO'; 
                                }
                                else if (info.status === 'occupied') { 
                                    bgClass = 'bg-orange-900/40 border-orange-500 text-orange-100 shadow-[0_0_15px_rgba(249,115,22,0.5)]'; 
                                    statusText = 'OCCUPATO'; 
                                }

                                // Selection Styling (Overlay)
                                if (isSelected && !isLocked) {
                                    // Add a strong border to indicate selection without overriding the status color
                                    bgClass += ' ring-4 ring-white shadow-xl scale-[1.02] z-10'; 
                                }

                                return (
                                    <button key={tId} onClick={() => !isLocked && handleSelectTable(tId)} disabled={!!isLocked} className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center relative transition-all active:scale-95 ${bgClass}`}>
                                        {isLocked ? (<><Lock size={20} className="mb-1"/><span className="text-xl font-black text-slate-500">{tId}</span><div className="absolute bottom-2 text-[8px] uppercase font-bold bg-slate-800 px-2 py-0.5 rounded text-slate-400 max-w-[90%] truncate">{info.owner}</div></>) : (
                                            <>
                                                <span className="text-2xl font-black">{tId}</span>
                                                <span className="text-[9px] uppercase font-bold mt-1 leading-none text-center px-1">{statusText}</span>
                                                {badge}
                                                {info.delay > 0 && <div className="absolute bottom-1 right-1 bg-black/50 px-1 rounded text-[8px] font-mono text-white">+{info.delay}m</div>}
                                            </>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        {table && (
                            <div className="flex flex-col gap-3 mt-2">
                                {/* ACTIVE ORDER LIST - SERVE ACTIONS */}
                                <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden max-h-40 overflow-y-auto">
                                   {existingOrders.length > 0 ? (
                                       <div className="p-3">
                                           <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 sticky top-0 bg-slate-800/95 backdrop-blur-sm z-10 py-1">In Corso</h4>
                                           <div className="space-y-2">
                                                {existingOrders[0].items.map((item, idx) => {
                                                    const isServed = item.served;
                                                    const isAddition = item.isAddedLater;
                                                    
                                                    // --- COMBO LOGIC FOR WAITER (EXPLOSION) ---
                                                    if (item.menuItem.category === Category.MENU_COMPLETO) {
                                                        const subItems = getSubItemsForCombo(item);
                                                        
                                                        return (
                                                            <div key={idx} className="border border-slate-700 rounded-xl bg-slate-900/50 overflow-hidden">
                                                                <div className="bg-slate-800 px-3 py-2 flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <ListPlus size={12} className="text-pink-500"/>
                                                                        <span className="text-xs font-bold text-white">{item.quantity}x {item.menuItem.name}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="p-2 space-y-2">
                                                                    {subItems.map(sub => {
                                                                        // Check if this specific part is done/ready
                                                                        // 1. If it's a Sala item (Drink), it's auto-ready (unless specifically not, but logic says yes)
                                                                        // 2. If it's kitchen, check completedParts
                                                                        const isSala = appSettings.categoryDestinations[sub.category] === 'Sala';
                                                                        
                                                                        // A sub-item is READY if:
                                                                        // - It's a Sala item (Auto-ready)
                                                                        // - OR it's in the completedParts array (Kitchen finished it)
                                                                        const isReady = isSala || item.comboCompletedParts?.includes(sub.id);
                                                                        
                                                                        // A sub-item is SERVED if it's in the servedParts array
                                                                        const isSubServed = item.comboServedParts?.includes(sub.id);

                                                                        return (
                                                                            <div key={sub.id} className={`flex justify-between items-center pl-2 pr-1 py-1 rounded-lg ${isSubServed ? 'opacity-50' : ''}`}>
                                                                                <div className="flex items-center gap-2">
                                                                                    <CornerDownRight size={10} className="text-slate-500"/>
                                                                                    <span className={`text-xs ${isSubServed ? 'line-through text-slate-500' : 'text-slate-300'}`}>{sub.name}</span>
                                                                                </div>
                                                                                
                                                                                {isSubServed ? (
                                                                                    <CheckCircle size={14} className="text-slate-600"/>
                                                                                ) : isReady ? (
                                                                                    <button onClick={() => handleServeItem(existingOrders[0].id, idx, sub.id)} className="bg-green-600 hover:bg-green-500 text-white text-[8px] font-bold uppercase px-2 py-1 rounded shadow-lg active:scale-95 animate-pulse">SERVI</button>
                                                                                ) : (
                                                                                    <span className="text-[8px] font-bold text-orange-500 uppercase tracking-wide">In Prep.</span>
                                                                                )}
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )
                                                    }

                                                    // --- STANDARD ITEM LOGIC ---
                                                    const isReady = item.completed && !item.served;
                                                    
                                                    // Show served items dimmed to indicate progress
                                                    return (
                                                        <div key={idx} className={`flex justify-between items-center p-2 rounded-xl border ${isServed ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-900 border-slate-700'}`}>
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text-sm font-bold ${isServed ? 'text-slate-500 line-through' : 'text-white'}`}>{item.quantity}x {item.menuItem.name}</span>
                                                                    {isAddition && <span className="text-[8px] bg-blue-600 text-white px-1 py-0.5 rounded font-bold uppercase flex items-center gap-1 shadow-sm"><PlusCircle size={8}/> AGGIUNTA</span>}
                                                                </div>
                                                                <span className={`text-[9px] uppercase font-bold ${isServed ? 'text-slate-600' : isReady ? 'text-green-400' : 'text-slate-500'}`}>{isServed ? 'SERVITO' : isReady ? 'PRONTO' : 'IN PREPARAZIONE'}</span>
                                                            </div>
                                                            {isReady ? (
                                                                <button onClick={() => handleServeItem(existingOrders[0].id, idx)} className="bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold uppercase px-3 py-2 rounded-lg shadow-lg shadow-green-600/20 flex items-center gap-1 animate-pulse active:scale-95"><CheckCircle size={12}/> SERVIRE</button>
                                                            ) : isServed ? (
                                                                <div className="w-8 h-8 flex items-center justify-center text-slate-700"><CheckCircle size={16}/></div>
                                                            ) : (
                                                                <div className="w-8 h-8 flex items-center justify-center text-slate-600"><Clock size={16}/></div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                                {existingOrders[0].items.every(i => i.served) && <p className="text-center text-xs text-orange-400 font-bold uppercase py-2 animate-pulse">Tutti i piatti sono serviti!</p>}
                                           </div>
                                       </div>
                                   ) : (
                                       <div className="p-4 text-center text-xs text-slate-500">Nessuna comanda attiva</div>
                                   )}
                                </div>

                                <div className="flex gap-2">
                                    <button onClick={proceedToOrder} className="flex-[2] py-4 rounded-2xl font-black text-base tracking-wide text-white shadow-xl bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 transition-transform flex flex-col items-center justify-center gap-1 hover:scale-[1.02] shadow-blue-900/30"><Utensils size={24}/><span>AGGIUNGI ORDINE</span></button>
                                    <button onClick={requestFreeTable} className="flex-1 bg-orange-500 border-2 border-orange-400 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:bg-orange-600 transition-all flex flex-col items-center justify-center gap-2 hover:scale-[1.02]">
                                        <DoorOpen size={20} className="mb-1" />
                                        <span className="text-[10px] leading-tight">Sì, Libera</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                  )}
              </div>
          </div>
      )}

      {profileOpen && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-xs shadow-2xl animate-slide-up">
                  <div className="flex flex-col items-center text-center mb-6"><div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500 text-blue-500 mb-3"><User size={32} /></div><h3 className="text-xl font-bold text-white">Profilo Sala</h3><p className="text-slate-400 text-sm mt-1">Stai operando come <span className="text-white font-bold">{waiterName}</span></p></div>
                  <div className="space-y-3">
                      <button onClick={onExit} className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 border border-slate-700"><Home size={18} /> Torna alla Dashboard</button>
                      <button onClick={handleLogout} className="w-full py-3 rounded-xl bg-slate-800 text-red-400 font-bold text-sm hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 border border-slate-700"><LogOut size={18} /> Logout / Cambia Utente</button>
                      <button onClick={() => setProfileOpen(false)} className="w-full py-3 rounded-xl bg-slate-700 text-white font-bold text-sm hover:bg-slate-600 transition-colors">Chiudi</button>
                  </div>
              </div>
          </div>
      )}

       {deleteConfirmIndex !== null && <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in"><div className="bg-slate-900 border border-red-500/30 rounded-3xl p-6 w-full max-w-xs shadow-2xl shadow-red-900/20 transform animate-slide-up"><div className="flex flex-col items-center text-center mb-4"><div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 text-red-500 border border-red-500/20"><Trash2 size={32} /></div><h3 className="text-xl font-bold text-white">Rimuovere piatto?</h3><p className="text-slate-400 text-sm mt-2">Vuoi eliminare <span className="text-white font-bold">{sortedCart[deleteConfirmIndex]?.menuItem.name}</span>?</p></div><div className="flex gap-3 mt-6"><button onClick={() => setDeleteConfirmIndex(null)} className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold text-sm hover:bg-slate-700 transition-colors">Annulla</button><button onClick={confirmDelete} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 shadow-lg shadow-red-600/30 transition-colors">Elimina</button></div></div></div>}
      {freeTableConfirmOpen && <div className="absolute inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in"><div className="bg-slate-900 border border-orange-500 rounded-3xl p-6 w-full max-w-xs shadow-2xl transform animate-slide-up shadow-orange-500/20"><div className="flex flex-col items-center text-center mb-4"><div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mb-4 text-white shadow-lg"><DoorOpen size={32} /></div><h3 className="text-xl font-bold text-white">Liberare il Tavolo {table}?</h3><p className="text-slate-400 text-sm mt-2">Confermi che il tavolo è libero? La comanda verrà archiviata e il tavolo tornerà disponibile.</p></div><div className="flex gap-3 mt-6"><button onClick={() => setFreeTableConfirmOpen(false)} className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold text-sm hover:bg-slate-700 transition-colors">Annulla</button><button onClick={handleFreeTable} className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 shadow-lg transition-colors">CONFERMA LIBERA</button></div></div></div>}
      {sendConfirmOpen && <div className="absolute inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in"><div className={`bg-slate-900 border rounded-3xl p-6 w-full max-w-xs shadow-2xl transform animate-slide-up ${editingOrderId ? 'border-blue-500/30 shadow-blue-900/20' : 'border-orange-500/30 shadow-orange-900/20'}`}><div className="flex flex-col items-center text-center mb-4"><div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 border ${editingOrderId ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-orange-500/10 text-orange-500 border-orange-500/20'}`}><Send size={32} /></div><h3 className="text-xl font-bold text-white">{editingOrderId ? 'Aggiornare comanda?' : 'Inviare comanda?'}</h3><p className="text-slate-400 text-sm mt-2">Confermi l'invio dell'ordine per il <span className="text-white font-bold">Tavolo {table}</span>?</p></div><div className="flex gap-3 mt-6"><button onClick={() => setSendConfirmOpen(false)} className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold text-sm hover:bg-slate-700 transition-colors">Annulla</button><button onClick={handleSendOrder} className={`flex-1 py-3 rounded-xl text-white font-bold text-sm shadow-lg transition-colors ${editingOrderId ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-600/30'}`}>{editingOrderId ? 'AGGIORNA' : 'INVIA'}</button></div></div></div>}
      {aiModalOpen && <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-4"><div className="bg-slate-900 w-full rounded-3xl p-5 shadow-2xl flex flex-col animate-slide-up border border-slate-700 relative overflow-hidden"><div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/20 blur-3xl rounded-full pointer-events-none"></div><div className="flex justify-between items-center mb-4 z-10"><div className="flex items-center gap-2 text-orange-400"><Bot size={20} /><h2 className="font-bold text-base tracking-wide">AI Chef Assistant</h2></div><button onClick={() => setAiModalOpen(false)} className="bg-slate-800 p-2 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white"><X size={16} /></button></div><div className="flex-1 overflow-y-auto mb-4 bg-slate-800 rounded-2xl p-4 min-h-[120px] shadow-inner border border-slate-700 z-10">{aiItem && <div className="mb-3 pb-3 border-b border-slate-700 text-xs text-orange-400 font-medium flex items-center gap-2"><div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>Contesto: <span className="font-bold text-white">{aiItem.name}</span></div>}{aiResponse ? <p className="text-slate-300 leading-relaxed text-sm animate-fade-in">{aiResponse}</p> : <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2 mt-2"><p className="italic text-center text-xs">"Chiedimi se questo piatto è senza glutine..."</p></div>}{aiLoading && <div className="flex justify-center gap-1 mt-4"><div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce delay-75"></div><div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce delay-150"></div></div>}</div><div className="flex gap-2 z-10"><input type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder="Domanda..." className="flex-1 bg-slate-800 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500/50 focus:bg-slate-800 text-sm text-white placeholder-slate-500 transition-all" onKeyDown={(e) => e.key === 'Enter' && handleAskAI()} /><button onClick={handleAskAI} disabled={aiLoading || !aiQuery} className="bg-orange-500 text-white w-12 rounded-xl hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center shadow-lg shadow-orange-600/20 transition-all"><Send size={18} /></button></div></div></div>}
    </div>
  );
};

export default WaiterPad;