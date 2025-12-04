import React, { useEffect, useState, useRef } from 'react';
import { Order, OrderStatus } from '../types';
import { getOrders, updateOrderStatus, clearHistory } from '../services/storageService';
import { Clock, CheckCircle, ChefHat, Trash2, History, UtensilsCrossed, Bell } from 'lucide-react';

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

const KitchenDisplay: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  
  // Notification State
  const [notification, setNotification] = useState<{msg: string, type: 'info' | 'success'} | null>(null);
  
  // Refs for change detection
  const previousOrdersRef = useRef<Order[]>([]);
  const isFirstLoad = useRef(true);

  const showNotification = (msg: string, type: 'info' | 'success') => {
      setNotification({ msg, type });
      setTimeout(() => setNotification(null), 4000);
  };

  const loadOrders = () => {
    const allOrders = getOrders();
    // Sort by time: oldest first
    const sorted = allOrders.sort((a, b) => a.timestamp - b.timestamp);

    // --- CHANGE DETECTION LOGIC ---
    if (!isFirstLoad.current) {
        const prevOrders = previousOrdersRef.current;
        
        // 1. Detect NEW Orders
        const newOrderIds = sorted.map(o => o.id);
        const prevOrderIds = prevOrders.map(o => o.id);
        const addedOrders = sorted.filter(o => !prevOrderIds.includes(o.id));
        
        if (addedOrders.length > 0) {
            playNotificationSound('new');
            showNotification(`Nuovo Ordine: Tavolo ${addedOrders[0].tableNumber}`, 'info');
        }

        // 2. Detect STATUS Changes to READY
        sorted.forEach(newOrder => {
            const oldOrder = prevOrders.find(o => o.id === newOrder.id);
            if (oldOrder && oldOrder.status !== OrderStatus.READY && newOrder.status === OrderStatus.READY) {
                playNotificationSound('ready');
                showNotification(`Tavolo ${newOrder.tableNumber} è PRONTO!`, 'success');
            }
        });
    }

    if (isFirstLoad.current) isFirstLoad.current = false;
    previousOrdersRef.current = sorted;
    setOrders(sorted);
  };

  useEffect(() => {
    loadOrders();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ristosync_orders') loadOrders();
    };
    const handleLocalUpdate = () => loadOrders();

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage-update', handleLocalUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-update', handleLocalUpdate);
    };
  }, []);

  const advanceStatus = (orderId: string, currentStatus: OrderStatus) => {
    let nextStatus = currentStatus;
    if (currentStatus === OrderStatus.PENDING) nextStatus = OrderStatus.COOKING;
    else if (currentStatus === OrderStatus.COOKING) nextStatus = OrderStatus.READY;
    else if (currentStatus === OrderStatus.READY) nextStatus = OrderStatus.DELIVERED;

    updateOrderStatus(orderId, nextStatus);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
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

  // Filter orders based on view mode
  const displayedOrders = orders.filter(o => 
    viewMode === 'active' 
      ? o.status !== OrderStatus.DELIVERED 
      : o.status === OrderStatus.DELIVERED
  );

  // Reverse history to show newest first
  if (viewMode === 'history') {
      displayedOrders.reverse();
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans flex flex-col relative overflow-hidden">
      
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
      <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20">
             <ChefHat className="w-8 h-8 text-white" />
          </div>
          <div>
              <h1 className="text-3xl font-bold tracking-tight leading-none">CUCINA</h1>
              <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold">Dashboard</p>
          </div>
          
          {/* Tabs */}
          <div className="ml-8 flex bg-slate-800 rounded-lg p-1 border border-slate-700">
             <button 
                onClick={() => setViewMode('active')}
                className={`px-6 py-2 rounded-md font-bold text-sm uppercase tracking-wide transition-all ${viewMode === 'active' ? 'bg-slate-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
             >
                In Corso <span className="ml-2 bg-orange-500 text-white px-2 py-0.5 rounded-full text-xs">{orders.filter(o => o.status !== OrderStatus.DELIVERED).length}</span>
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
                    {new Date().toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
          {displayedOrders.map((order) => {
             const timeDiff = Math.floor((Date.now() - order.timestamp) / 60000);
             const isLate = viewMode === 'active' && timeDiff > 15 && order.status !== OrderStatus.READY;
             const isReady = order.status === OrderStatus.READY;

            return (
              <div 
                key={order.id} 
                className={`flex flex-col rounded-xl shadow-xl border-t-8 ${getStatusColor(order.status).replace('text', 'border').replace('bg-','border-')} bg-slate-800 text-slate-200 overflow-hidden transform transition-all duration-300 relative
                    ${viewMode === 'active' ? 'hover:-translate-y-1' : 'opacity-75'}
                    ${isReady ? 'ring-2 ring-green-500/50 shadow-green-900/20' : ''}
                `}
              >
                {/* Header Card */}
                <div className={`p-4 border-b border-slate-700 flex justify-between items-start bg-slate-800/50`}>
                  <div>
                    <h2 className="text-3xl font-black text-white">Tav. {order.tableNumber}</h2>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide mt-1 shadow-sm ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-slate-400 font-mono text-lg font-bold">
                        <Clock size={18} />
                        {formatTime(order.timestamp)}
                    </div>
                    {isLate && <div className="text-red-500 font-bold text-xs mt-1 animate-pulse bg-red-900/30 px-2 rounded">RITARDO {timeDiff}m</div>}
                  </div>
                </div>

                {/* Body Card */}
                <div className="p-4 flex-1 overflow-y-auto max-h-[300px] bg-slate-900/50">
                  <ul className="space-y-3">
                    {order.items.map((item, idx) => (
                      <li key={idx} className="flex justify-between items-start border-b border-dashed border-slate-700 pb-3 last:border-0">
                        <div className="flex gap-3">
                           <span className="font-black text-xl w-8 h-8 flex items-center justify-center bg-slate-700 rounded-lg text-white shadow-inner">
                             {item.quantity}
                           </span>
                           <div>
                               <p className="font-bold text-lg leading-tight text-slate-200">{item.menuItem.name}</p>
                               {item.notes && (
                                   <p className="text-red-300 text-sm font-bold mt-1 bg-red-900/20 inline-block px-2 py-0.5 rounded border border-red-900/30">
                                       ⚠️ {item.notes}
                                   </p>
                               )}
                           </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Footer Action */}
                {viewMode === 'active' && (
                    <button
                    onClick={() => advanceStatus(order.id, order.status)}
                    className={`w-full py-5 text-center font-black text-lg uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98]
                        ${order.status === OrderStatus.READY ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}
                    `}
                    >
                    {order.status === OrderStatus.READY ? (
                        <> <CheckCircle /> SERVI AL TAVOLO </>
                    ) : (
                        <> AVANZA STATO {order.status === OrderStatus.PENDING && '→ PREPARAZIONE'} {order.status === OrderStatus.COOKING && '→ PRONTO'} </>
                    )}
                    </button>
                )}
                {viewMode === 'history' && (
                     <div className="p-2 bg-slate-800 text-center text-xs text-slate-500 font-mono border-t border-slate-700">
                         COMPLETATO alle {formatTime(order.timestamp + 1000 * 60 * 20)} {/* Simulated time */}
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