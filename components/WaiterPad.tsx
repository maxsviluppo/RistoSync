import React, { useState, useEffect, useRef } from 'react';
import { Category, MenuItem, Order, OrderItem, OrderStatus } from '../types';
import { MENU_ITEMS } from '../constants';
import { addOrder, getOrders } from '../services/storageService';
import { askChefAI } from '../services/geminiService';
import { ShoppingBag, Send, X, Plus, Minus, Bot, History, Clock, ChevronUp, ChevronDown, Trash2, Search, Utensils, ChefHat, Pizza, CakeSlice, Wine, Edit2, Check, AlertTriangle } from 'lucide-react';

// --- CONSTANTS ---
const CATEGORY_ORDER = [
    Category.ANTIPASTI,
    Category.PRIMI,
    Category.SECONDI,
    Category.DOLCI,
    Category.BEVANDE
];

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

    // Threshold to trigger action
    const THRESHOLD = 80;

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
                // Animation duration is 2s, stop "isAnimating" state after
                setTimeout(() => {
                    if (!hasInteracted) setIsAnimating(false);
                }, 2000); 
            }
        }, 6000); // Repeat every 6 seconds

        // Initial delay
        const initialTimeout = setTimeout(() => {
             if (!hasInteracted) {
                setIsAnimating(true);
                setTimeout(() => setIsAnimating(false), 2000);
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
        if (offsetX > 0) return 'bg-orange-500'; // Edit
        if (offsetX < 0) return 'bg-red-600';    // Delete
        return 'bg-slate-700';
    };

    return (
        <div 
            className={`relative h-24 rounded-2xl overflow-hidden mb-3 select-none transition-colors duration-200 ${getBgColor()}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Background Actions Layer */}
            <div className="absolute inset-0 flex justify-between items-center px-6 text-white font-bold">
                {/* Left Action (Reveal on swipe Right - EDIT) */}
                <div className={`flex items-center gap-2 transition-opacity duration-300 ${isAnimating ? 'animate-fade-edit' : (offsetX > 20 ? 'opacity-100' : 'opacity-0')}`}>
                    <Edit2 size={24} /> 
                    <span className="text-sm uppercase tracking-wider">Modifica</span>
                </div>

                {/* Right Action (Reveal on swipe Left - DELETE) */}
                <div className={`flex items-center gap-2 transition-opacity duration-300 ${isAnimating ? 'animate-fade-delete' : (offsetX < -20 ? 'opacity-100' : 'opacity-0')}`}>
                    <span className="text-sm uppercase tracking-wider">Elimina</span>
                    <Trash2 size={24} />
                </div>
            </div>

            {/* Foreground Content Layer */}
            <div 
                ref={containerRef}
                className={`absolute inset-0 bg-slate-800 p-4 flex flex-col justify-center border border-slate-700 shadow-md ${isAnimating ? 'animate-card-swipe' : ''}`}
                style={{ 
                    transform: isAnimating ? undefined : `translateX(${offsetX}px)`,
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
                }}
            >
                 <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-center">
                        <span className="bg-slate-700 text-slate-200 font-bold w-8 h-8 flex items-center justify-center rounded-lg text-sm shadow-inner">
                            {item.quantity}
                        </span>
                        <div>
                            <span className="font-bold text-white text-lg block leading-none mb-1">{item.menuItem.name}</span>
                            <span className="font-mono text-orange-400 text-sm">€{(item.menuItem.price * item.quantity).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                {item.notes && (
                    <p className="text-xs text-slate-400 mt-2 italic pl-2 border-l-2 border-slate-600 truncate">
                        {item.notes}
                    </p>
                )}
            </div>
            
            {/* Visual Hint Arrows (Only visible when stationary and first item) */}
            {offsetX === 0 && !hasInteracted && isFirst && !isAnimating && (
                <>
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600/30 animate-pulse">
                        <ChevronDown className="rotate-90" size={16} />
                    </div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600/30 animate-pulse">
                        <ChevronDown className="-rotate-90" size={16} />
                    </div>
                </>
            )}
        </div>
    );
};


const WaiterPad: React.FC = () => {
  const [table, setTable] = useState<string>('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category>(Category.ANTIPASTI);
  const [isSending, setIsSending] = useState(false);
  
  // Sheet Drag State
  const [sheetHeight, setSheetHeight] = useState(80); // Default collapsed height in px
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const dragStartY = useRef(0);
  const startHeight = useRef(0);
  
  // Item Editing State (Inline)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editNotes, setEditNotes] = useState('');

  // Delete Confirmation State
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  // AI State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiItem, setAiItem] = useState<MenuItem | null>(null);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // History State
  const [historyOpen, setHistoryOpen] = useState(false);
  const [existingOrders, setExistingOrders] = useState<Order[]>([]);

  // --- Listen for updates from Kitchen to keep history fresh ---
  const loadExistingOrders = () => {
      if (!table) {
          setExistingOrders([]);
          return;
      }
      const allOrders = getOrders();
      const tableOrders = allOrders
        .filter(o => o.tableNumber === table)
        .sort((a, b) => b.timestamp - a.timestamp); // Newest first
      setExistingOrders(tableOrders);
  };

  useEffect(() => {
    loadExistingOrders();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ristosync_orders') loadExistingOrders();
    };
    const handleLocalUpdate = () => loadExistingOrders();

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage-update', handleLocalUpdate);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-update', handleLocalUpdate);
    };
  }, [table]); 

  // --- Sorting Logic for Cart ---
  // Sort items based on the predefined CATEGORY_ORDER
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
    const diff = dragStartY.current - currentY; // Moving up is positive diff
    
    const newHeight = Math.max(80, Math.min(window.innerHeight * 0.9, startHeight.current + diff));
    setSheetHeight(newHeight);
  };

  const handleSheetTouchEnd = () => {
    setIsDraggingSheet(false);
    // Snap logic
    const threshold = window.innerHeight * 0.4;
    if (sheetHeight > threshold) {
        setSheetHeight(window.innerHeight * 0.85); // Expand
    } else {
        setSheetHeight(80); // Collapse
    }
  };

  const toggleSheet = () => {
      if (sheetHeight > 200) {
          setSheetHeight(80);
      } else {
          setSheetHeight(window.innerHeight * 0.85);
      }
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
     
     // Remove specific item from cart
     setCart(prev => prev.filter(i => i !== itemToEdit));
     
     if (cart.length <= 1) setSheetHeight(80);
     
     setSelectedCategory(itemToEdit.menuItem.category);
     setEditingItemId(itemToEdit.menuItem.id);
     setEditQty(itemToEdit.quantity);
     setEditNotes(itemToEdit.notes || '');
     
     setSheetHeight(80); // Collapse to show menu
  };

  // --- Submit Order ---
  const handleSendOrder = () => {
    if (!table || cart.length === 0) return;
    
    setIsSending(true);
    const newOrder: Order = {
      id: Date.now().toString(),
      tableNumber: table,
      items: cart, // The stored cart (unsorted in storage, but that's fine, display handles sort)
      status: OrderStatus.PENDING,
      timestamp: Date.now(),
    };

    addOrder(newOrder);

    setTimeout(() => {
      setCart([]);
      setIsSending(false);
      setSheetHeight(80);
      loadExistingOrders(); 
    }, 500);
  };

  // --- AI Handler ---
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

  const total = cart.reduce((acc, item) => acc + (item.menuItem.price * item.quantity), 0);
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const pendingCount = existingOrders.filter(o => o.status !== OrderStatus.DELIVERED).length;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 max-w-md mx-auto shadow-2xl overflow-hidden relative border-x border-slate-800 font-sans selection:bg-orange-500 selection:text-white">
      
      {/* Styles for Swipe Animation */}
      <style>{`
        /* Card Movement */
        @keyframes swipe-card {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(80px); } /* Move Right to Reveal Edit */
            50% { transform: translateX(0); }
            75% { transform: translateX(-80px); } /* Move Left to Reveal Delete */
        }
        
        /* Background Color Change */
        @keyframes swipe-bg {
            0%, 100% { background-color: rgb(51, 65, 85); } /* slate-700 */
            25% { background-color: rgb(249, 115, 22); } /* orange-500 */
            50% { background-color: rgb(51, 65, 85); }
            75% { background-color: rgb(220, 38, 38); } /* red-600 */
        }

        /* Text Opacity - Reveal Edit (Left Side) */
        @keyframes fade-edit {
            0%, 50%, 100% { opacity: 0; }
            25% { opacity: 1; }
        }

        /* Text Opacity - Reveal Delete (Right Side) */
        @keyframes fade-delete {
            0%, 50%, 100% { opacity: 0; }
            75% { opacity: 1; }
        }

        .animate-card-swipe {
            animation: swipe-card 2s ease-in-out;
        }
        .animate-bg-color {
            animation: swipe-bg 2s ease-in-out;
        }
        .animate-fade-edit {
            animation: fade-edit 2s ease-in-out;
        }
        .animate-fade-delete {
            animation: fade-delete 2s ease-in-out;
        }
      `}</style>

      {/* --- HEADER --- */}
      <div className="bg-slate-900 pt-5 pb-2 px-5 z-40 flex justify-between items-center sticky top-0 border-b border-white/5">
        <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 border border-orange-400/30 transform -rotate-3">
                <Utensils size={18} className="text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight text-white leading-none">
                Risto<br/><span className="text-orange-500">Sync</span>
            </h1>
        </div>
        
        <div className="flex items-center gap-3">
            <div className={`flex items-center rounded-xl pl-4 pr-2 py-2 border-2 transition-all duration-300 transform
                ${!table 
                    ? 'bg-slate-800/80 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse' 
                    : 'bg-slate-900 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.6)] scale-105 ring-1 ring-orange-500/20'
                }`}>
                <span className={`text-[10px] font-black uppercase tracking-wider mr-1 ${!table ? 'text-red-400' : 'text-white'}`}>TAVOLO</span>
                <input 
                    type="number" 
                    value={table}
                    onChange={(e) => setTable(e.target.value)}
                    placeholder="?"
                    className={`w-12 text-center font-black text-2xl focus:outline-none placeholder-slate-500/50 bg-transparent
                        ${!table ? 'text-white' : 'text-orange-500 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]'}
                    `}
                />
            </div>

            {table && (
                <button 
                    onClick={() => setHistoryOpen(true)}
                    className={`relative p-3 rounded-full transition-all active:scale-95 border ${existingOrders.length > 0 ? 'bg-orange-600/10 border-orange-500/30 text-orange-400 hover:bg-orange-600/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                >
                    <History size={20} />
                    {pendingCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-md border border-slate-900 animate-bounce">
                            {pendingCount}
                        </span>
                    )}
                </button>
            )}
        </div>
      </div>

      {/* --- MENU GRID --- */}
      <div className="flex-1 overflow-y-auto pb-48 relative scroll-smooth">
          
          <div className="sticky top-0 z-30 pt-2 pb-4 bg-gradient-to-b from-slate-900 via-slate-900/95 to-transparent">
            <div className="flex px-4 gap-3 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory">
                {Object.values(Category).map(cat => {
                    const isActive = selectedCategory === cat;
                    return (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`
                                flex flex-row items-center justify-center gap-2 py-2.5 px-4 rounded-full transition-all duration-300 snap-center shrink-0 border
                                ${isActive 
                                    ? 'bg-orange-500 border-orange-400 text-white shadow-lg shadow-orange-500/25 scale-105 font-bold' 
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

          <div className="px-4 space-y-4 pt-1">
              {MENU_ITEMS.filter(i => i.category === selectedCategory).map(item => {
                  const isEditing = editingItemId === item.id;
                  
                  return (
                    <div 
                        key={item.id} 
                        className={`
                            group relative overflow-hidden transition-all duration-300 rounded-[2rem] border
                            ${isEditing 
                                ? 'bg-slate-800 border-orange-500/50 shadow-[0_0_30px_rgba(249,115,22,0.15)] ring-1 ring-orange-500/30' 
                                : 'bg-gradient-to-br from-slate-700/60 to-slate-800/60 border-white/10 shadow-xl'}
                        `}
                    >
                      <div className="p-5">
                          <div className="flex justify-between items-start gap-4">
                              <div className="flex-1 z-10">
                                  <div className="flex items-center gap-2 mb-2">
                                      <h3 className="font-bold text-white text-lg leading-tight tracking-tight shadow-black drop-shadow-md">{item.name}</h3>
                                  </div>
                                  {!isEditing && (
                                    <>
                                        <p className="text-slate-300 text-xs leading-relaxed mb-5 pr-2 line-clamp-2 font-medium">{item.description}</p>
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono font-bold text-orange-400 text-xl">€{item.price.toFixed(2)}</span>
                                            <button onClick={(e) => { e.stopPropagation(); openAiFor(item); }} className="text-slate-400 hover:text-orange-400 transition-colors flex items-center gap-1 text-[10px] font-bold bg-slate-900/40 px-2.5 py-1.5 rounded-lg border border-white/5 uppercase tracking-wide">
                                                <Search size={10} /> Info
                                            </button>
                                        </div>
                                    </>
                                  )}
                              </div>
                              
                              {!isEditing && (
                                  <button
                                    onClick={() => startEditing(item)}
                                    className="flex-shrink-0 w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20 active:scale-95 transition-transform z-20 hover:bg-orange-400"
                                  >
                                    <Plus size={24} strokeWidth={3} />
                                  </button>
                              )}
                          </div>

                          {/* --- INLINE EDITING BLOCK --- */}
                          {isEditing && (
                              <div className="mt-4 bg-white rounded-xl p-4 animate-slide-up shadow-inner">
                                  <div className="flex items-center justify-between mb-4">
                                      <label className="text-slate-500 text-xs font-bold uppercase tracking-wider">Quantità</label>
                                      <div className="flex items-center gap-3 bg-slate-100 rounded-lg p-1">
                                          <button onClick={() => setEditQty(Math.max(1, editQty - 1))} className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 active:scale-95">
                                              <Minus size={16} />
                                          </button>
                                          <span className="font-bold text-slate-800 w-4 text-center text-lg">{editQty}</span>
                                          <button onClick={() => setEditQty(editQty + 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 active:scale-95">
                                              <Plus size={16} />
                                          </button>
                                      </div>
                                  </div>

                                  <div className="mb-4">
                                      <label className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 block">Note Cucina</label>
                                      <input 
                                          type="text"
                                          value={editNotes}
                                          onChange={(e) => setEditNotes(e.target.value)}
                                          placeholder="Es. Ben cotto, no cipolla..."
                                          className="w-full bg-slate-100 border-none rounded-lg px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-orange-200 outline-none"
                                      />
                                  </div>

                                  <div className="flex gap-2">
                                      <button 
                                        onClick={cancelEditing}
                                        className="flex-1 py-3 rounded-lg border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-colors"
                                      >
                                          Annulla
                                      </button>
                                      <button 
                                        onClick={() => confirmItem(item)}
                                        className="flex-[2] py-3 rounded-lg bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 shadow-md shadow-orange-200 flex items-center justify-center gap-2"
                                      >
                                          <Check size={18} /> Conferma €{(item.price * editQty).toFixed(2)}
                                      </button>
                                  </div>
                              </div>
                          )}
                      </div>
                    </div>
                  );
              })}
          </div>

        {/* Floating AI Helper */}
        <button 
            onClick={() => openAiFor(null)}
            className={`fixed right-5 w-12 h-12 bg-indigo-600 border border-indigo-400 text-white rounded-full shadow-[0_8px_30px_rgba(79,70,229,0.4)] flex items-center justify-center z-20 transition-all duration-500 hover:scale-110 hover:shadow-indigo-500/60`}
            style={{ bottom: sheetHeight + 20 }}
        >
            <Bot size={24} />
        </button>
      </div>

      {/* --- BOTTOM SHEET CART (DRAGGABLE 3D OVERLAY) --- */}
      <div 
        className="absolute bottom-0 left-0 right-0 z-40 bg-slate-800 rounded-t-[2.5rem] shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)] border-t border-white/10 flex flex-col will-change-transform"
        style={{ 
            height: `${sheetHeight}px`,
            transition: isDraggingSheet ? 'none' : 'height 0.4s cubic-bezier(0.17, 0.67, 0.22, 1.26)'
        }}
      >
        {/* Drag Handle Area */}
        <div 
            onTouchStart={handleSheetTouchStart}
            onTouchMove={handleSheetTouchMove}
            onTouchEnd={handleSheetTouchEnd}
            className="flex-shrink-0 h-20 px-6 flex items-center justify-between relative bg-gradient-to-b from-slate-800 to-slate-800/90 rounded-t-[2.5rem] cursor-grab active:cursor-grabbing"
        >
            <div className="absolute top-3 left-1/2 transform -translate-x-1/2 w-12 h-1.5 bg-slate-600/50 rounded-full" />
            
            <div className="flex items-center gap-4 mt-2">
                <div className={`transition-all duration-300 ${sheetHeight > 100 ? 'scale-0 w-0' : 'scale-100 w-12'}`}>
                     <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-white font-bold relative">
                        <ShoppingBag size={18} />
                        {totalItems > 0 && <span className="absolute -top-1 -right-1 bg-orange-500 text-[10px] w-5 h-5 rounded-full flex items-center justify-center">{totalItems}</span>}
                     </div>
                </div>
                <div>
                    <h2 className="font-bold text-white text-lg">Il tuo Ordine</h2>
                    {sheetHeight < 150 && cart.length > 0 && <span className="text-slate-400 text-xs">{totalItems} elementi</span>}
                    {sheetHeight > 150 && table && <span className="text-orange-400 text-xs uppercase tracking-wider font-bold">Tavolo {table}</span>}
                </div>
            </div>

            <div className="mt-2 flex items-center gap-3">
                 <span className="font-mono text-2xl font-bold text-white">€{total.toFixed(2)}</span>
                 <button onClick={toggleSheet} className={`bg-slate-700 p-2 rounded-full transition-transform duration-500 ${sheetHeight > 200 ? 'rotate-180' : 'rotate-0'}`}>
                     <ChevronUp size={20} className="text-slate-400" />
                 </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-900">
             <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-4">
                {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
                        <ShoppingBag size={48} className="opacity-20" />
                        <p>Il carrello è vuoto</p>
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
                    onClick={handleSendOrder}
                    disabled={!table || isSending || cart.length === 0}
                    className={`w-full py-4 rounded-2xl font-bold text-lg tracking-wide flex items-center justify-center gap-3 shadow-xl transition-all relative overflow-hidden
                        ${(!table || isSending || cart.length === 0) ? 'bg-slate-800 text-slate-600 cursor-not-allowed shadow-none border border-slate-700' : 'bg-orange-500 text-white hover:bg-orange-600 hover:scale-[1.01] shadow-orange-500/20'}
                    `}
                >
                    {isSending ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    ) : (
                        <><Send size={20}/> CONFERMA ORDINE</>
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
                {/* ... existing history list ... */}
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
                          Vuoi eliminare <span className="text-white font-bold">{sortedCart[deleteConfirmIndex]?.menuItem.name}</span> dall'ordine?
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

      {/* --- AI ASSISTANT MODAL (Existing) --- */}
      {aiModalOpen && (
        <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
            <div className="bg-slate-900 w-full rounded-3xl p-5 shadow-2xl flex flex-col animate-slide-up border border-slate-700 relative overflow-hidden">
                {/* Background decorative blob */}
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