import React, { useState, useEffect, useRef } from 'react';
import { Category, MenuItem, Order, OrderItem, OrderStatus } from '../types';
import { addOrder, getOrders, getTableCount, saveTableCount, updateOrderItems, getWaiterName, logoutWaiter, getMenuItems, freeTable } from '../services/storageService';
import { askChefAI } from '../services/geminiService';
import { ShoppingBag, Send, X, Plus, Minus, Bot, History, Clock, ChevronUp, ChevronDown, Trash2, Search, Utensils, ChefHat, Pizza, CakeSlice, Wine, Edit2, Check, AlertTriangle, Info, LayoutGrid, Users, Settings, Save, User, LogOut, Home, Wheat, Milk, Egg, Nut, Fish, Bean, Flame, Leaf, DoorOpen, Bell, ArrowRight } from 'lucide-react';

// --- CONSTANTS ---
const CATEGORY_ORDER = [
    Category.ANTIPASTI,
    Category.PRIMI,
    Category.SECONDI,
    Category.DOLCI,
    Category.BEVANDE
];

// Helper to get icon for allergen
const getAllergenIcon = (id: string) => {
    switch (id) {
        case 'Glutine': return <Wheat size={10} />;
        case 'Latticini': return <Milk size={10} />;
        case 'Uova': return <Egg size={10} />;
        case 'Frutta a guscio': return <Nut size={10} />;
        case 'Pesce': return <Fish size={10} />;
        case 'Soia': return <Bean size={10} />;
        case 'Piccante': return <Flame size={10} className="text-orange-500" />;
        case 'Vegano': return <Leaf size={10} className="text-green-500" />;
        default: return null;
    }
};

const capitalize = (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

// --- SOUND UTILS ---
const playWaiterNotification = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        // High pitched double beep for "Attention/Ready"
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc.frequency.setValueAtTime(1760, ctx.currentTime + 0.1); // A6
        
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
        console.error("Audio error", e);
    }
};

// --- SUB-COMPONENT: Swipeable Cart Item ---
interface SwipeableItemProps {
    item: OrderItem;
    index: number;
    onEdit: () => void;
    onDelete: () => void;
    isFirst: boolean;
}

const SwipeableCartItem: React.FC<SwipeableItemProps> = ({ item, index, onEdit, onDelete, isFirst }) => {
    const [offsetX, setOffsetX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startX = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    // Threshold to trigger action (Reduced for compact feel)
    const THRESHOLD = 60;

    const handleTouchStart = (e: React.TouchEvent) => {
        setHasInteracted(true);
        setIsAnimating(false); // Stop animation immediately on touch
        setIsDragging(true);
        startX.current = e.touches[0].clientX;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        const currentX = e.touches[0].clientX;
        const diff = currentX - startX.current;
        
        // Limit sliding range visually (-150px to 150px)
        if (diff > -150 && diff < 150) {
            setOffsetX(diff);
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        
        if (offsetX > THRESHOLD) {
            // Swipe Right -> Edit
            onEdit();
            setOffsetX(0); 
        } else if (offsetX < -THRESHOLD) {
            // Swipe Left -> Delete
            onDelete();
            setOffsetX(0);
        } else {
            // Snap back
            setOffsetX(0);
        }
    };

    useEffect(() => {
        if (!isFirst || hasInteracted) return;

        // Start animation loop
        const interval = setInterval(() => {
            if (!hasInteracted) {
                setIsAnimating(true);
                // Animation duration is 2.5s, stop "isAnimating" state after
                setTimeout(() => {
                    if (!hasInteracted) setIsAnimating(false);
                }, 2500); 
            }
        }, 6000); // Repeat every 6 seconds

        // Initial delay
        const initialTimeout = setTimeout(() => {
             if (!hasInteracted) {
                setIsAnimating(true);
                setTimeout(() => setIsAnimating(false), 2500);
            }
        }, 1000);

        return () => {
            clearInterval(interval);
            clearTimeout(initialTimeout);
        };
    }, [isFirst, hasInteracted]);

    // Determine background color based on drag direction OR animation state
    const getBgColor = () => {
        if (isAnimating) return 'animate-bg-color'; // Handled by CSS animation
        if (offsetX > 20) return 'bg-orange-500'; // Edit
        if (offsetX < -20) return 'bg-red-600';    // Delete
        return 'bg-slate-700';
    };

    return (
        <div 
            className={`relative h-[72px] rounded-2xl overflow-hidden mb-2 select-none transition-colors duration-200 touch-pan-y ${getBgColor()}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Background Actions Layer */}
            <div className="absolute inset-0 flex justify-between items-center px-5 text-white font-black">
                {/* Left Action (Reveal on swipe Right - EDIT) */}
                <div className={`flex items-center gap-2 transition-all duration-300 ${isAnimating ? 'animate-fade-edit' : (offsetX > 30 ? 'opacity-100 scale-100' : 'opacity-0 scale-90')}`}>
                    <Edit2 size={22} /> 
                    <span className="text-xs uppercase tracking-widest">Modifica</span>
                </div>

                {/* Right Action (Reveal on swipe Left - DELETE) */}
                <div className={`flex items-center gap-2 transition-all duration-300 ${isAnimating ? 'animate-fade-delete' : (offsetX < -30 ? 'opacity-100 scale-100' : 'opacity-0 scale-90')}`}>
                    <span className="text-xs uppercase tracking-widest">Elimina</span>
                    <Trash2 size={22} />
                </div>
            </div>

            {/* Foreground Content Layer */}
            <div 
                ref={containerRef}
                className={`absolute inset-0 bg-slate-800 px-4 flex flex-col justify-center border border-slate-700 shadow-md ${isAnimating ? 'animate-card-swipe' : ''}`}
                style={{ 
                    transform: isAnimating ? undefined : `translateX(${offsetX}px)`,
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
                }}
            >
                 <div className="flex justify-between items-center">
                    <div className="flex gap-3 items-center w-full">
                        <span className="bg-slate-700 text-slate-200 font-bold w-8 h-8 flex items-center justify-center rounded-lg text-sm shadow-inner shrink-0">
                            {item.quantity}
                        </span>
                        <div className="flex-1 min-w-0">
                            <span className="font-bold text-white text-base block leading-tight truncate">{item.menuItem.name}</span>
                            {item.notes && (
                                <p className="text-[10px] text-slate-400 mt-1 italic pl-2 border-l-2 border-slate-600 truncate">
                                    {item.notes}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Visual Hint Arrows (Only visible when stationary and first item) */}
            {offsetX === 0 && !hasInteracted && isFirst && !isAnimating && (
                <>
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-600/30 animate-pulse">
                        <ChevronDown className="rotate-90" size={12} />
                    </div>
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-600/30 animate-pulse">
                        <ChevronDown className="-rotate-90" size={12} />
                    </div>
                </>
            )}
        </div>
    );
};

interface WaiterPadProps {
    onExit: () => void;
}

const WaiterPad: React.FC<WaiterPadProps> = ({ onExit }) => {
  const [table, setTable] = useState<string>('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category>(Category.ANTIPASTI);
  const [isSending, setIsSending] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null); // Track if we are editing an existing order
  const [waiterName, setWaiterName] = useState<string>('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  
  // Sheet Drag State
  const [sheetHeight, setSheetHeight] = useState(80); // Default collapsed height in px
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const dragStartY = useRef(0);
  const startHeight = useRef(0);
  
  // Item Editing State (Inline)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editNotes, setEditNotes] = useState('');

  // Animation States
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [cartBump, setCartBump] = useState(false);

  // Confirmation States
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [freeTableConfirmOpen, setFreeTableConfirmOpen] = useState(false); // NEW: Free Table Modal

  // AI State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiItem, setAiItem] = useState<MenuItem | null>(null);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Table Management State
  const [tableManagerOpen, setTableManagerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [existingOrders, setExistingOrders] = useState<Order[]>([]);
  const [allRestaurantOrders, setAllRestaurantOrders] = useState<Order[]>([]);
  
  // Notification State
  const [readyCount, setReadyCount] = useState(0);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);
  const prevReadyOrderIdsRef = useRef<string[]>([]); // Track IDs to avoid duplicate alerts

  // Dynamic Table Count
  const [totalTables, setTotalTables] = useState(12);
  const [isSettingTables, setIsSettingTables] = useState(false);
  const [tempTableCount, setTempTableCount] = useState(12);

  // --- Listen for updates ---
  const loadData = () => {
      // Load orders
      const allOrders = getOrders();
      setAllRestaurantOrders(allOrders);
      
      const name = getWaiterName();
      if (name) setWaiterName(name);

      // --- NOTIFICATION LOGIC (Robust) ---
      const myReadyOrders = allOrders.filter(o => 
          o.status === OrderStatus.READY && 
          (!name || o.waiterName === name || !o.waiterName)
      );

      const currentReadyIds = myReadyOrders.map(o => o.id);
      const prevIds = prevReadyOrderIdsRef.current;
      
      // Detect ANY new ID that wasn't there before
      const hasNewReadyOrder = currentReadyIds.some(id => !prevIds.includes(id));

      if (hasNewReadyOrder && currentReadyIds.length > 0) {
          const newOrders = myReadyOrders.filter(o => !prevIds.includes(o.id));
          const tableNums = Array.from(new Set(newOrders.map(o => o.tableNumber))).join(', ');
          
          playWaiterNotification();
          setNotificationToast(`PIATTI PRONTI: Tavolo ${tableNums || '?'}`);
          setTimeout(() => setNotificationToast(null), 8000);
      }
      
      prevReadyOrderIdsRef.current = currentReadyIds;
      setReadyCount(myReadyOrders.length);

      if (table) {
          const tableOrders = allOrders
            .filter(o => o.tableNumber === table)
            .sort((a, b) => b.timestamp - a.timestamp); // Newest first
          setExistingOrders(tableOrders);
      } else {
          setExistingOrders([]);
      }

      setTotalTables(getTableCount());
      setMenuItems(getMenuItems());
  };

  useEffect(() => {
    loadData();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ristosync_orders' || e.key === 'ristosync_table_count' || e.key === 'ristosync_menu_items') loadData();
    };
    const handleLocalUpdate = () => loadData();
    const handleMenuUpdate = () => loadData();

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage-update', handleLocalUpdate);
    window.addEventListener('local-menu-update', handleMenuUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-update', handleLocalUpdate);
      window.removeEventListener('local-menu-update', handleMenuUpdate);
    };
  }, [table]); 

  // --- Sorting Logic for Cart ---
  const sortedCart = [...cart].sort((a, b) => {
      const idxA = CATEGORY_ORDER.indexOf(a.menuItem.category);
      const idxB = CATEGORY_ORDER.indexOf(b.menuItem.category);
      return idxA - idxB;
  });

  // --- Sheet Drag Logic ---
  const handleSheetTouchStart = (e: React.TouchEvent) => {
    setIsDraggingSheet(true);
    dragStartY.current = e.touches[0].clientY;
    startHeight.current = sheetHeight;
  };

  const handleSheetTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingSheet) return;
    const currentY = e.touches[0].clientY;
    const diff = dragStartY.current - currentY; 
    
    const newHeight = Math.max(80, Math.min(window.innerHeight * 0.9, startHeight.current + diff));
    setSheetHeight(newHeight);
  };

  const handleSheetTouchEnd = () => {
    setIsDraggingSheet(false);
    const threshold = window.innerHeight * 0.4;
    if (sheetHeight > threshold) {
        setSheetHeight(window.innerHeight * 0.85); 
    } else {
        setSheetHeight(80); 
    }
  };

  const toggleSheet = () => {
      if (sheetHeight > 200) {
          setSheetHeight(80);
      } else {
          setSheetHeight(window.innerHeight * 0.85);
      }
  };

  // --- Table Selection & Order Recovery ---
  const handleSelectTable = (tId: string) => {
      setTable(tId);
      
      // Check for active PENDING order for editing
      const pendingOrder = allRestaurantOrders.find(o => o.tableNumber === tId && o.status === OrderStatus.PENDING);
      
      if (pendingOrder) {
          // RECOVERY MODE: Load existing items into cart for editing
          setCart(pendingOrder.items);
          setEditingOrderId(pendingOrder.id);
      } else {
          // INTEGRATION MODE: Clean cart for new additions
          setCart([]);
          setEditingOrderId(null);
      }
      
      // NOTE: We do NOT close the table manager automatically anymore.
      // We allow the user to choose "ORDER" or "FREE TABLE" from the buttons.
  };

  // --- Item Selection Logic ---
  const startEditing = (item: MenuItem) => {
      setEditingItemId(item.id);
      setEditQty(1);
      setEditNotes('');
  };

  const cancelEditing = () => {
      setEditingItemId(null);
      setEditQty(1);
      setEditNotes('');
  };

  const confirmItem = (item: MenuItem) => {
      setCart(prev => {
        // If we have exact same item with same notes, merge quantity
        const existingIndex = prev.findIndex(i => i.menuItem.id === item.id && i.notes === editNotes);
        
        if (existingIndex >= 0) {
            const newCart = [...prev];
            newCart[existingIndex].quantity += editQty;
            return newCart;
        } else {
            return [...prev, { menuItem: item, quantity: editQty, notes: editNotes }];
        }
      });
      
      setEditingItemId(null);
      
      setJustAddedId(item.id);
      setTimeout(() => setJustAddedId(null), 600);
      setCartBump(true);
      setTimeout(() => setCartBump(false), 300);
      
      if(tableManagerOpen) setTableManagerOpen(false);
  };

  // --- Cart Management ---
  const requestDelete = (index: number) => {
      setDeleteConfirmIndex(index);
  };

  const confirmDelete = () => {
      if (deleteConfirmIndex !== null) {
          const itemToRemove = sortedCart[deleteConfirmIndex];
          setCart(prev => prev.filter(i => i !== itemToRemove));
          
          setDeleteConfirmIndex(null);
          if (cart.length <= 1) setSheetHeight(80);
      }
  };

  const editCartItem = (index: number) => {
     const itemToEdit = sortedCart[index];
     setCart(prev => prev.filter(i => i !== itemToEdit));
     if (cart.length <= 1) setSheetHeight(80);
     
     setSelectedCategory(itemToEdit.menuItem.category);
     setEditingItemId(itemToEdit.menuItem.id);
     setEditQty(itemToEdit.quantity);
     setEditNotes(itemToEdit.notes || '');
     setSheetHeight(80); 
  };

  // --- Submit Order ---
  const requestSendOrder = () => {
    if (!table || cart.length === 0) return;
    setSendConfirmOpen(true);
  };

  const handleSendOrder = () => {
    setSendConfirmOpen(false);

    if (!table || cart.length === 0) return;
    setIsSending(true);

    if (editingOrderId) {
        // UPDATE EXISTING ORDER
        updateOrderItems(editingOrderId, cart);
    } else {
        // CREATE NEW ORDER
        const newOrder: Order = {
            id: Date.now().toString(),
            tableNumber: table,
            items: cart,
            status: OrderStatus.PENDING,
            timestamp: Date.now(),
            waiterName: waiterName || 'Cameriere', 
        };
        addOrder(newOrder);
    }

    setTimeout(() => {
      setCart([]);
      setIsSending(false);
      setSheetHeight(80);
      setEditingOrderId(null);
      loadData(); 
      setTable('');
    }, 500);
  };

  // --- Table Actions (Free Table) ---
  const handleFreeTable = () => {
      if (table) {
          freeTable(table);
          setTable('');
          setCart([]);
          setEditingOrderId(null);
          setFreeTableConfirmOpen(false);
          loadData();
      }
  };

  // --- Settings Logic ---
  const handleSaveSettings = () => {
      saveTableCount(tempTableCount);
      setIsSettingTables(false);
  };
  
  const handleLogout = () => {
      logoutWaiter();
      onExit();
  };

  // --- AI & Helpers ---
  const handleAskAI = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    const response = await askChefAI(aiQuery, aiItem);
    setAiResponse(response);
    setAiLoading(false);
  };

  const openAiFor = (item: MenuItem | null) => {
    setAiItem(item);
    setAiQuery('');
    setAiResponse('');
    setAiModalOpen(true);
  };

  const getCategoryIcon = (cat: Category) => {
    switch (cat) {
        case Category.ANTIPASTI: return <Pizza size={18} />;
        case Category.PRIMI: return <ChefHat size={18} />;
        case Category.SECONDI: return <Utensils size={18} />;
        case Category.DOLCI: return <CakeSlice size={18} />;
        case Category.BEVANDE: return <Wine size={18} />;
        default: return <Utensils size={18} />;
    }
  };
  
  const getTableStatusInfo = (tableNum: string) => {
      const tableOrders = allRestaurantOrders.filter(o => o.tableNumber === tableNum);
      
      if (tableOrders.length === 0) return { status: 'free', count: 0 };
      
      const hasReady = tableOrders.some(o => o.status === OrderStatus.READY);
      const hasPending = tableOrders.some(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.COOKING);
      
      if (hasReady) return { status: 'ready', count: tableOrders.filter(o => o.status === OrderStatus.READY).length };
      if (hasPending) return { status: 'busy', count: tableOrders.length };
      
      return { status: 'eating', count: 0 };
  };

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 max-w-md mx-auto shadow-2xl overflow-hidden relative border-x border-slate-800 font-sans selection:bg-orange-500 selection:text-white">
      
      {/* Background Watermark */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center">
         <ChefHat size={400} className="text-white opacity-[0.03] transform -rotate-12 translate-x-20 translate-y-10" />
      </div>

      {/* NOTIFICATION TOAST */}
      {notificationToast && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[60] bg-orange-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-slide-down border-2 border-orange-300 w-[90%] justify-center">
              <Bell className="animate-swing shrink-0" size={20} />
              <span className="font-bold text-sm truncate">{notificationToast}</span>
          </div>
      )}

      <style>{`
        /* Card Movement */
        @keyframes swipe-card {
            0%, 100% { transform: translateX(0); }
            20%, 30% { transform: translateX(50px); } 
            50% { transform: translateX(0); }
            70%, 80% { transform: translateX(-50px); }
        }
        @keyframes swipe-bg {
            0%, 100% { background-color: rgb(51, 65, 85); }
            20%, 30% { background-color: rgb(249, 115, 22); }
            50% { background-color: rgb(51, 65, 85); }
            70%, 80% { background-color: rgb(220, 38, 38); }
        }
        @keyframes fade-edit {
            0%, 50%, 100% { opacity: 0; transform: scale(0.9); }
            20%, 30% { opacity: 1; transform: scale(1); }
        }
        @keyframes fade-delete {
            0%, 50%, 100% { opacity: 0; transform: scale(0.9); }
            70%, 80% { opacity: 1; transform: scale(1); }
        }
        @keyframes success-pop {
            0% { transform: scale(1); box-shadow: 0 0 0 rgba(0,0,0,0); }
            50% { transform: scale(1.03); box-shadow: 0 0 20px rgba(34, 197, 94, 0.4); border-color: rgba(34, 197, 94, 0.8); background-color: rgba(34, 197, 94, 0.1); }
            100% { transform: scale(1); box-shadow: 0 0 0 rgba(0,0,0,0); }
        }
        .animate-card-swipe { animation: swipe-card 2.5s ease-in-out; }
        .animate-bg-color { animation: swipe-bg 2.5s ease-in-out; }
        .animate-fade-edit { animation: fade-edit 2.5s ease-in-out; }
        .animate-fade-delete { animation: fade-delete 2.5s ease-in-out; }
        .animate-success-pop { animation: success-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
      `}</style>

      {/* --- HEADER --- */}
      <div className="bg-slate-900 pt-5 pb-2 px-5 z-40 flex justify-between items-center sticky top-0 border-b border-white/5 bg-opacity-95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 border border-orange-400/30 transform -rotate-3">
                <Utensils size={18} className="text-white" />
            </div>
            <div>
                <h1 className="font-bold text-sm tracking-tight text-white leading-none mb-0.5">
                    Risto<span className="text-orange-500">Sync</span>
                </h1>
                <p className="text-[10px] text-slate-400 font-medium">Ciao, {waiterName || 'Staff'}</p>
            </div>
        </div>
        
        <div className="flex items-center gap-3">
             {/* Profile/Exit Button */}
             <button 
                onClick={() => setProfileOpen(true)}
                className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all active:scale-95"
            >
                <User size={18} />
            </button>

            {/* Table Selector Toggle */}
            <button 
                onClick={() => setTableManagerOpen(!tableManagerOpen)}
                className={`flex items-center rounded-xl pl-4 pr-2 py-1.5 border-2 transition-all duration-300 transform group active:scale-95 relative
                    ${!table 
                        ? 'bg-slate-800 border-slate-700 hover:border-slate-600' 
                        : 'bg-slate-900 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.6)] scale-105 ring-1 ring-orange-500/20'
                    }`}
            >
                <div className="flex flex-col items-end mr-3">
                     <span className={`text-[10px] font-black uppercase tracking-wider leading-none ${!table ? 'text-slate-500' : 'text-white'}`}>TAVOLO</span>
                     {table && <span className="font-black text-xl text-orange-500 leading-none drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]">{table}</span>}
                </div>
                
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all relative ${!table ? 'bg-slate-700 text-slate-400' : 'bg-orange-500 text-white shadow-lg'}`}>
                    <LayoutGrid size={20} className={!table ? "opacity-50" : ""} />
                    
                    {readyCount > 0 && !tableManagerOpen && (
                        <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border border-slate-900 animate-bounce z-50">
                            {readyCount}
                        </div>
                    )}
                </div>
            </button>
        </div>
      </div>

      {/* --- MENU GRID --- */}
      <div className="flex-1 overflow-y-auto pb-48 relative scroll-smooth z-10 no-scrollbar touch-pan-y">
          
          <div className="sticky top-0 z-30 pt-2 pb-4 bg-gradient-to-b from-slate-900 via-slate-900/95 to-transparent">
            <div className="flex px-4 gap-3 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory">
                {Object.values(Category).map(cat => {
                    const isActive = selectedCategory === cat;
                    return (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`
                                flex flex-row items-center justify-center gap-2 py-3 px-5 rounded-lg transition-all duration-300 snap-center shrink-0 border
                                ${isActive 
                                    ? 'bg-orange-500 border-orange-400 text-white shadow-lg shadow-orange-500/25 font-bold' 
                                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}
                            `}
                        >
                            <span className={`transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>
                                {getCategoryIcon(cat)}
                            </span>
                            <span className="text-xs uppercase tracking-wide">{cat}</span>
                        </button>
                    );
                })}
            </div>
          </div>

          <div className="px-4 space-y-3 pt-1">
              {menuItems.filter(i => i.category === selectedCategory).map(item => {
                  const isEditing = editingItemId === item.id;
                  const isPopping = justAddedId === item.id;
                  
                  return (
                    <div 
                        key={item.id} 
                        className={`
                            group relative overflow-hidden transition-all duration-300 rounded-[1.5rem] border
                            ${isEditing 
                                ? 'bg-slate-800 border-orange-500/50 shadow-[0_0_30px_rgba(249,115,22,0.15)] ring-1 ring-orange-500/30' 
                                : isPopping
                                    ? 'animate-success-pop bg-slate-700 border-green-500'
                                    : 'bg-gradient-to-br from-slate-700/60 to-slate-800/60 border-white/10 shadow-xl'
                            }
                        `}
                    >
                      <div className="p-4">
                          <div className="flex justify-between items-start gap-4">
                              <div className="flex-1 z-10">
                                  <div className="flex items-center gap-2 mb-1">
                                      <h3 className="font-bold text-white text-base leading-tight tracking-tight shadow-black drop-shadow-md">{item.name}</h3>
                                  </div>
                                  {!isEditing && (
                                    <>
                                        <p className="text-slate-300 text-[10px] leading-relaxed mb-3 pr-2 line-clamp-2 font-medium">{item.description}</p>
                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex gap-1.5 flex-wrap opacity-70">
                                                {item.allergens?.map(algId => (
                                                    <div key={algId} className="bg-slate-800 p-1 rounded-full border border-slate-700 text-slate-400" title={algId}>
                                                        {getAllergenIcon(algId)}
                                                    </div>
                                                ))}
                                            </div>

                                            <button 
                                                onClick={(e) => { e.stopPropagation(); openAiFor(item); }} 
                                                className="bg-transparent text-slate-500 hover:text-orange-400 transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide"
                                            >
                                                INFO <Search size={10} strokeWidth={3} />
                                            </button>
                                        </div>
                                    </>
                                  )}
                              </div>
                              
                              {!isEditing && (
                                  <button
                                    onClick={() => startEditing(item)}
                                    className="flex-shrink-0 w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20 active:scale-95 transition-transform z-20 hover:bg-orange-400 mt-1"
                                  >
                                    <Plus size={20} strokeWidth={3} />
                                  </button>
                              )}
                          </div>

                          {isEditing && (
                              <div className="mt-3 bg-white rounded-xl p-3 animate-slide-up shadow-inner">
                                  <div className="flex items-center justify-between mb-3">
                                      <label className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Quantità</label>
                                      <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                                          <button onClick={() => setEditQty(Math.max(1, editQty - 1))} className="w-7 h-7 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 active:scale-95">
                                              <Minus size={14} />
                                          </button>
                                          <span className="font-bold text-slate-800 w-4 text-center text-base">{editQty}</span>
                                          <button onClick={() => setEditQty(editQty + 1)} className="w-7 h-7 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 active:scale-95">
                                              <Plus size={14} />
                                          </button>
                                      </div>
                                  </div>

                                  <div className="mb-3">
                                      <label className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1 block">Note Cucina</label>
                                      <input 
                                          type="text" 
                                          value={editNotes}
                                          onChange={(e) => setEditNotes(capitalize(e.target.value))}
                                          placeholder="Es. Ben cotto..."
                                          className="w-full bg-slate-100 border-none rounded-lg px-3 py-2 text-slate-800 text-xs focus:ring-2 focus:ring-orange-200 outline-none"
                                      />
                                  </div>

                                  <div className="flex gap-2">
                                      <button 
                                        onClick={cancelEditing}
                                        className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-50 transition-colors"
                                      >
                                          Annulla
                                      </button>
                                      <button 
                                        onClick={() => confirmItem(item)}
                                        className="flex-[2] py-2.5 rounded-lg bg-orange-500 text-white font-bold text-xs hover:bg-orange-600 shadow-md shadow-orange-200 flex items-center justify-center gap-2"
                                      >
                                          <Check size={16} /> Conferma
                                      </button>
                                  </div>
                              </div>
                          )}
                      </div>
                    </div>
                  );
              })}
          </div>

        <button 
            onClick={() => openAiFor(null)}
            className={`fixed right-5 w-12 h-12 bg-indigo-600 border border-indigo-400 text-white rounded-full shadow-[0_8px_30px_rgba(79,70,229,0.4)] flex items-center justify-center z-20 transition-all duration-500 hover:scale-110 hover:shadow-indigo-500/60`}
            style={{ bottom: sheetHeight + 20 }}
        >
            <Bot size={24} />
        </button>
      </div>

      {/* --- BOTTOM SHEET CART --- */}
      <div 
        className="absolute bottom-0 left-0 right-0 z-40 bg-slate-800 rounded-t-[2.5rem] shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)] border-t border-white/10 flex flex-col will-change-transform"
        style={{ 
            height: `${sheetHeight}px`,
            transition: isDraggingSheet ? 'none' : 'height 0.4s cubic-bezier(0.17, 0.67, 0.22, 1.26)'
        }}
      >
        <div 
            onTouchStart={handleSheetTouchStart}
            onTouchMove={handleSheetTouchMove}
            onTouchEnd={handleSheetTouchEnd}
            className={`flex-shrink-0 h-20 px-6 flex items-center justify-between relative rounded-t-[2.5rem] cursor-grab active:cursor-grabbing border-b border-white/5 touch-none
                ${editingOrderId ? 'bg-gradient-to-r from-blue-900/40 to-slate-800' : 'bg-gradient-to-b from-slate-800 to-slate-800/90'}
            `}
        >
            <div className="absolute top-3 left-1/2 transform -translate-x-1/2 w-12 h-1.5 bg-slate-600/50 rounded-full" />
            
            <div className="flex items-center gap-3 mt-1" onClick={(e) => e.stopPropagation()}>
                <div className={`transition-all duration-300 ${sheetHeight > 100 ? 'scale-0 w-0' : 'scale-100 w-12'}`}>
                     <div className={`w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-white font-bold relative transition-transform ${cartBump ? 'scale-125 bg-orange-500 text-white ring-2 ring-orange-300' : ''}`}>
                        <ShoppingBag size={18} />
                        {totalItems > 0 && <span className="absolute -top-1 -right-1 bg-orange-500 text-[10px] w-5 h-5 rounded-full flex items-center justify-center border border-slate-900">{totalItems}</span>}
                     </div>
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                         <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider leading-none">Ordine del</span>
                         {editingOrderId && <span className="text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-bold uppercase">Modifica</span>}
                    </div>
                    <div className="flex items-baseline gap-1">
                         <span className="font-bold text-white text-lg leading-none">TAVOLO</span>
                         <span className="font-black text-orange-500 text-xl leading-none">{table || '?'}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                 <button
                    onClick={requestSendOrder}
                    disabled={!table || cart.length === 0 || isSending}
                    className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all transform
                         ${(!table || cart.length === 0 || isSending) 
                            ? 'bg-slate-700/50 text-slate-600 cursor-not-allowed shadow-none' 
                            : editingOrderId ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-orange-500 text-white hover:bg-orange-600 hover:scale-110 shadow-orange-500/40'}
                    `}
                >
                    {isSending ? (
                         <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : <Send size={20} className="ml-0.5 mt-0.5" />}
                </button>

                <button 
                    onClick={toggleSheet}
                    className="w-12 h-12 rounded-full bg-slate-700/50 text-slate-300 flex items-center justify-center hover:bg-slate-700 transition-colors"
                >
                    {sheetHeight > 200 ? <ChevronDown size={24}/> : <ChevronUp size={24}/>}
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-900">
             <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-4 overscroll-contain">
                {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
                        <ShoppingBag size={48} className="opacity-20" />
                        <p>Il carrello è vuoto</p>
                        {editingOrderId && <p className="text-xs text-blue-400 text-center px-6">Stai modificando un ordine esistente. Aggiungi piatti o rimuovi quelli presenti.</p>}
                    </div>
                ) : (
                    <>
                        <p className="text-xs text-center text-slate-500 mb-4 animate-pulse uppercase tracking-wider">
                           ← Scorri per Eliminare • Scorri per Modificare →
                        </p>
                        {sortedCart.map((item, index) => (
                           <SwipeableCartItem 
                                key={index}
                                index={index}
                                item={item}
                                onEdit={() => editCartItem(index)}
                                onDelete={() => requestDelete(index)}
                                isFirst={index === 0}
                           />
                        ))}
                    </>
                )}
             </div>

             <div className="p-4 border-t border-slate-800 bg-slate-900 pb-8">
                 <button
                    onClick={requestSendOrder}
                    disabled={!table || isSending || cart.length === 0}
                    className={`w-full py-4 rounded-2xl font-bold text-lg tracking-wide flex items-center justify-center gap-3 shadow-xl transition-all relative overflow-hidden
                        ${(!table || isSending || cart.length === 0) 
                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed shadow-none border border-slate-700' 
                            : editingOrderId ? 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-[1.01] shadow-blue-500/20' : 'bg-orange-500 text-white hover:bg-orange-600 hover:scale-[1.01] shadow-orange-500/20'}
                    `}
                >
                    {isSending ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    ) : (
                        <><Send size={20}/> {editingOrderId ? 'AGGIORNA COMANDA' : 'INVIA ORDINE'}</>
                    )}
                    {!table && !isSending && (
                         <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs text-red-400 font-bold uppercase backdrop-blur-sm border-2 border-red-500/20 rounded-2xl">
                             SELEZIONA TAVOLO
                         </div>
                    )}
                </button>
             </div>
        </div>
      </div>

      {/* --- TABLE MANAGER MODAL --- */}
      {tableManagerOpen && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-700 flex flex-col max-h-[85vh]">
                  <div className="flex justify-between items-center mb-6">
                      {!isSettingTables ? (
                        <div>
                            <h2 className="text-2xl font-bold text-white">Mappa Tavoli</h2>
                            {table ? (
                                <p className="text-orange-400 text-sm font-bold">Selezionato: TAVOLO {table}</p>
                            ) : (
                                <p className="text-slate-400 text-sm">Seleziona un tavolo</p>
                            )}
                        </div>
                      ) : (
                        <div>
                            <h2 className="text-xl font-bold text-white">Impostazioni</h2>
                            <p className="text-slate-400 text-sm">Numero tavoli sala</p>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        {!isSettingTables && (
                            <button onClick={() => { setIsSettingTables(true); setTempTableCount(totalTables); }} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white">
                                <Settings size={20} />
                            </button>
                        )}
                        <button onClick={() => { setTableManagerOpen(false); setIsSettingTables(false); }} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white">
                            <X size={20} />
                        </button>
                      </div>
                  </div>
                  
                  {isSettingTables ? (
                      <div className="flex flex-col items-center justify-center flex-1 py-10">
                          <div className="flex items-center gap-4 mb-8">
                              <button onClick={() => setTempTableCount(Math.max(1, tempTableCount - 1))} className="p-4 bg-slate-800 rounded-xl text-white active:scale-95"><Minus/></button>
                              <span className="text-6xl font-black text-orange-500 font-mono">{tempTableCount}</span>
                              <button onClick={() => setTempTableCount(Math.min(50, tempTableCount + 1))} className="p-4 bg-slate-800 rounded-xl text-white active:scale-95"><Plus/></button>
                          </div>
                          <button onClick={handleSaveSettings} className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                              <Save size={20}/> SALVA CONFIGURAZIONE
                          </button>
                      </div>
                  ) : (
                    <>
                        <div className="grid grid-cols-3 gap-3 overflow-y-auto p-1 custom-scroll mb-4 flex-1">
                            {Array.from({ length: totalTables }, (_, i) => (i + 1).toString()).map(tId => {
                                const info = getTableStatusInfo(tId);
                                const isSelected = table === tId;
                                
                                let bgClass = 'bg-slate-800 border-slate-700 text-slate-400';
                                let statusText = 'LIBERO';

                                if (isSelected) {
                                    bgClass = 'bg-slate-800 border-orange-500 text-orange-500 ring-2 ring-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.4)]';
                                } else if (info.status === 'ready') {
                                    bgClass = 'bg-green-900/30 border-green-500 text-green-400 animate-pulse';
                                    statusText = 'PRONTO';
                                } else if (info.status === 'busy') {
                                    bgClass = 'bg-slate-700 border-orange-500/50 text-orange-200';
                                    statusText = 'IN ATTESA';
                                } else if (info.status === 'eating') {
                                    bgClass = 'bg-blue-900/40 border-blue-500/50 text-blue-200';
                                    statusText = 'AL TAVOLO';
                                }

                                return (
                                    <button
                                        key={tId}
                                        onClick={() => handleSelectTable(tId)}
                                        className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center relative transition-all active:scale-95 ${bgClass}`}
                                    >
                                        <span className="text-2xl font-black">{tId}</span>
                                        <span className="text-[9px] uppercase font-bold mt-1 leading-none text-center px-1">
                                            {statusText}
                                        </span>
                                        {info.count > 0 && (
                                            <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md
                                                ${info.status === 'ready' ? 'bg-green-600' : 'bg-orange-500'}
                                            `}>
                                                {info.count}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        
                        {/* ACTION BUTTONS FOR SELECTED TABLE */}
                        {table && (
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setTableManagerOpen(false)}
                                    className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-900/20"
                                >
                                    <ArrowRight size={20} /> VAI ALL'ORDINE
                                </button>
                                
                                {getTableStatusInfo(table).status !== 'free' && (
                                    <button 
                                        onClick={() => setFreeTableConfirmOpen(true)}
                                        className="flex-1 bg-slate-800 border border-red-900/50 text-red-400 hover:bg-red-900/20 hover:text-red-300 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <DoorOpen size={20} /> LIBERA
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                  )}
              </div>
          </div>
      )}

      {/* --- PROFILE / EXIT MODAL --- */}
      {profileOpen && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-xs shadow-2xl animate-slide-up">
                  <div className="flex flex-col items-center text-center mb-6">
                      <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500 text-blue-500 mb-3">
                          <User size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-white">Profilo Cameriere</h3>
                      <p className="text-slate-400 text-sm mt-1">Stai operando come <span className="text-white font-bold">{waiterName}</span></p>
                  </div>
                  
                  <div className="space-y-3">
                      <button 
                        onClick={onExit}
                        className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 border border-slate-700"
                      >
                          <Home size={18} /> Torna alla Dashboard
                      </button>
                      
                      <button 
                        onClick={handleLogout}
                        className="w-full py-3 rounded-xl bg-slate-800 text-red-400 font-bold text-sm hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 border border-slate-700"
                      >
                          <LogOut size={18} /> Logout / Cambia Utente
                      </button>
                      <button 
                        onClick={() => setProfileOpen(false)}
                        className="w-full py-3 rounded-xl bg-slate-700 text-white font-bold text-sm hover:bg-slate-600 transition-colors"
                      >
                          Chiudi
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- HISTORY MODAL --- */}
      {historyOpen && (
        <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="bg-slate-900 w-full h-[80vh] sm:h-auto sm:max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col animate-slide-up border border-slate-700">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="font-bold text-xl text-white">Storico Ordini</h2>
                        <span className="text-sm text-slate-400 font-mono uppercase">Tavolo <span className="text-orange-400 font-bold">{table}</span></span>
                    </div>
                    <button onClick={() => setHistoryOpen(false)} className="bg-slate-800 p-2 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                 <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                    {existingOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-600">
                            <History size={32} className="mb-2 opacity-50"/>
                            <p className="text-sm">Nessuna comanda inviata.</p>
                        </div>
                    ) : (
                        existingOrders.map(order => (
                            <div key={order.id} className="border border-slate-800 rounded-2xl p-4 bg-slate-800/50">
                                <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-700 border-dashed">
                                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                        <Clock size={10}/> {new Date(order.timestamp).toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'})}
                                    </div>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider
                                        ${order.status === OrderStatus.PENDING ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-800' :
                                          order.status === OrderStatus.COOKING ? 'bg-orange-900/30 text-orange-400 border border-orange-800' :
                                          order.status === OrderStatus.READY ? 'bg-green-900/30 text-green-400 border border-green-800' :
                                          'bg-slate-700 text-slate-400'}`}>
                                        {order.status}
                                    </span>
                                </div>
                                <ul className="space-y-2">
                                    {order.items.map((item, idx) => (
                                        <li key={idx} className="text-sm flex flex-col">
                                            <div className="flex justify-between text-slate-300">
                                                <span className="font-medium text-xs"><span className="font-bold text-white mr-1">{item.quantity}x</span> {item.menuItem.name}</span>
                                            </div>
                                            {item.notes && <span className="text-[10px] text-slate-500 italic mt-0.5 pl-4 border-l-2 border-slate-700">Note: {item.notes}</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      )}

       {/* --- DELETE CONFIRMATION MODAL --- */}
       {deleteConfirmIndex !== null && (
          <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
              <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-6 w-full max-w-xs shadow-2xl shadow-red-900/20 transform animate-slide-up">
                  <div className="flex flex-col items-center text-center mb-4">
                      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 text-red-500 border border-red-500/20">
                          <Trash2 size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-white">Rimuovere piatto?</h3>
                      <p className="text-slate-400 text-sm mt-2">
                          Vuoi eliminare <span className="text-white font-bold">{sortedCart[deleteConfirmIndex]?.menuItem.name}</span>?
                      </p>
                  </div>
                  <div className="flex gap-3 mt-6">
                      <button 
                        onClick={() => setDeleteConfirmIndex(null)}
                        className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold text-sm hover:bg-slate-700 transition-colors"
                      >
                          Annulla
                      </button>
                      <button 
                        onClick={confirmDelete}
                        className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 shadow-lg shadow-red-600/30 transition-colors"
                      >
                          Elimina
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- FREE TABLE CONFIRMATION MODAL --- */}
      {freeTableConfirmOpen && (
          <div className="absolute inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
              <div className="bg-slate-900 border border-slate-600 rounded-3xl p-6 w-full max-w-xs shadow-2xl transform animate-slide-up">
                  <div className="flex flex-col items-center text-center mb-4">
                      <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mb-4 text-slate-300 border border-slate-600">
                          <DoorOpen size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-white">Liberare il Tavolo {table}?</h3>
                      <p className="text-slate-400 text-sm mt-2">
                          Confermi che il tavolo è libero e il conto è stato gestito? Tutti gli ordini verranno archiviati.
                      </p>
                  </div>
                  <div className="flex gap-3 mt-6">
                      <button 
                        onClick={() => setFreeTableConfirmOpen(false)}
                        className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold text-sm hover:bg-slate-700 transition-colors"
                      >
                          Annulla
                      </button>
                      <button 
                        onClick={handleFreeTable}
                        className="flex-1 py-3 rounded-xl bg-white text-slate-900 font-bold text-sm hover:bg-slate-200 shadow-lg transition-colors"
                      >
                          Conferma
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- SEND CONFIRMATION MODAL --- */}
      {sendConfirmOpen && (
          <div className="absolute inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
              <div className={`bg-slate-900 border rounded-3xl p-6 w-full max-w-xs shadow-2xl transform animate-slide-up ${editingOrderId ? 'border-blue-500/30 shadow-blue-900/20' : 'border-orange-500/30 shadow-orange-900/20'}`}>
                  <div className="flex flex-col items-center text-center mb-4">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 border ${editingOrderId ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-orange-500/10 text-orange-500 border-orange-500/20'}`}>
                          <Send size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-white">{editingOrderId ? 'Aggiornare comanda?' : 'Inviare comanda?'}</h3>
                      <p className="text-slate-400 text-sm mt-2">
                          Confermi l'invio dell'ordine per il <span className="text-white font-bold">Tavolo {table}</span>?
                      </p>
                  </div>
                  <div className="flex gap-3 mt-6">
                      <button 
                        onClick={() => setSendConfirmOpen(false)}
                        className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold text-sm hover:bg-slate-700 transition-colors"
                      >
                          Annulla
                      </button>
                      <button 
                        onClick={handleSendOrder}
                        className={`flex-1 py-3 rounded-xl text-white font-bold text-sm shadow-lg transition-colors ${editingOrderId ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-600/30'}`}
                      >
                          {editingOrderId ? 'AGGIORNA' : 'INVIA'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- AI ASSISTANT MODAL --- */}
      {aiModalOpen && (
        <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
            <div className="bg-slate-900 w-full rounded-3xl p-5 shadow-2xl flex flex-col animate-slide-up border border-slate-700 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/20 blur-3xl rounded-full pointer-events-none"></div>

                <div className="flex justify-between items-center mb-4 z-10">
                    <div className="flex items-center gap-2 text-orange-400">
                        <Bot size={20} />
                        <h2 className="font-bold text-base tracking-wide">AI Chef Assistant</h2>
                    </div>
                    <button onClick={() => setAiModalOpen(false)} className="bg-slate-800 p-2 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white">
                        <X size={16} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto mb-4 bg-slate-800 rounded-2xl p-4 min-h-[120px] shadow-inner border border-slate-700 z-10">
                    {aiItem && (
                        <div className="mb-3 pb-3 border-b border-slate-700 text-xs text-orange-400 font-medium flex items-center gap-2">
                             <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
                             Contesto: <span className="font-bold text-white">{aiItem.name}</span>
                        </div>
                    )}
                    {aiResponse ? (
                        <p className="text-slate-300 leading-relaxed text-sm animate-fade-in">{aiResponse}</p>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2 mt-2">
                             <p className="italic text-center text-xs">"Chiedimi se questo piatto è senza glutine..."</p>
                        </div>
                    )}
                    {aiLoading && (
                        <div className="flex justify-center gap-1 mt-4">
                            <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce"></div>
                            <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce delay-75"></div>
                            <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce delay-150"></div>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 z-10">
                    <input 
                        type="text" 
                        value={aiQuery}
                        onChange={(e) => setAiQuery(e.target.value)}
                        placeholder="Domanda..."
                        className="flex-1 bg-slate-800 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500/50 focus:bg-slate-800 text-sm text-white placeholder-slate-500 transition-all"
                        onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                    />
                    <button 
                        onClick={handleAskAI}
                        disabled={aiLoading || !aiQuery}
                        className="bg-orange-500 text-white w-12 rounded-xl hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center shadow-lg shadow-orange-600/20 transition-all"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default WaiterPad;