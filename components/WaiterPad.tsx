import React, { useState, useEffect } from 'react';
import { 
  Order, OrderStatus, Category, MenuItem, OrderItem 
} from '../types';
import { 
  getOrders, addOrder, getMenuItems, freeTable, getWaiterName, 
  updateOrderItems, getTableCount, serveItem 
} from '../services/storageService';
import { 
  LogOut, Plus, Search, Utensils, CheckCircle, 
  ChevronLeft, ShoppingCart, Trash2, User, Clock, 
  DoorOpen, ChefHat, Pizza, Sandwich, 
  Wine, CakeSlice, UtensilsCrossed, Send as SendIcon, CheckSquare, Square, BellRing 
} from 'lucide-react';

interface WaiterPadProps {
  onExit: () => void;
}

const CATEGORIES = [
  Category.MENU_COMPLETO,
  Category.ANTIPASTI,
  Category.PRIMI,
  Category.SECONDI,
  Category.PIZZE,
  Category.PANINI,
  Category.DOLCI,
  Category.BEVANDE
];

const getCategoryIcon = (cat: Category) => {
    switch (cat) {
        case Category.MENU_COMPLETO: return <Utensils size={16}/>;
        case Category.ANTIPASTI: return <UtensilsCrossed size={16} />;
        case Category.PANINI: return <Sandwich size={16} />;
        case Category.PIZZE: return <Pizza size={16} />;
        case Category.PRIMI: return <ChefHat size={16} />;
        case Category.SECONDI: return <Utensils size={16} />;
        case Category.DOLCI: return <CakeSlice size={16} />;
        case Category.BEVANDE: return <Wine size={16} />;
        default: return <Utensils size={16} />;
    }
};

const WaiterPad: React.FC<WaiterPadProps> = ({ onExit }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tableCount, setTableCount] = useState(12);
  
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [view, setView] = useState<'tables' | 'menu' | 'cart'>('tables');
  const [activeCategory, setActiveCategory] = useState<Category>(Category.ANTIPASTI);
  
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const waiterName = getWaiterName();

  const loadData = () => {
    setOrders(getOrders());
    setMenuItems(getMenuItems());
    setTableCount(getTableCount());
  };

  useEffect(() => {
    loadData();
    const handleStorage = () => loadData();
    window.addEventListener('local-storage-update', handleStorage);
    window.addEventListener('local-menu-update', handleStorage);
    return () => {
      window.removeEventListener('local-storage-update', handleStorage);
      window.removeEventListener('local-menu-update', handleStorage);
    };
  }, []);

  const getTableStatus = (tableNum: string) => {
    const tableOrders = orders.filter(o => o.tableNumber === tableNum && o.status !== OrderStatus.DELIVERED);
    if (tableOrders.length === 0) return 'free';
    
    // Logic: 
    // 1. Ready to Serve (Green) -> At least one item is completed by kitchen but not served
    const hasItemsToServe = tableOrders.some(o => o.items.some(i => i.completed && !i.served));
    if (hasItemsToServe) return 'ready';

    // 2. Cooking (Orange) -> At least one item is not completed
    if (tableOrders.some(o => o.status === OrderStatus.COOKING)) return 'cooking';
    
    // 3. Occupied (Blue) -> Just seated/pending
    return 'occupied';
  };

  const activeTableOrder = selectedTable 
    ? orders.find(o => o.tableNumber === selectedTable && o.status !== OrderStatus.DELIVERED) 
    : null;

  const handleTableClick = (tableNum: string) => {
    setSelectedTable(tableNum);
    setCart([]);
    setView('tables');
  };

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.menuItem.id === item.id && !i.notes);
      if (existing) {
        return prev.map(i => i.menuItem.id === item.id && !i.notes 
          ? { ...i, quantity: i.quantity + 1 } 
          : i
        );
      }
      return [...prev, { menuItem: item, quantity: 1, served: false, completed: false }];
    });
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const updateCartQuantity = (index: number, delta: number) => {
    setCart(prev => {
        const newCart = [...prev];
        const item = newCart[index];
        const newQty = item.quantity + delta;
        if (newQty <= 0) return prev.filter((_, i) => i !== index);
        newCart[index] = { ...item, quantity: newQty };
        return newCart;
    });
  };

  const updateItemNotes = (index: number, notes: string) => {
      setCart(prev => {
          const newCart = [...prev];
          newCart[index] = { ...newCart[index], notes };
          return newCart;
      });
  };

  const sendOrder = () => {
    if (!selectedTable || cart.length === 0) return;

    if (!confirm(`Inviare ${cart.reduce((a,b)=>a+b.quantity,0)} piatti in cucina per Tavolo ${selectedTable}?`)) return;

    if (activeTableOrder) {
      updateOrderItems(activeTableOrder.id, cart);
    } else {
      const newOrder: Order = {
        id: Date.now().toString(),
        tableNumber: selectedTable,
        items: cart,
        status: OrderStatus.PENDING,
        timestamp: Date.now(),
        createdAt: Date.now(),
        waiterName: waiterName || 'Staff'
      };
      addOrder(newOrder);
    }
    setCart([]);
    setView('tables');
    // alert("Comanda inviata correttamente! 🚀");
  };

  const handleFreeTable = () => {
    if (selectedTable && confirm(`Liberare il Tavolo ${selectedTable}?`)) {
        freeTable(selectedTable);
        setSelectedTable(null);
    }
  };

  const handleServeItem = (orderId: string, itemIdx: number) => {
      serveItem(orderId, itemIdx);
  };

  // Filter menu items
  const filteredItems = menuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = item.category === activeCategory;
      return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans">
      {/* HEADER */}
      <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center shadow-lg z-30 relative shrink-0">
        <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold flex items-center gap-2"><div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><User size={18} className="text-white"/></div> {waiterName || 'Waiter Pad'}</h1>
        </div>
        <button onClick={onExit} className="bg-slate-700 p-2 rounded-full text-slate-300 hover:text-white hover:bg-red-600 transition-colors">
            <LogOut size={20} />
        </button>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        {view === 'tables' && (
            <div className="flex-1 overflow-y-auto p-4 relative">
                 {/* Detail Overlay for Selected Table */}
                 {selectedTable && (
                     <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
                         <div className="bg-slate-900 w-full sm:max-w-md h-[85vh] sm:h-auto sm:rounded-3xl rounded-t-3xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden animate-slide-up">
                             <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-800">
                                 <div>
                                     <h2 className="text-2xl font-black text-white">Tavolo {selectedTable}</h2>
                                     <p className={`text-xs font-bold uppercase ${activeTableOrder ? 'text-green-400' : 'text-slate-400'}`}>{activeTableOrder ? 'Occupato' : 'Libero'}</p>
                                 </div>
                                 <button onClick={() => setSelectedTable(null)} className="p-2 bg-slate-700 rounded-full text-slate-400 hover:text-white"><ChevronLeft size={20}/></button>
                             </div>
                             
                             <div className="flex-1 overflow-y-auto p-5 pb-24">
                                 {activeTableOrder ? (
                                     <div className="space-y-4">
                                         <div className="flex items-center justify-between p-3 bg-slate-800 rounded-xl border border-slate-700">
                                             <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase"><Clock size={14}/> Iniziato alle</div>
                                             <div className="font-mono font-bold">{new Date(activeTableOrder.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                         </div>
                                         
                                         <div>
                                             <p className="text-xs font-bold text-slate-500 uppercase mb-2">Comanda Attuale</p>
                                             <div className="space-y-2">
                                                 {activeTableOrder.items.map((item, idx) => {
                                                     // Logic for display:
                                                     // 1. Ready to Serve: Completed by Kitchen AND Not Served
                                                     const isReadyToServe = item.completed && !item.served;
                                                     // 2. Served: Already served
                                                     const isServed = item.served;
                                                     
                                                     return (
                                                         <div key={idx} className={`flex justify-between items-center text-sm p-3 rounded-lg border transition-all ${isReadyToServe ? 'bg-green-900/30 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'bg-slate-800/50 border-slate-700'}`}>
                                                             <div className="flex gap-3 items-center flex-1">
                                                                 <span className="font-bold text-white bg-slate-700 px-2 py-1 rounded text-xs">x{item.quantity}</span>
                                                                 <div className="flex flex-col">
                                                                     <span className={`font-bold text-base ${isServed ? 'line-through text-slate-500' : isReadyToServe ? 'text-white' : 'text-slate-300'}`}>{item.menuItem.name}</span>
                                                                     {item.notes && <span className="text-xs text-orange-400 italic">{item.notes}</span>}
                                                                     {isReadyToServe && <span className="text-[10px] font-black text-green-400 uppercase tracking-wider animate-pulse flex items-center gap-1 mt-1"><BellRing size={10}/> DA SERVIRE</span>}
                                                                 </div>
                                                             </div>
                                                             
                                                             {/* ACTION BUTTON */}
                                                             {isReadyToServe ? (
                                                                 <button onClick={() => handleServeItem(activeTableOrder.id, idx)} className="ml-2 bg-green-500 hover:bg-green-400 text-white p-2 rounded-lg shadow-lg active:scale-95 transition-all">
                                                                     <Square size={20} className="fill-current text-green-700"/>
                                                                 </button>
                                                             ) : isServed ? (
                                                                 <CheckSquare size={20} className="text-slate-600 ml-2" />
                                                             ) : (
                                                                 <span className="font-mono text-slate-500 ml-2 text-xs">Cooking</span>
                                                             )}
                                                         </div>
                                                     );
                                                 })}
                                             </div>
                                             <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                                                 <span className="font-bold text-lg">Totale</span>
                                                 <span className="font-black text-2xl text-green-400">€ {activeTableOrder.items.reduce((acc, i) => acc + (i.menuItem.price * i.quantity), 0).toFixed(2)}</span>
                                             </div>
                                         </div>
                                     </div>
                                 ) : (
                                     <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                                         <Utensils size={48} className="mb-4"/>
                                         <p>Nessun ordine attivo</p>
                                     </div>
                                 )}
                             </div>

                             <div className="p-5 border-t border-slate-800 bg-slate-800 flex gap-2 mb-10">
                                 <button onClick={() => setView('menu')} className="flex-[2] py-4 rounded-2xl font-black text-base tracking-wide text-white shadow-xl bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 transition-transform flex flex-col items-center justify-center gap-1 hover:scale-[1.02] shadow-blue-900/30">
                                     <Plus size={24}/> <span>{activeTableOrder ? 'AGGIUNGI' : 'NUOVO ORDINE'}</span>
                                 </button>
                                 {activeTableOrder && (
                                     <button onClick={handleFreeTable} className="flex-1 bg-orange-500 border-2 border-orange-400 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:bg-orange-600 transition-all flex flex-col items-center justify-center gap-2 hover:scale-[1.02]">
                                         <DoorOpen size={20} className="mb-1" />
                                         <span className="text-[10px] leading-tight">Sì, Libera</span>
                                     </button>
                                 )}
                             </div>
                         </div>
                     </div>
                 )}

                 <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                     {Array.from({ length: tableCount }, (_, i) => i + 1).map(num => {
                         const status = getTableStatus(num.toString());
                         let bgClass = "bg-slate-800 border-slate-700 text-slate-400";
                         let statusIcon = null;

                         if (status === 'occupied') { bgClass = "bg-blue-900/40 border-blue-500/50 text-blue-100"; statusIcon = <User size={12}/>; }
                         if (status === 'cooking') { bgClass = "bg-orange-900/40 border-orange-500/50 text-orange-100"; statusIcon = <ChefHat size={12}/>; }
                         if (status === 'ready') { bgClass = "bg-green-600 border-green-400 text-white animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.6)]"; statusIcon = <BellRing size={14} className="animate-wiggle"/>; }

                         return (
                             <button 
                                 key={num} 
                                 onClick={() => handleTableClick(num.toString())}
                                 className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1 shadow-lg transition-all active:scale-95 ${bgClass}`}
                             >
                                 <span className="text-3xl font-black">{num}</span>
                                 {status !== 'free' && <div className="flex items-center gap-1 text-[10px] font-bold uppercase">{statusIcon} {status === 'ready' ? 'SERVIRE' : status}</div>}
                             </button>
                         );
                     })}
                 </div>
            </div>
        )}

        {view === 'menu' && (
            <div className="flex flex-col h-full overflow-hidden">
                {/* FIXED HEADER WRAPPER - NO SCROLL */}
                <div className="shrink-0 bg-slate-900 z-20 shadow-md">
                    {/* Category Nav */}
                    <div className="bg-slate-800 p-2 overflow-x-auto whitespace-nowrap border-b border-slate-700 flex gap-2 no-scrollbar">
                        {CATEGORIES.map(cat => (
                            <button 
                                key={cat} 
                                onClick={() => setActiveCategory(cat)}
                                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-colors ${activeCategory === cat ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-700 text-slate-400'}`}
                            >
                                {getCategoryIcon(cat)} {cat}
                            </button>
                        ))}
                    </div>

                    {/* Search Bar */}
                    <div className="p-3 bg-slate-800 border-b border-slate-700">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="text" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Cerca piatto..." 
                                className="w-full bg-slate-900 text-white rounded-xl pl-10 pr-4 py-3 border border-slate-700 focus:border-blue-500 outline-none font-bold"
                            />
                        </div>
                    </div>
                </div>

                {/* SCROLLABLE MENU GRID */}
                <div className="flex-1 overflow-y-auto p-4 pb-32">
                    {/* 2x2 GRID LAYOUT */}
                    <div className="grid grid-cols-2 gap-3">
                        {filteredItems.map(item => (
                            <button 
                                key={item.id} 
                                onClick={() => addToCart(item)}
                                className="flex flex-col h-32 bg-slate-800 p-3 rounded-2xl border border-slate-700 hover:bg-slate-750 active:scale-[0.98] transition-all relative group shadow-sm overflow-hidden"
                            >
                                <div className="absolute top-2 right-2 p-1.5 bg-blue-600 rounded-full text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <Plus size={16}/>
                                </div>
                                
                                <div className="flex justify-between items-start w-full mb-1">
                                    <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center font-bold text-slate-500 shrink-0">
                                        {item.category === Category.BEVANDE ? <Wine size={16}/> : <Utensils size={16}/>}
                                    </div>
                                    <span className="font-black text-sm text-blue-400">€{item.price.toFixed(0)}</span>
                                </div>
                                
                                <div className="flex-1 flex flex-col justify-center text-left w-full">
                                    <h3 className="font-bold text-sm leading-tight text-white line-clamp-2">{item.name}</h3>
                                    {item.description && <p className="text-slate-500 text-[10px] line-clamp-1 mt-0.5">{item.description}</p>}
                                </div>
                            </button>
                        ))}
                    </div>
                    {filteredItems.length === 0 && (
                        <div className="text-center py-10 text-slate-500">
                            <p>Nessun piatto trovato.</p>
                        </div>
                    )}
                </div>
                
                {/* FLOATING CART BAR (RAISED) */}
                {cart.length > 0 && (
                    <div className="fixed bottom-6 left-4 right-4 z-30 flex gap-3 shadow-2xl animate-slide-up">
                        <button onClick={() => setView('cart')} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-green-600/30 flex items-center justify-between px-6 transition-transform active:scale-95">
                            <div className="flex items-center gap-2"><ShoppingCart size={24}/> <span>RIEPILOGO</span></div>
                            <div className="flex items-center gap-3">
                                <span className="bg-green-800 px-3 py-1 rounded-lg text-sm">{cart.reduce((a, b) => a + b.quantity, 0)}</span>
                                <span>€ {cart.reduce((a, b) => a + (b.menuItem.price * b.quantity), 0).toFixed(2)}</span>
                            </div>
                        </button>
                        <button onClick={sendOrder} className="w-20 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl shadow-lg shadow-orange-500/30 flex items-center justify-center transition-transform active:scale-95 border-2 border-orange-400">
                            <SendIcon size={28} className="ml-1" />
                        </button>
                    </div>
                )}
            </div>
        )}

        {view === 'cart' && (
            <div className="flex-1 flex flex-col bg-slate-900">
                <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center gap-3 shrink-0">
                    <button onClick={() => setView('menu')} className="p-2 bg-slate-700 rounded-lg text-slate-300"><ChevronLeft size={24}/></button>
                    <h2 className="text-xl font-black text-white">Riepilogo Ordine</h2>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
                    {cart.map((item, idx) => (
                        <div key={idx} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg">{item.menuItem.name}</h3>
                                    <p className="text-blue-400 font-mono text-sm">€ {item.menuItem.price.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center gap-3 bg-slate-900 rounded-lg p-1 border border-slate-700">
                                    <button onClick={() => updateCartQuantity(idx, -1)} className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-red-500/20 hover:text-red-400 rounded-md transition-colors font-bold">-</button>
                                    <span className="font-bold w-6 text-center">{item.quantity}</span>
                                    <button onClick={() => updateCartQuantity(idx, 1)} className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-green-500/20 hover:text-green-400 rounded-md transition-colors font-bold">+</button>
                                </div>
                            </div>
                            <input 
                                type="text" 
                                placeholder="Note (es. senza cipolla)" 
                                value={item.notes || ''} 
                                onChange={(e) => updateItemNotes(idx, e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                            />
                            <div className="flex justify-end">
                                <button onClick={() => removeFromCart(idx)} className="text-xs text-red-400 flex items-center gap-1 hover:underline"><Trash2 size={12}/> Rimuovi</button>
                            </div>
                        </div>
                    ))}
                    {cart.length === 0 && <div className="text-center text-slate-500 mt-10">Carrello vuoto</div>}
                </div>

                <div className="fixed bottom-6 left-4 right-4 bg-slate-800 border border-slate-700 p-4 rounded-3xl shadow-2xl z-40">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <span className="text-slate-400 font-bold uppercase text-xs">Totale Stimato</span>
                        <span className="text-3xl font-black text-white">€ {cart.reduce((a, b) => a + (b.menuItem.price * b.quantity), 0).toFixed(2)}</span>
                    </div>
                    <button onClick={sendOrder} disabled={cart.length === 0} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-black text-xl shadow-lg shadow-blue-600/20 transition-transform active:scale-95 flex items-center justify-center gap-3">
                         <CheckCircle size={24}/> CONFERMA ORDINE
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default WaiterPad;