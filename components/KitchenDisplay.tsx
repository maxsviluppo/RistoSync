import React, { useEffect, useState, useRef } from 'react';
import { Order, OrderStatus, Category, AppSettings } from '../types';
import { getOrders, updateOrderStatus, clearHistory, toggleOrderItemCompletion, getAppSettings } from '../services/storageService';
import { Clock, CheckCircle, ChefHat, Trash2, History, UtensilsCrossed, Bell, User, LogOut, Square, CheckSquare, Coffee, AlertOctagon, Timer, PlusCircle } from 'lucide-react';

const CATEGORY_PRIORITY: Record<Category, number> = {
    [Category.ANTIPASTI]: 1,
    [Category.PRIMI]: 2,
    [Category.SECONDI]: 3,
    [Category.DOLCI]: 4,
    [Category.BEVANDE]: 5
};

// Configurazione Soglie Ritardo (minuti)
const THRESHOLD_WARNING = 15;
const THRESHOLD_CRITICAL = 25;

const playNotificationSound = (type: 'new' | 'ready' | 'alert') => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'new') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(554, now + 0.1); 
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        } else if (type === 'ready') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.1); 
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1);
            osc.start();
            osc.stop(now + 1);
        } else if (type === 'alert') {
            // Suono di allarme ritardo (Doppio beep grave)
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.setValueAtTime(220, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.4);
            
            // Secondo beep
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sawtooth';
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.setValueAtTime(220, now + 0.5);
            gain2.gain.setValueAtTime(0.1, now + 0.5);
            gain2.gain.linearRampToValueAtTime(0, now + 0.9);

            osc.start();
            osc.stop(now + 0.4);
            osc2.start(now + 0.5);
            osc2.stop(now + 0.9);
        }
    } catch (e) { console.error("Audio error", e); }
};

// --- SUB-COMPONENT: ORDER TIMER ---
const OrderTimer: React.FC<{ timestamp: number; status: OrderStatus; onCritical: () => void }> = ({ timestamp, status, onCritical }) => {
    const [elapsed, setElapsed] = useState(Math.floor((Date.now() - timestamp) / 60000));

    useEffect(() => {
        // Aggiorna ogni 30 secondi per risparmiare risorse ma mantenere precisione display
        const interval = setInterval(() => {
            const newElapsed = Math.floor((Date.now() - timestamp) / 60000);
            setElapsed(newElapsed);
            
            // Trigger allarme solo se passa esattamente la soglia critica mentre il componente è montato
            if (newElapsed === THRESHOLD_CRITICAL && status !== OrderStatus.READY && status !== OrderStatus.DELIVERED) {
                onCritical();
            }
        }, 30000); 
        return () => clearInterval(interval);
    }, [timestamp, status, onCritical]);

    if (status === OrderStatus.READY || status === OrderStatus.DELIVERED) {
        return <div className="text-green-400 font-bold text-sm flex items-center gap-1"><CheckCircle size={14}/> Completato</div>;
    }

    let colorClass = "text-slate-400";
    let bgClass = "bg-slate-700";
    let icon = <Timer size={14} />;
    let label = "In corso";
    let animate = "";

    if (elapsed >= THRESHOLD_CRITICAL) {
        colorClass = "text-white";
        bgClass = "bg-red-600 border border-red-400 shadow-[0_0_10px_rgba(220,38,38,0.5)]";
        icon = <Bell size={16} className="animate-wiggle" />; // Campanella che trema
        label = "RITARDO CRITICO";
        animate = "animate-pulse";
    } else if (elapsed >= THRESHOLD_WARNING) {
        colorClass = "text-slate-900";
        bgClass = "bg-orange-400 border border-orange-500";
        icon = <AlertOctagon size={14} />;
        label = "RITARDO";
    }

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors duration-500 ${bgClass} ${animate}`}>
            <span className={`${colorClass} ${elapsed >= THRESHOLD_CRITICAL ? 'animate-wiggle' : ''}`}>{icon}</span>
            <div className="flex flex-col leading-none">
                <span className={`text-[9px] font-black uppercase ${colorClass} opacity-80`}>{label}</span>
                <span className={`text-sm font-black font-mono ${colorClass}`}>{elapsed} min</span>
            </div>
        </div>
    );
};

interface KitchenDisplayProps {
    onExit: () => void;
}

const KitchenDisplay: React.FC<KitchenDisplayProps> = ({ onExit }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [appSettings, setAppSettings] = useState<AppSettings>(getAppSettings());
  const [notification, setNotification] = useState<{msg: string, type: 'info' | 'success' | 'alert'} | null>(null);
  
  const previousOrdersRef = useRef<Order[]>([]);
  const isFirstLoad = useRef(true);

  const showNotification = (msg: string, type: 'info' | 'success' | 'alert') => {
      setNotification({ msg, type });
      setTimeout(() => setNotification(null), 5000);
  };

  const handleCriticalDelay = (tableNum: string) => {
      // Evita spam di suoni se già in corso
      playNotificationSound('alert');
      // showNotification(`RITARDO CRITICO: Tavolo ${tableNum}`, 'alert'); // Opzionale, magari troppo invasivo
  };

  const loadOrders = () => {
    const allOrders = getOrders();
    const sorted = allOrders.sort((a, b) => a.timestamp - b.timestamp);

    if (!isFirstLoad.current) {
        const prevOrders = previousOrdersRef.current;
        const prevOrderIds = prevOrders.map(o => o.id);
        const addedOrders = sorted.filter(o => !prevOrderIds.includes(o.id));
        
        // NOTIFY ONLY FOR KITCHEN ITEMS
        const hasKitchenItems = addedOrders.some(order => 
            order.items.some(item => {
                const dest = appSettings.categoryDestinations[item.menuItem.category];
                return dest !== 'Sala'; 
            })
        );

        if (hasKitchenItems) {
            playNotificationSound('new');
            showNotification(`Nuovo Ordine: Tavolo ${addedOrders[0].tableNumber}`, 'info');
        }

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
    const handleStorageChange = (e: StorageEvent) => { if (e.key === 'ristosync_orders') loadOrders(); };
    const handleLocalUpdate = () => loadOrders();
    const handleSettingsUpdate = () => { setAppSettings(getAppSettings()); loadOrders(); };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage-update', handleLocalUpdate);
    window.addEventListener('local-settings-update', handleSettingsUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-update', handleLocalUpdate);
      window.removeEventListener('local-settings-update', handleSettingsUpdate);
    };
  }, [appSettings]); 

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

  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING: return 'bg-yellow-100 border-yellow-400 text-yellow-800';
      case OrderStatus.COOKING: return 'bg-orange-100 border-orange-400 text-orange-800';
      case OrderStatus.READY: return 'bg-green-100 border-green-400 text-green-800';
      case OrderStatus.DELIVERED: return 'bg-slate-700 border-slate-500 text-slate-300 opacity-80';
      default: return 'bg-gray-100 border-gray-400';
    }
  };

  const displayedOrders = orders.filter(o => viewMode === 'active' ? true : o.status === OrderStatus.DELIVERED);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans flex flex-col relative overflow-hidden">
      <style>{`
        @keyframes wiggle { 0%, 100% { transform: rotate(-10deg); } 50% { transform: rotate(10deg); } }
        .animate-wiggle { animation: wiggle 0.3s ease-in-out infinite; }
      `}</style>

      {notification && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-down border-2 
            ${notification.type === 'success' ? 'bg-green-600 border-green-400' : 
              notification.type === 'alert' ? 'bg-red-600 border-red-400 animate-pulse' : 
              'bg-blue-600 border-blue-400'}`}>
            {notification.type === 'success' ? <CheckCircle size={32} className="animate-bounce" /> : 
             notification.type === 'alert' ? <Bell size={32} className="animate-wiggle" /> : 
             <Bell size={32} className="animate-swing" />}
            <div>
                <h3 className="font-black text-2xl uppercase">
                    {notification.type === 'success' ? 'ORDINE PRONTO' : 
                     notification.type === 'alert' ? 'ATTENZIONE RITARDO' : 
                     'NUOVO ORDINE'}
                </h3>
                <p className="font-medium text-lg">{notification.msg}</p>
            </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-orange-500 rounded-full flex items-center justify-center"><ChefHat className="w-8 h-8 text-white" /></div>
          <div><h1 className="text-3xl font-bold">Risto<span className="text-orange-500">Sync</span></h1><p className="text-slate-400 text-xs uppercase font-semibold">Kitchen Dashboard</p></div>
          <button onClick={() => loadOrders()} className="ml-4 p-2 rounded-full bg-slate-800 text-slate-500 hover:text-white"><History size={16} /></button>
          <div className="ml-4 flex bg-slate-800 rounded-lg p-1 border border-slate-700">
             <button onClick={() => setViewMode('active')} className={`px-6 py-2 rounded-md font-bold text-sm uppercase ${viewMode === 'active' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>Attivi</button>
             <button onClick={() => setViewMode('history')} className={`px-6 py-2 rounded-md font-bold text-sm uppercase ${viewMode === 'history' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>Storico</button>
          </div>
        </div>
        <div className="flex gap-4 items-center">
            <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700"><span className="text-2xl font-mono text-orange-400 font-bold">{new Date().toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}</span></div>
            {viewMode === 'history' && <button onClick={() => { if(confirm('Svuotare lo storico?')) clearHistory(); }} className="bg-red-900/30 text-red-200 px-4 py-2 rounded-lg font-bold uppercase flex gap-2"><Trash2 size={16} /> Svuota</button>}
            <button onClick={onExit} className="bg-slate-800 text-slate-400 hover:text-white p-2.5 rounded-lg"><LogOut size={20} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
          {displayedOrders.map((order) => {
             const currentTime = Date.now();
             const timeDiffMinutes = Math.floor((currentTime - order.timestamp) / 60000);
             
             // Is Critical? (>25 mins and not ready)
             const isCritical = viewMode === 'active' && timeDiffMinutes >= THRESHOLD_CRITICAL && order.status !== OrderStatus.READY && order.status !== OrderStatus.DELIVERED;
             
             // Dynamic border color based on timer
             let borderColor = getStatusColor(order.status).replace('text', 'border').replace('bg-','border-');
             if (isCritical) borderColor = 'border-red-600 animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.4)]';

             // FILTER: Remove items destined for Sala
             const kitchenItemsWithIndex = order.items
                .map((item, originalIndex) => ({ item, originalIndex }))
                .filter(({ item }) => {
                    const dest = appSettings.categoryDestinations[item.menuItem.category];
                    return dest !== 'Sala'; 
                })
                .sort((a, b) => (CATEGORY_PRIORITY[a.item.menuItem.category] || 99) - (CATEGORY_PRIORITY[b.item.menuItem.category] || 99));

             if (kitchenItemsWithIndex.length === 0) return null;

            return (
              <div key={order.id} className={`flex flex-col rounded-xl shadow-2xl border-t-8 ${borderColor} bg-slate-800/95 bg-gradient-to-br from-slate-800 to-slate-900 text-slate-200 overflow-hidden relative ${viewMode === 'active' ? 'hover:-translate-y-1 transition-transform' : 'opacity-75'}`}>
                <div className={`p-4 border-b border-slate-700/50 flex justify-between items-start bg-slate-800/50`}>
                  <div>
                      <h2 className="text-3xl font-black bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">Tav. {order.tableNumber}</h2>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase mt-1 ${getStatusColor(order.status)}`}>{order.status}</span>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {/* NEW TIMER COMPONENT */}
                    {viewMode === 'active' && (
                        <OrderTimer 
                            timestamp={order.timestamp} 
                            status={order.status} 
                            onCritical={() => handleCriticalDelay(order.tableNumber)}
                        />
                    )}
                    <div className="flex items-center justify-end gap-1 text-slate-500 text-xs font-bold"><User size={12} /> {order.waiterName || 'Staff'}</div>
                  </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto max-h-[300px] bg-slate-900/30">
                  <ul className="space-y-4">
                    {kitchenItemsWithIndex.map(({ item, originalIndex }) => (
                      <li key={`${order.id}-${originalIndex}`} onClick={() => viewMode === 'active' && order.status !== OrderStatus.DELIVERED && handleToggleItem(order.id, originalIndex)} className={`flex justify-between items-start border-b border-dashed border-slate-700 pb-3 last:border-0 rounded-lg p-2 transition-colors ${item.completed ? 'bg-green-900/10 opacity-50' : 'hover:bg-slate-800/50 cursor-pointer'}`}>
                        <div className="w-full">
                            {item.isAddedLater && order.status !== OrderStatus.DELIVERED && <div className="flex items-center gap-1 mb-1 bg-blue-600 w-max px-2 py-0.5 rounded-md shadow-sm border border-blue-400"><PlusCircle size={10} className="text-white animate-pulse" /><span className="text-[10px] font-black text-white uppercase tracking-wide">AGGIUNTA</span></div>}
                            <div className="flex gap-4 items-start w-full">
                                <div className={`pt-1 ${item.completed ? 'text-green-500' : 'text-slate-600'}`}>{item.completed ? <CheckSquare size={28} /> : <Square size={28} />}</div>
                                <span className={`font-black text-2xl w-10 h-10 flex items-center justify-center rounded-lg shadow-inner ${item.completed ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-white'}`}>{item.quantity}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-orange-500 font-bold uppercase tracking-wider mb-0.5">{item.menuItem.category}</p>
                                    <p className={`font-black text-3xl leading-none tracking-tight break-words ${item.completed ? 'text-slate-600 line-through' : 'bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent'}`}>{item.menuItem.name}</p>
                                    {item.notes && <p className="text-red-300 text-sm font-bold mt-2 bg-red-900/20 inline-block px-3 py-1 rounded border border-red-900/30 shadow-sm">⚠️ {item.notes}</p>}
                                </div>
                            </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {viewMode === 'active' && (
                    <button onClick={() => advanceStatus(order.id, order.status)} className={`w-full py-5 text-center font-black text-lg uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:brightness-110 ${order.status === OrderStatus.READY ? 'bg-green-600 text-white' : 'bg-orange-500 text-white'}`}>
                        {order.status === OrderStatus.READY ? <><CheckCircle /> SERVI AL TAVOLO</> : <>AVANZA STATO {order.status === OrderStatus.PENDING && '→ PREPARAZIONE'} {order.status === OrderStatus.COOKING && '→ PRONTO'}</>}
                    </button>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default KitchenDisplay;