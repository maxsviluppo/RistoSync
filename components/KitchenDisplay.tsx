import React, { useEffect, useState, useRef } from 'react';
import { Order, OrderStatus, Category, AppSettings } from '../types';
import { getOrders, updateOrderStatus, clearHistory, toggleOrderItemCompletion, getAppSettings } from '../services/storageService';
import { Clock, CheckCircle, ChefHat, Trash2, History, UtensilsCrossed, Bell, User, LogOut, Square, CheckSquare, Coffee } from 'lucide-react';

const CATEGORY_PRIORITY: Record<Category, number> = {
    [Category.ANTIPASTI]: 1,
    [Category.PRIMI]: 2,
    [Category.SECONDI]: 3,
    [Category.DOLCI]: 4,
    [Category.BEVANDE]: 5
};

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
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.setValueAtTime(554, ctx.currentTime + 0.1); 
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } else {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1); 
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
            osc.start();
            osc.stop(ctx.currentTime + 1);
        }
    } catch (e) { console.error("Audio error", e); }
};

interface KitchenDisplayProps {
    onExit: () => void;
}

const KitchenDisplay: React.FC<KitchenDisplayProps> = ({ onExit }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [appSettings, setAppSettings] = useState<AppSettings>(getAppSettings());
  const [notification, setNotification] = useState<{msg: string, type: 'info' | 'success'} | null>(null);
  
  const previousOrdersRef = useRef<Order[]>([]);
  const isFirstLoad = useRef(true);

  const showNotification = (msg: string, type: 'info' | 'success') => {
      setNotification({ msg, type });
      setTimeout(() => setNotification(null), 4000);
  };

  const loadOrders = () => {
    const allOrders = getOrders();
    const sorted = allOrders.sort((a, b) => a.timestamp - b.timestamp);

    if (!isFirstLoad.current) {
        const prevOrders = previousOrdersRef.current;
        const newOrderIds = sorted.map(o => o.id);
        const prevOrderIds = prevOrders.map(o => o.id);
        const addedOrders = sorted.filter(o => !prevOrderIds.includes(o.id));
        
        // NOTIFY ONLY FOR KITCHEN ITEMS
        const hasKitchenItems = addedOrders.some(order => 
            order.items.some(item => {
                const dest = appSettings.categoryDestinations[item.menuItem.category];
                return dest !== 'Sala'; // Default to Kitchen if undefined
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
  }, [appSettings]); // Re-run when settings change

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
      {notification && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-down border-2 ${notification.type === 'success' ? 'bg-green-600 border-green-400' : 'bg-blue-600 border-blue-400'}`}>
            {notification.type === 'success' ? <CheckCircle size={32} className="animate-bounce" /> : <Bell size={32} className="animate-swing" />}
            <div><h3 className="font-black text-2xl uppercase">{notification.type === 'success' ? 'ORDINE PRONTO' : 'NUOVO ORDINE'}</h3><p className="font-medium text-lg">{notification.msg}</p></div>
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
             const timeDiff = Math.floor((Date.now() - order.timestamp) / 60000);
             const isLate = viewMode === 'active' && timeDiff > 15 && order.status !== OrderStatus.READY && order.status !== OrderStatus.DELIVERED;
             
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
              <div key={order.id} className={`flex flex-col rounded-xl shadow-xl border-t-8 ${getStatusColor(order.status).replace('text', 'border').replace('bg-','border-')} bg-slate-800 text-slate-200 overflow-hidden relative ${viewMode === 'active' ? 'hover:-translate-y-1 transition-transform' : 'opacity-75'}`}>
                <div className={`p-4 border-b border-slate-700 flex justify-between items-start bg-slate-800/50`}>
                  <div><h2 className="text-3xl font-black text-white">Tav. {order.tableNumber}</h2><span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase mt-1 ${getStatusColor(order.status)}`}>{order.status}</span></div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1 text-slate-400 font-mono text-lg font-bold"><Clock size={18} />{formatTime(order.timestamp)}</div>
                    <div className="flex items-center justify-end gap-1 text-slate-500 text-xs mt-1 font-bold"><User size={12} /> {order.waiterName || 'Staff'}</div>
                    {isLate && <div className="text-red-500 font-bold text-xs mt-1 animate-pulse bg-red-900/30 px-2 rounded">RITARDO {timeDiff}m</div>}
                  </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto max-h-[300px] bg-slate-900/50">
                  <ul className="space-y-3">
                    {kitchenItemsWithIndex.map(({ item, originalIndex }) => (
                      <li key={`${order.id}-${originalIndex}`} onClick={() => viewMode === 'active' && order.status !== OrderStatus.DELIVERED && handleToggleItem(order.id, originalIndex)} className={`flex justify-between items-start border-b border-dashed border-slate-700 pb-3 last:border-0 rounded-lg p-2 ${item.completed ? 'bg-green-900/10 opacity-50' : 'hover:bg-slate-800 cursor-pointer'}`}>
                        <div className="w-full">
                            {item.isAddedLater && order.status !== OrderStatus.DELIVERED && <div className="flex items-center gap-1 mb-1"><Bell size={12} className="text-blue-400 animate-pulse" /><span className="text-[9px] font-black text-blue-300 uppercase bg-blue-900/40 px-1.5 rounded">AGGIUNTA</span></div>}
                            <div className="flex gap-3 items-center w-full">
                                <div className={item.completed ? 'text-green-500' : 'text-slate-600'}>{item.completed ? <CheckSquare size={24} /> : <Square size={24} />}</div>
                                <span className={`font-black text-xl w-8 h-8 flex items-center justify-center rounded-lg shadow-inner mt-1 ${item.completed ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-white'}`}>{item.quantity}</span>
                                <div className="flex-1">
                                    <p className="text-[10px] text-orange-500 font-bold uppercase tracking-wider mb-0.5">{item.menuItem.category}</p>
                                    <p className={`font-bold text-lg leading-tight ${item.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{item.menuItem.name}</p>
                                    {item.notes && <p className="text-red-300 text-sm font-bold mt-1 bg-red-900/20 inline-block px-2 py-0.5 rounded border border-red-900/30">⚠️ {item.notes}</p>}
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