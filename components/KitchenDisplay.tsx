import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Order, OrderStatus, Category, AppSettings } from '../types';
import { getOrders, updateOrderStatus, clearHistory, toggleOrderItemCompletion, getAppSettings } from '../services/storageService';
import { Clock, CheckCircle, ChefHat, Trash2, History, UtensilsCrossed, Bell, User, LogOut, Square, CheckSquare, Coffee, AlertOctagon, Timer, PlusCircle, ArrowRight, Calendar, ChevronLeft, ChevronRight, TrendingUp, DollarSign, BarChart3, Search, Eye, AlertTriangle } from 'lucide-react';

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
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.setValueAtTime(220, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.4);
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
        const interval = setInterval(() => {
            const newElapsed = Math.floor((Date.now() - timestamp) / 60000);
            setElapsed(newElapsed);
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
        icon = <Bell size={16} className="animate-wiggle" />;
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
  
  // Analytics State
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  
  // Reset Confirmation State
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const previousOrdersRef = useRef<Order[]>([]);
  const isFirstLoad = useRef(true);

  const showNotification = (msg: string, type: 'info' | 'success' | 'alert') => {
      setNotification({ msg, type });
      setTimeout(() => setNotification(null), 5000);
  };

  const handleCriticalDelay = (tableNum: string) => {
      playNotificationSound('alert');
  };

  const loadOrders = () => {
    const allOrders = getOrders();
    const sorted = allOrders.sort((a, b) => a.timestamp - b.timestamp);

    if (!isFirstLoad.current) {
        const prevOrders = previousOrdersRef.current;
        const prevOrderIds = prevOrders.map(o => o.id);
        const addedOrders = sorted.filter(o => !prevOrderIds.includes(o.id));
        
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
  const formatDate = (date: Date) => date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING: return 'bg-yellow-100 border-yellow-400 text-yellow-800';
      case OrderStatus.COOKING: return 'bg-orange-100 border-orange-400 text-orange-800';
      case OrderStatus.READY: return 'bg-green-100 border-green-400 text-green-800';
      case OrderStatus.DELIVERED: return 'bg-slate-700 border-slate-500 text-slate-300 opacity-80';
      default: return 'bg-gray-100 border-gray-400';
    }
  };

  // --- ANALYTICS CALCULATIONS ---
  const filteredHistoryOrders = useMemo(() => {
      return orders.filter(o => {
          if (o.status !== OrderStatus.DELIVERED) return false;
          const orderDate = new Date(o.createdAt || o.timestamp);
          return orderDate.getDate() === selectedDate.getDate() &&
                 orderDate.getMonth() === selectedDate.getMonth() &&
                 orderDate.getFullYear() === selectedDate.getFullYear();
      }).sort((a, b) => (b.createdAt || b.timestamp) - (a.createdAt || a.timestamp)); // Newest first
  }, [orders, selectedDate]);

  const stats = useMemo(() => {
      let totalRevenue = 0;
      let totalItems = 0;
      let totalWaitMinutes = 0;
      const hourlyTraffic: Record<number, number> = {};
      const dishCounts: Record<string, {name: string, count: number, revenue: number}> = {};

      filteredHistoryOrders.forEach(order => {
          // Revenue
          const orderTotal = order.items.reduce((acc, i) => acc + (i.menuItem.price * i.quantity), 0);
          totalRevenue += orderTotal;

          // Wait Time
          const start = order.createdAt || order.timestamp;
          const end = order.timestamp;
          if (end > start) {
              totalWaitMinutes += (end - start) / 60000;
          }

          // Hourly Traffic
          const hour = new Date(start).getHours();
          hourlyTraffic[hour] = (hourlyTraffic[hour] || 0) + 1;

          // Dishes
          order.items.forEach(i => {
              totalItems += i.quantity;
              const id = i.menuItem.id;
              if (!dishCounts[id]) dishCounts[id] = { name: i.menuItem.name, count: 0, revenue: 0 };
              dishCounts[id].count += i.quantity;
              dishCounts[id].revenue += i.quantity * i.menuItem.price;
          });
      });

      const avgWait = filteredHistoryOrders.length > 0 ? Math.round(totalWaitMinutes / filteredHistoryOrders.length) : 0;
      const topDishes = Object.values(dishCounts).sort((a, b) => b.count - a.count).slice(0, 5);
      
      // Chart Data Formatting
      const chartHours = Array.from({length: 24}, (_, i) => ({ hour: i, count: hourlyTraffic[i] || 0 }));
      const maxHourly = Math.max(...Object.values(hourlyTraffic), 1);

      return { totalRevenue, totalItems, avgWait, topDishes, chartHours, maxHourly };
  }, [filteredHistoryOrders]);

  const changeDate = (days: number) => {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + days);
      setSelectedDate(newDate);
  };

  const handleConfirmReset = async () => {
      await clearHistory();
      setShowResetConfirm(false);
  };

  // --- RENDER ---
  const displayedOrders = orders.filter(o => viewMode === 'active' && o.status !== OrderStatus.DELIVERED);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans flex flex-col relative overflow-hidden">
      <style>{`
        @keyframes wiggle { 0%, 100% { transform: rotate(-10deg); } 50% { transform: rotate(10deg); } }
        .animate-wiggle { animation: wiggle 0.3s ease-in-out infinite; }
      `}</style>

      {/* NOTIFICATIONS */}
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

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-orange-500 rounded-full flex items-center justify-center"><ChefHat className="w-8 h-8 text-white" /></div>
          <div><h1 className="text-3xl font-bold">Risto<span className="text-orange-500">Sync</span></h1><p className="text-slate-400 text-xs uppercase font-semibold">Kitchen Dashboard</p></div>
          <button onClick={() => loadOrders()} className="ml-4 p-2 rounded-full bg-slate-800 text-slate-500 hover:text-white"><History size={16} /></button>
          <div className="ml-4 flex bg-slate-800 rounded-lg p-1 border border-slate-700">
             <button onClick={() => setViewMode('active')} className={`px-6 py-2 rounded-md font-bold text-sm uppercase ${viewMode === 'active' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>Attivi</button>
             <button onClick={() => setViewMode('history')} className={`px-6 py-2 rounded-md font-bold text-sm uppercase ${viewMode === 'history' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>Analisi & Storico</button>
          </div>
        </div>
        <div className="flex gap-4 items-center">
            <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700"><span className="text-2xl font-mono text-orange-400 font-bold">{new Date().toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}</span></div>
            {viewMode === 'history' && (
                <button onClick={() => setShowResetConfirm(true)} className="bg-red-900/30 text-red-200 px-4 py-2 rounded-lg font-bold uppercase flex gap-2 border border-red-500/20 hover:bg-red-900/50 transition-colors"><Trash2 size={16} /> Svuota</button>
            )}
            <button onClick={onExit} className="bg-slate-800 text-slate-400 hover:text-white p-2.5 rounded-lg"><LogOut size={20} /></button>
        </div>
      </div>

      {/* CONTENT AREA */}
      {viewMode === 'active' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
              {displayedOrders.map((order) => {
                 const currentTime = Date.now();
                 const timeDiffMinutes = Math.floor((currentTime - order.timestamp) / 60000);
                 const isCritical = timeDiffMinutes >= THRESHOLD_CRITICAL && order.status !== OrderStatus.READY && order.status !== OrderStatus.DELIVERED;
                 let borderColor = getStatusColor(order.status).replace('text', 'border').replace('bg-','border-');
                 if (isCritical) borderColor = 'border-red-600 animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.4)]';

                 const visibleItems = order.items
                    .map((item, originalIndex) => ({ item, originalIndex }))
                    .filter(({ item }) => {
                        const dest = appSettings.categoryDestinations[item.menuItem.category];
                        return dest !== 'Sala'; 
                    })
                    .sort((a, b) => (CATEGORY_PRIORITY[a.item.menuItem.category] || 99) - (CATEGORY_PRIORITY[b.item.menuItem.category] || 99));

                 if (visibleItems.length === 0) return null;

                return (
                  <div key={order.id} className={`flex flex-col rounded-xl shadow-2xl border-t-8 ${borderColor} bg-slate-800/95 bg-gradient-to-br from-slate-800 to-slate-900 text-slate-200 overflow-hidden relative hover:-translate-y-1 transition-transform`}>
                    <div className={`p-4 border-b border-slate-700/50 flex justify-between items-start bg-slate-800/50`}>
                      <div>
                          <h2 className="text-3xl font-black bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">Tav. {order.tableNumber}</h2>
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase mt-1 ${getStatusColor(order.status)}`}>{order.status}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex flex-col items-end gap-1 mb-1">
                            <span className="text-[10px] text-slate-400 font-mono bg-slate-800/80 px-1.5 py-0.5 rounded flex items-center gap-1 border border-slate-700">
                                Entrata: <span className="text-white font-bold">{formatTime(order.createdAt || order.timestamp)}</span>
                            </span>
                        </div>
                        <OrderTimer timestamp={order.timestamp} status={order.status} onCritical={() => handleCriticalDelay(order.tableNumber)} />
                        <div className="flex items-center justify-end gap-1 text-slate-500 text-xs font-bold"><User size={12} /> {order.waiterName || 'Staff'}</div>
                      </div>
                    </div>

                    <div className="p-4 flex-1 overflow-y-auto max-h-[300px] bg-slate-900/30">
                      <ul className="space-y-4">
                        {visibleItems.map(({ item, originalIndex }) => (
                          <li key={`${order.id}-${originalIndex}`} onClick={() => handleToggleItem(order.id, originalIndex)} className={`flex justify-between items-start border-b border-dashed border-slate-700 pb-3 last:border-0 rounded-lg p-2 transition-colors ${item.completed ? 'bg-green-900/10 opacity-50' : 'hover:bg-slate-800/50 cursor-pointer'}`}>
                            <div className="w-full">
                                {item.isAddedLater && <div className="flex items-center gap-1 mb-1 bg-blue-600 w-max px-2 py-0.5 rounded-md shadow-sm border border-blue-400"><PlusCircle size={10} className="text-white animate-pulse" /><span className="text-[10px] font-black text-white uppercase tracking-wide">AGGIUNTA</span></div>}
                                <div className="flex gap-4 items-start w-full">
                                    <div className={`pt-1 ${item.completed ? 'text-green-500' : 'text-slate-600'}`}>{item.completed ? <CheckSquare size={28} /> : <Square size={28} />}</div>
                                    <span className={`font-black text-2xl w-10 h-10 flex items-center justify-center rounded-lg shadow-inner ${item.completed ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-white'}`}>{item.quantity}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-[10px] text-orange-500 font-bold uppercase tracking-wider mb-0.5">{item.menuItem.category}</p>
                                        </div>
                                        <p className={`font-black text-3xl leading-none tracking-tight break-words ${item.completed ? 'text-slate-600 line-through' : 'bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent'}`}>{item.menuItem.name}</p>
                                        {item.notes && <p className="text-red-300 text-sm font-bold mt-2 bg-red-900/20 inline-block px-3 py-1 rounded border border-red-900/30 shadow-sm">⚠️ {item.notes}</p>}
                                    </div>
                                </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button onClick={() => advanceStatus(order.id, order.status)} className={`w-full py-5 text-center font-black text-lg uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:brightness-110 ${order.status === OrderStatus.READY ? 'bg-green-600 text-white' : 'bg-orange-500 text-white'}`}>
                        {order.status === OrderStatus.READY ? <><CheckCircle /> SERVI AL TAVOLO</> : <>AVANZA STATO {order.status === OrderStatus.PENDING && '→ PREPARAZIONE'} {order.status === OrderStatus.COOKING && '→ PRONTO'}</>}
                    </button>
                  </div>
                );
              })}
          </div>
      ) : (
          <div className="flex flex-col h-full overflow-hidden">
              {/* DATE SELECTOR & KPI HEADER */}
              <div className="flex flex-col gap-6 mb-6">
                  {/* Date Picker */}
                  <div className="flex items-center justify-between bg-slate-800 rounded-2xl p-2 border border-slate-700 max-w-sm mx-auto shadow-lg w-full">
                      <button onClick={() => changeDate(-1)} className="p-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors"><ChevronLeft size={20}/></button>
                      <div className="flex items-center gap-2 text-white font-bold text-lg uppercase tracking-wider"><Calendar size={20} className="text-orange-500"/> {formatDate(selectedDate)}</div>
                      <button onClick={() => changeDate(1)} className="p-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors"><ChevronRight size={20}/></button>
                  </div>

                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gradient-to-br from-green-900/40 to-slate-800 p-4 rounded-2xl border border-green-500/20 flex flex-col items-center justify-center relative overflow-hidden">
                          <div className="absolute top-2 right-2 text-green-500 opacity-20"><DollarSign size={40}/></div>
                          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Incasso Stimato</p>
                          <p className="text-3xl font-black text-white">€ {stats.totalRevenue.toFixed(2)}</p>
                      </div>
                      <div className="bg-gradient-to-br from-blue-900/40 to-slate-800 p-4 rounded-2xl border border-blue-500/20 flex flex-col items-center justify-center relative overflow-hidden">
                          <div className="absolute top-2 right-2 text-blue-500 opacity-20"><UtensilsCrossed size={40}/></div>
                          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Piatti Venduti</p>
                          <p className="text-3xl font-black text-white">{stats.totalItems}</p>
                      </div>
                      <div className="bg-gradient-to-br from-orange-900/40 to-slate-800 p-4 rounded-2xl border border-orange-500/20 flex flex-col items-center justify-center relative overflow-hidden">
                          <div className="absolute top-2 right-2 text-orange-500 opacity-20"><History size={40}/></div>
                          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Tempo Medio Servizio</p>
                          <p className="text-3xl font-black text-white">{stats.avgWait} <span className="text-sm font-medium text-slate-400">min</span></p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-900/40 to-slate-800 p-4 rounded-2xl border border-purple-500/20 flex flex-col items-center justify-center relative overflow-hidden">
                          <div className="absolute top-2 right-2 text-purple-500 opacity-20"><TrendingUp size={40}/></div>
                          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Comande Totali</p>
                          <p className="text-3xl font-black text-white">{filteredHistoryOrders.length}</p>
                      </div>
                  </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">
                  {/* LEFT: CHARTS */}
                  <div className="lg:w-1/3 flex flex-col gap-6 overflow-y-auto pr-2 no-scrollbar">
                      {/* HOURLY TREND */}
                      <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2"><BarChart3 size={16} className="text-orange-500"/> Flusso Orario</h3>
                          <div className="flex items-end gap-1 h-32 w-full">
                              {stats.chartHours.map((h, i) => {
                                  // Simplified hours: 11-15 (Lunch) and 18-24 (Dinner)
                                  if (h.hour < 11 || (h.hour > 15 && h.hour < 18)) return null; 
                                  const height = h.count > 0 ? (h.count / stats.maxHourly) * 100 : 0;
                                  return (
                                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                                          <div className="w-full bg-blue-600/30 rounded-t-sm relative transition-all group-hover:bg-blue-500" style={{ height: `${height}%` }}>
                                              {h.count > 0 && <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity border border-slate-600">{h.count}</div>}
                                          </div>
                                          <span className="text-[9px] text-slate-500 font-mono">{h.hour}</span>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>

                      {/* BEST SELLERS */}
                      <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 flex-1">
                          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-green-500"/> Top 5 Piatti</h3>
                          <div className="space-y-4">
                              {stats.topDishes.map((d, i) => (
                                  <div key={i} className="relative">
                                      <div className="flex justify-between text-xs font-bold text-white mb-1 relative z-10">
                                          <span>{d.name}</span>
                                          <span>{d.count} ordini</span>
                                      </div>
                                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                          <div className="h-full bg-gradient-to-r from-orange-500 to-yellow-500" style={{ width: `${(d.count / (stats.topDishes[0]?.count || 1)) * 100}%` }}></div>
                                      </div>
                                  </div>
                              ))}
                              {stats.topDishes.length === 0 && <p className="text-slate-500 text-xs italic">Nessun dato disponibile</p>}
                          </div>
                      </div>
                  </div>

                  {/* RIGHT: ORDERS LIST TABLE */}
                  <div className="flex-1 bg-slate-800 rounded-2xl border border-slate-700 flex flex-col overflow-hidden">
                      <div className="p-4 border-b border-slate-700 bg-slate-800/90 backdrop-blur-sm sticky top-0 flex justify-between items-center">
                          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Storico Comande</h3>
                          {filteredHistoryOrders.length > 0 && <button onClick={() => setShowResetConfirm(true)} className="text-xs bg-red-900/30 text-red-200 px-3 py-1.5 rounded-lg font-bold uppercase flex gap-1 items-center hover:bg-red-900/50"><Trash2 size={12} /> Reset</button>}
                      </div>
                      
                      <div className="flex-1 overflow-auto">
                          <table className="w-full text-left border-collapse">
                              <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-bold sticky top-0 z-10">
                                  <tr>
                                      <th className="p-3">Ora</th>
                                      <th className="p-3">Tavolo</th>
                                      <th className="p-3">Staff</th>
                                      <th className="p-3">Contenuto</th>
                                      <th className="p-3 text-right">Totale</th>
                                      <th className="p-3 text-center">Info</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-700/50 text-sm">
                                  {filteredHistoryOrders.map((order) => {
                                      const orderTotal = order.items.reduce((acc, i) => acc + (i.menuItem.price * i.quantity), 0);
                                      const displayTable = order.tableNumber.replace('_HISTORY', '');
                                      
                                      return (
                                          <tr key={order.id} onClick={() => setDetailOrder(order)} className="hover:bg-slate-700/30 transition-colors cursor-pointer group">
                                              <td className="p-3 font-mono text-slate-400">
                                                  <div className="flex flex-col">
                                                      <span>IN: {formatTime(order.createdAt || order.timestamp)}</span>
                                                      <span className="text-green-500">OUT: {formatTime(order.timestamp)}</span>
                                                  </div>
                                              </td>
                                              <td className="p-3 font-bold text-white text-lg">{displayTable}</td>
                                              <td className="p-3 text-slate-300">{order.waiterName || '-'}</td>
                                              <td className="p-3 text-slate-400 text-xs">
                                                  {order.items.length} articoli
                                                  <span className="block text-[10px] text-slate-500 truncate max-w-[150px]">{order.items.map(i => i.menuItem.name).join(', ')}</span>
                                              </td>
                                              <td className="p-3 text-right font-mono font-bold text-green-400">€ {orderTotal.toFixed(2)}</td>
                                              <td className="p-3 text-center">
                                                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors mx-auto">
                                                      <Eye size={16}/>
                                                  </div>
                                              </td>
                                          </tr>
                                      );
                                  })}
                                  {filteredHistoryOrders.length === 0 && (
                                      <tr><td colSpan={6} className="p-8 text-center text-slate-500 italic">Nessuna comanda registrata in questa data.</td></tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* RESET CONFIRM MODAL */}
      {showResetConfirm && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
              <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-slide-up">
                  <div className="flex flex-col items-center text-center mb-6">
                      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20 text-red-500">
                          <AlertTriangle size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Eliminare Tutto lo Storico?</h3>
                      <p className="text-slate-400 text-sm">
                          Stai per cancellare definitivamente tutte le comande archiviate. 
                          <br/><br/>
                          <span className="text-red-400 font-bold">ATTENZIONE:</span> I dati statistici (incassi, tempi, grafici) verranno azzerati. Questa operazione è irreversibile.
                      </p>
                  </div>
                  <div className="flex gap-3">
                      <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors">Annulla</button>
                      <button onClick={handleConfirmReset} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-600/20">ELIMINA DATI</button>
                  </div>
              </div>
          </div>
      )}

      {/* DETAIL MODAL */}
      {detailOrder && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setDetailOrder(null)}>
              <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                  <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center">
                      <div>
                          <h3 className="text-white font-bold text-lg">Dettaglio Tavolo {detailOrder.tableNumber.replace('_HISTORY', '')}</h3>
                          <p className="text-slate-400 text-xs">{formatDate(new Date(detailOrder.createdAt || detailOrder.timestamp))} • {formatTime(detailOrder.createdAt || detailOrder.timestamp)}</p>
                      </div>
                      <button onClick={() => setDetailOrder(null)} className="p-2 bg-slate-700 rounded-full hover:bg-slate-600"><Trash2 size={16} className="opacity-0"/> <span className="sr-only">Chiudi</span><ArrowRight size={20}/></button>
                  </div>
                  <div className="p-4 max-h-[60vh] overflow-y-auto">
                      <ul className="space-y-3">
                          {detailOrder.items.map((item, i) => (
                              <li key={i} className="flex justify-between items-start border-b border-slate-800 pb-2 last:border-0">
                                  <div className="flex gap-3">
                                      <span className="font-bold text-orange-500">{item.quantity}x</span>
                                      <div>
                                          <p className="text-white font-medium">{item.menuItem.name}</p>
                                          {item.notes && <p className="text-xs text-red-400 italic mt-0.5">Note: {item.notes}</p>}
                                      </div>
                                  </div>
                                  <span className="font-mono text-slate-400">€ {(item.menuItem.price * item.quantity).toFixed(2)}</span>
                              </li>
                          ))}
                      </ul>
                  </div>
                  <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
                      <span className="text-slate-400 font-bold uppercase text-sm">Totale Comanda</span>
                      <span className="text-2xl font-black text-green-500">€ {detailOrder.items.reduce((acc, i) => acc + (i.menuItem.price * i.quantity), 0).toFixed(2)}</span>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default KitchenDisplay;