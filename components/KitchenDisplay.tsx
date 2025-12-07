import React, { useEffect, useState, useRef } from 'react';
import { Order, OrderStatus, Category } from '../types';
import { getOrders, updateOrderStatus, clearHistory, toggleOrderItemCompletion, getCategoryConfig } from '../services/storageService';
import { CheckCircle, ChefHat, Trash2, History, UtensilsCrossed, Bell, User, LogOut, Square, CheckSquare, AlertCircle, Clock } from 'lucide-react';

// --- SORT PRIORITY ---
const CATEGORY_PRIORITY: Record<Category, number> = {
    [Category.ANTIPASTI]: 1,
    [Category.PRIMI]: 2,
    [Category.SECONDI]: 3,
    [Category.DOLCI]: 4,
    [Category.BEVANDE]: 5
};

// --- CONFIG ---
const WARNING_MINUTES = 15; // Minuti dopo i quali scatta l'allarme

// --- SOUND UTILS ---
const playNotificationSound = (type: 'new' | 'ready') => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'new') {
            // Attention sound (Double beep)
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.setValueAtTime(554, ctx.currentTime + 0.1); // C#5
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
            
            // Second beep
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.type = 'square';
            osc2.frequency.setValueAtTime(554, ctx.currentTime + 0.4);
            osc2.frequency.setValueAtTime(440, ctx.currentTime + 0.5);
            gain2.gain.setValueAtTime(0.1, ctx.currentTime + 0.4);
            gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.7);
            osc2.start(ctx.currentTime + 0.4);
            osc2.stop(ctx.currentTime + 0.7);

        } else if (type === 'ready') {
            // Success sound (Ding)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1); // C6
            
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
            
            osc.start();
            osc.stop(ctx.currentTime + 1);
        }
    } catch (e) {
        console.error("Audio play failed", e);
    }
};

interface KitchenDisplayProps {
    onExit: () => void;
}

const KitchenDisplay: React.FC<KitchenDisplayProps> = ({ onExit }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [categoryConfig, setCategoryConfig] = useState<Record<Category, boolean>>(getCategoryConfig());
  
  // Real-time Timer State
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Notification State
  const [notification, setNotification] = useState<{msg: string, type: 'info' | 'success'} | null>(null);
  
  // Refs for change detection
  const previousOrdersRef = useRef<Order[]>([]);
  const isFirstLoad = useRef(true);

  const showNotification = (msg: string, type: 'info' | 'success') => {
      setNotification({ msg, type });
      setTimeout(() => setNotification(null), 4000);
  };

  // Timer Tick
  useEffect(() => {
      const timer = setInterval(() => {
          setCurrentTime(Date.now());
      }, 1000);
      return () => clearInterval(timer);
  }, []);

  const loadOrders = () => {
    const allOrders = getOrders();
    const currentConfig = getCategoryConfig();
    setCategoryConfig(currentConfig);
    
    // --- SORTING LOGIC ---
    // 1. Ordini READY vanno in fondo (coda di uscita)
    // 2. Ordini PENDING/COOKING ordinati per timestamp (vecchi prima)
    // NOTA: Le modifiche non cambiano il timestamp originale, quindi mantengono la posizione!
    const sorted = allOrders.sort((a, b) => {
        // Logica per viewMode Active
        const isReadyA = a.status === OrderStatus.READY;
        const isReadyB = b.status === OrderStatus.READY;

        if (isReadyA && !isReadyB) return 1; // A (Ready) va dopo B (Non Ready)
        if (!isReadyA && isReadyB) return -1; // B (Ready) va dopo A (Non Ready)

        // Se entrambi hanno lo stesso macro-stato (es. entrambi non pronti), vince il tempo
        return a.timestamp - b.timestamp;
    });

    // --- CHANGE DETECTION LOGIC ---
    // Filter orders to only check for notifications on Kitchen-Relevant Items
    // If an order only contains drinks (and drinks are Service), we shouldn't notify the kitchen
    const relevantOrders = sorted.filter(order => 
        order.items.some(item => currentConfig[item.menuItem.category])
    );

    if (!isFirstLoad.current) {
        const prevOrders = previousOrdersRef.current;
        
        // 1. Detect NEW Orders
        const newOrderIds = relevantOrders.map(o => o.id);
        const prevOrderIds = prevOrders.map(o => o.id);
        const addedOrders = relevantOrders.filter(o => !prevOrderIds.includes(o.id));
        
        if (addedOrders.length > 0) {
            playNotificationSound('new');
            showNotification(`Nuovo Ordine: Tavolo ${addedOrders[0].tableNumber}`, 'info');
        }

        // 2. Detect STATUS Changes to READY
        relevantOrders.forEach(newOrder => {
            const oldOrder = prevOrders.find(o => o.id === newOrder.id);
            if (oldOrder && oldOrder.status !== OrderStatus.READY && newOrder.status === OrderStatus.READY) {
                playNotificationSound('ready');
                showNotification(`Tavolo ${newOrder.tableNumber} è PRONTO!`, 'success');
            }
        });
    }

    if (isFirstLoad.current) isFirstLoad.current = false;
    previousOrdersRef.current = relevantOrders; // Store filtered as reference
    setOrders(sorted); // Store all, but filter in render
  };

  useEffect(() => {
    loadOrders();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ristosync_orders') loadOrders();
    };
    const handleLocalUpdate = () => loadOrders();
    const handleMenuUpdate = () => loadOrders(); // Update if config changes

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage-update', handleLocalUpdate);
    window.addEventListener('local-menu-update', handleMenuUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-update', handleLocalUpdate);
      window.removeEventListener('local-menu-update', handleMenuUpdate);
    };
  }, []);

  const advanceStatus = (orderId: string, currentStatus: OrderStatus) => {
    let nextStatus = currentStatus;
    if (currentStatus === OrderStatus.PENDING) nextStatus = OrderStatus.COOKING;
    else if (currentStatus === OrderStatus.COOKING) nextStatus = OrderStatus.READY;
    else if (currentStatus === OrderStatus.READY) nextStatus = OrderStatus.DELIVERED;

    updateOrderStatus(orderId, nextStatus);
  };

  const handleToggleItem = (orderId: string, originalIndex: number) => {
      toggleOrderItemCompletion(orderId, originalIndex);
  };

  const formatDuration = (ms: number) => {
      const totalSeconds = Math.floor(ms / 1000);
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING: return 'bg-yellow-100 border-yellow-400 text-yellow-800';
      case OrderStatus.COOKING: return 'bg-orange-100 border-orange-400 text-orange-800';
      case OrderStatus.READY: return 'bg-green-100 border-green-400 text-green-800';
      case OrderStatus.DELIVERED: return 'bg-slate-200 border-slate-400 text-slate-600';
      default: return 'bg-gray-100 border-gray-400';
    }
  };

  // Filter orders based on view mode AND content relevance
  const displayedOrders = orders.filter(o => {
      // 1. Status Filter
      if (viewMode === 'active' && o.status === OrderStatus.DELIVERED) return false;
      if (viewMode === 'history' && o.status !== OrderStatus.DELIVERED) return false;
      
      // 2. Content Filter: Must have at least one Kitchen item (config=true)
      const hasKitchenItems = o.items.some(item => categoryConfig[item.menuItem.category]);
      return hasKitchenItems;
  });

  // Reverse history to show newest first
  if (viewMode === 'history') {
      displayedOrders.reverse();
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-6 font-sans flex flex-col relative overflow-hidden">
      
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 px-8 py-4 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center gap-4 animate-slide-down border-2
            ${notification.type === 'success' ? 'bg-green-600 border-green-400 text-white' : 'bg-blue-600 border-blue-400 text-white'}
        `}>
            {notification.type === 'success' ? <CheckCircle size={32} className="animate-bounce" /> : <Bell size={32} className="animate-swing" />}
            <div>
                <h3 className="font-black text-2xl uppercase tracking-wide">{notification.type === 'success' ? 'ORDINE PRONTO' : 'NUOVO ORDINE'}</h3>
                <p className="font-medium text-lg opacity-90">{notification.msg}</p>
            </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 border-b border-slate-700 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20">
             <ChefHat className="w-8 h-8 text-white" />
          </div>
          <div>
              <h1 className="text-3xl font-bold tracking-tight leading-none text-white">
                  Risto<span className="text-orange-500">Sync</span>
              </h1>
              <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold">Kitchen Dashboard</p>
          </div>
          
          {/* Refresh Manuale (Sync Check) */}
          <button 
             onClick={() => loadOrders()}
             className="ml-4 p-2 rounded-full bg-slate-800 text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
             title="Forza Aggiornamento"
          >
             <History size={16} />
          </button>
          
          {/* Tabs */}
          <div className="ml-4 flex bg-slate-800 rounded-lg p-1 border border-slate-700">
             <button 
                onClick={() => setViewMode('active')}
                className={`px-6 py-2 rounded-md font-bold text-sm uppercase tracking-wide transition-all ${viewMode === 'active' ? 'bg-slate-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
             >
                In Corso <span className="ml-2 bg-orange-500 text-white px-2 py-0.5 rounded-full text-xs">{orders.filter(o => o.status !== OrderStatus.DELIVERED && o.items.some(i => categoryConfig[i.menuItem.category])).length}</span>
             </button>
             <button 
                onClick={() => setViewMode('history')}
                className={`px-6 py-2 rounded-md font-bold text-sm uppercase tracking-wide transition-all ${viewMode === 'history' ? 'bg-slate-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
             >
                Storico
             </button>
          </div>
        </div>

        <div className="flex gap-4 items-center">
            <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 shadow-inner">
                <span className="text-2xl font-mono text-orange-400 font-bold">
                    {new Date(currentTime).toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}
                </span>
            </div>
            {viewMode === 'history' && (
                <button 
                    onClick={() => {
                        if(confirm('Sei sicuro di voler cancellare definitivamente lo storico degli ordini serviti?')) {
                            clearHistory();
                        }
                    }}
                    className="flex items-center gap-2 bg-red-900/30 hover:bg-red-900/50 text-red-200 px-4 py-2 rounded-lg text-sm transition-colors border border-red-800/50 font-bold uppercase tracking-wide"
                >
                    <Trash2 size={16} /> Svuota Storico
                </button>
            )}
            <button 
                onClick={onExit}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-lg transition-colors border border-red-500 shadow-lg shadow-red-900/20 font-bold flex items-center gap-2"
                title="Esci"
            >
                <LogOut size={20} /> <span className="hidden sm:inline">ESCI</span>
            </button>
        </div>
      </div>

      {/* Grid */}
      {displayedOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-slate-500 min-h-[400px] border-2 border-dashed border-slate-800 rounded-3xl bg-slate-800/20">
          {viewMode === 'active' ? (
             <>
               <UtensilsCrossed className="w-24 h-24 mb-4 opacity-10" />
               <p className="text-2xl font-bold opacity-30 uppercase tracking-widest">Nessun ordine attivo</p>
             </>
          ) : (
             <>
               <History className="w-24 h-24 mb-4 opacity-10" />
               <p className="text-2xl font-bold opacity-30 uppercase tracking-widest">Nessun ordine nello storico</p>
             </>
          )}
        </div>
      ) : (
        // CHANGED: 3 Columns Max for big screens to allow wider cards
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
          {displayedOrders.map((order) => {
             // Live Timer Calculation
             const elapsedMs = currentTime - order.timestamp;
             const elapsedMinutes = Math.floor(elapsedMs / 60000);
             
             // Alarm Logic
             const isLate = viewMode === 'active' && elapsedMinutes >= WARNING_MINUTES && order.status !== OrderStatus.READY;
             const isReady = order.status === OrderStatus.READY;

            // Sort items for display using category priority AND filter out Service items
            const sortedItemsWithIndex = order.items
                .map((item, originalIndex) => ({ item, originalIndex }))
                .filter(({ item }) => categoryConfig[item.menuItem.category]) // Only show Kitchen items
                .sort((a, b) => {
                    const pA = CATEGORY_PRIORITY[a.item.menuItem.category] || 99;
                    const pB = CATEGORY_PRIORITY[b.item.menuItem.category] || 99;
                    return pA - pB;
                });

            if (sortedItemsWithIndex.length === 0) return null; // Should be handled by displayedOrders filter, but double check

            return (
              <div 
                key={order.id} 
                className={`flex flex-col rounded-xl shadow-xl border-t-8 ${getStatusColor(order.status).replace('text', 'border').replace('bg-','border-')} bg-slate-800 text-slate-200 overflow-hidden transform transition-all duration-300 relative
                    ${viewMode === 'active' ? 'hover:-translate-y-1' : 'opacity-75'}
                    ${isReady ? 'ring-2 ring-green-500/50 shadow-green-900/20 opacity-90 scale-[0.98]' : ''}
                    ${isLate ? 'shadow-[0_0_30px_rgba(239,68,68,0.4)] border-red-600 animate-pulse' : ''}
                `}
              >
                {/* Header Card */}
                <div className={`p-4 border-b border-slate-700 flex justify-between items-start 
                    ${isLate ? 'bg-red-900/40' : 'bg-slate-800/50'}
                `}>
                  <div className="flex flex-col">
                    <h2 className="text-4xl font-black text-white leading-none tracking-tight">Tav. {order.tableNumber}</h2>
                    <span className={`inline-block px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wide mt-2 shadow-sm w-fit ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  
                  <div className="text-right flex flex-col items-end gap-2">
                    {/* Active Timer - Massive */}
                    <div className={`flex items-center justify-end gap-1 font-mono text-3xl font-black 
                        ${isLate ? 'text-red-500 animate-pulse' : 'text-slate-300'}
                    `}>
                        {isLate && <Bell size={24} className="animate-swing text-red-500 mr-2" />}
                        {formatDuration(elapsedMs)}
                    </div>
                    
                    {/* Registration Time - High Visibility Badge */}
                    <div className="flex items-center justify-end gap-2 bg-slate-900/60 px-2 py-1 rounded border border-slate-700/50">
                        <Clock size={12} className="text-slate-400"/>
                        <span className="text-slate-300 font-bold font-mono text-sm">
                            {new Date(order.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>

                    {/* Waiter Info */}
                    <div className="flex items-center justify-end gap-1 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                        <User size={10} /> {order.waiterName || 'Staff'}
                    </div>
                  </div>
                </div>

                {/* Body Card */}
                <div className="p-3 flex-1 overflow-y-auto max-h-[400px] bg-slate-900/50">
                  <ul className="space-y-3">
                    {sortedItemsWithIndex.map(({ item, originalIndex }) => (
                      <li 
                        key={`${order.id}-${originalIndex}`} 
                        onClick={() => viewMode === 'active' && handleToggleItem(order.id, originalIndex)}
                        className={`flex justify-between items-start border-b border-dashed border-slate-700 pb-3 last:border-0 transition-all cursor-pointer rounded-lg p-2
                            ${item.completed ? 'bg-green-900/10 opacity-50' : 'hover:bg-slate-800'}
                        `}
                      >
                        <div className="w-full">
                            {/* NEW: AGGIUNTA BADGE */}
                            {item.isAddedLater && (
                                <div className="flex items-center gap-1 mb-1">
                                    <Bell size={12} className="text-blue-400 animate-pulse" />
                                    <span className="text-[9px] font-black text-blue-300 uppercase tracking-wider bg-blue-900/40 px-1.5 rounded border border-blue-500/30">
                                        AGGIUNTA
                                    </span>
                                </div>
                            )}
                            <div className="flex gap-4 items-start w-full">
                                {/* Checkbox and Quantity Group - Aligned with text via top margin */}
                                <div className="flex items-center gap-3 mt-1.5">
                                    <div className={`transition-colors ${item.completed ? 'text-green-500' : 'text-slate-600'}`}>
                                            {item.completed ? <CheckSquare size={32} /> : <Square size={32} />}
                                    </div>
                                    <span className={`font-black text-3xl w-12 h-12 flex items-center justify-center rounded-xl shadow-inner transition-colors shrink-0
                                            ${item.completed ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-white'}
                                    `}>
                                        {item.quantity}
                                    </span>
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    {/* Category Label */}
                                    <p className="text-[10px] text-orange-500 font-bold uppercase tracking-wider mb-0.5">
                                        {item.menuItem.category}
                                    </p>
                                    
                                    {/* DISH NAME - GIANT */}
                                    <p className={`font-black text-4xl leading-[0.9] tracking-tight mb-2 transition-all break-words
                                        ${item.completed ? 'text-slate-600 line-through decoration-4 decoration-green-500/30' : 'text-slate-100'}
                                    `}>
                                        {item.menuItem.name}
                                    </p>
                                    
                                    {item.notes && (
                                        <div className="flex items-start gap-1 mt-1">
                                            <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                                            <p className="text-red-300 text-lg font-bold bg-red-900/20 px-2 rounded border border-red-900/30 leading-tight">
                                                {item.notes}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Footer Action - SLIMMER BANNER */}
                {viewMode === 'active' && (
                    <button
                    onClick={() => advanceStatus(order.id, order.status)}
                    className={`w-full py-3 text-center font-black text-base uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98]
                        ${order.status === OrderStatus.READY 
                            ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-900/20' 
                            : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-900/20'}
                    `}
                    >
                    {order.status === OrderStatus.READY ? (
                        <> <CheckCircle size={18} /> SERVI AL TAVOLO </>
                    ) : (
                        <> AVANZA STATO {order.status === OrderStatus.PENDING && '→ PREPARAZIONE'} {order.status === OrderStatus.COOKING && '→ PRONTO'} </>
                    )}
                    </button>
                )}
                {viewMode === 'history' && (
                     <div className="p-2 bg-slate-800 text-center text-xs text-slate-500 font-mono border-t border-slate-700">
                         COMPLETATO: {new Date(order.timestamp).toLocaleDateString()}
                     </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      <style>{`
        @keyframes slide-down {
            0% { transform: translate(-50%, -100%); opacity: 0; }
            100% { transform: translate(-50%, 0); opacity: 1; }
        }
        .animate-slide-down {
            animation: slide-down 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes swing {
            0% { transform: rotate(0deg); }
            20% { transform: rotate(15deg); }
            40% { transform: rotate(-10deg); }
            60% { transform: rotate(5deg); }
            80% { transform: rotate(-5deg); }
            100% { transform: rotate(0deg); }
        }
        .animate-swing {
            animation: swing 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default KitchenDisplay;