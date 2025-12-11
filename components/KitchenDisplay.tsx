
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Order, OrderStatus, Category, AppSettings, Department, OrderItem, MenuItem } from '../types';
import { getOrders, updateOrderStatus, toggleOrderItemCompletion, getAppSettings, getMenuItems, forceCloudSync, getConnectionStatus, initSupabaseSync } from '../services/storageService';
import { Clock, CheckCircle, ChefHat, Bell, User, LogOut, Square, CheckSquare, AlertOctagon, Timer, PlusCircle, History, Calendar, ChevronLeft, ChevronRight, DollarSign, UtensilsCrossed, Receipt, Pizza, ArrowRightLeft, Utensils, CakeSlice, Wine, Sandwich, ListPlus, RefreshCw, Wifi, WifiOff } from 'lucide-react';

const CATEGORY_PRIORITY: Record<Category, number> = {
    [Category.MENU_COMPLETO]: 0,
    [Category.ANTIPASTI]: 1,
    [Category.PANINI]: 2,
    [Category.PIZZE]: 3,
    [Category.PRIMI]: 4,
    [Category.SECONDI]: 5,
    [Category.DOLCI]: 6,
    [Category.BEVANDE]: 7
};

// Configurazione Soglie Ritardo (minuti)
const THRESHOLD_WARNING = 15;
const THRESHOLD_CRITICAL = 25;

// --- RECEIPT GENERATOR ---
const generateReceiptHtml = (items: OrderItem[], dept: string, table: string, waiter: string, restaurantName: string, allMenuItems: MenuItem[]) => {
    const time = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const date = new Date().toLocaleDateString('it-IT');
    
    return `
    <html>
        <head>
            <title>Stampa ${dept} - Tavolo ${table}</title>
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
                .close-btn { display: block; width: 100%; background-color: #ef4444; color: white; text-align: center; padding: 15px 0; font-weight: bold; font-size: 16px; border: none; cursor: pointer; position: fixed; bottom: 0; left: 0; right: 0; text-transform: uppercase; }
                @media print { .no-print { display: none !important; } }
            </style>
        </head>
        <body>
            <div class="header"><div class="title">${restaurantName}</div><div class="dept">${dept}</div><div class="meta">TAVOLO: ${table}</div><div class="meta">Staff: ${waiter}</div><div style="font-size: 12px; margin-top:5px;">${date} - ${time}</div></div>
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
                <div class="item"><span class="qty">${item.quantity}</span><span class="name">${item.menuItem.name}</span></div>
                ${subItemsHtml}
                ${item.notes ? `<span class="notes">Note: ${item.notes}</span>` : ''}
                `;
            }).join('')}
            <div class="footer">RistoSync AI - Copia di Cortesia</div>
            <button class="no-print close-btn" onclick="window.close()">✖ CHIUDI FINESTRA</button>
            <script>window.onload = function() { setTimeout(function(){ window.focus(); window.print(); }, 500); }</script>
        </body>
    </html>`;
};

// --- SUB-COMPONENT: ORDER TIMER ---
const OrderTimer: React.FC<{ timestamp: number; status: OrderStatus; onCritical: () => void }> = ({ timestamp, status, onCritical }) => {
    const [elapsed, setElapsed] = useState(Math.floor((Date.now() - timestamp) / 60000));

    useEffect(() => {
        const interval = setInterval(() => {
            const newElapsed = Math.floor((Date.now() - timestamp) / 60000);
            setElapsed(newElapsed);
            if (newElapsed >= THRESHOLD_CRITICAL && status !== OrderStatus.READY && status !== OrderStatus.DELIVERED) {
                onCritical();
            }
        }, 10000); // Check every 10s
        return () => clearInterval(interval);
    }, [timestamp, status, onCritical]);

    if (status === OrderStatus.READY || status === OrderStatus.DELIVERED) return <div className="text-green-800 bg-green-100 px-2 py-1 rounded font-bold text-xs flex items-center gap-1 border border-green-300"><CheckCircle size={14}/> COMPLETA</div>;

    let colorClass = "text-slate-400";
    let bgClass = "bg-slate-700";
    let icon = <Timer size={14} />;
    let label = "In corso";
    let animate = "";

    if (elapsed >= THRESHOLD_CRITICAL) { colorClass = "text-white"; bgClass = "bg-red-600"; icon = <Bell size={16} className="animate-wiggle" />; label = "RITARDO CRITICO"; animate = "animate-pulse"; } 
    else if (elapsed >= THRESHOLD_WARNING) { colorClass = "text-slate-900"; bgClass = "bg-orange-400 border border-orange-500"; icon = <AlertOctagon size={14} />; label = "RITARDO"; }

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors duration-500 ${bgClass} ${animate}`}>
            <span className={`${colorClass} ${elapsed >= THRESHOLD_CRITICAL ? 'animate-wiggle' : ''}`}>{icon}</span>
            <div className="flex flex-col leading-none"><span className={`text-[9px] font-black uppercase ${colorClass} opacity-80`}>{label}</span><span className={`text-sm font-black font-mono ${colorClass}`}>{elapsed} min</span></div>
        </div>
    );
};

interface KitchenDisplayProps {
    onExit: () => void;
    department?: Department; 
}

const KitchenDisplay: React.FC<KitchenDisplayProps> = ({ onExit, department = 'Cucina' }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [appSettings, setAppSettings] = useState<AppSettings>(getAppSettings());
  const [notification, setNotification] = useState<{msg: string, type: 'info' | 'success' | 'alert'} | null>(null);
  const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([]); // New: Full menu reference for combo lookup
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnected, setIsConnected] = useState(getConnectionStatus());
  
  // Analytics State
  const [selectedDate, setSelectedDate] = useState(new Date());

  const previousOrdersRef = useRef<Order[]>([]);
  const isFirstLoad = useRef(true);

  // --- DEPARTMENT THEME LOGIC ---
  const isPizzeria = department === 'Pizzeria';
  const isPub = department === 'Pub';
  let themeColor = 'orange'; let ThemeIcon = ChefHat;
  if (isPizzeria) { themeColor = 'red'; ThemeIcon = Pizza; } else if (isPub) { themeColor = 'amber'; ThemeIcon = Sandwich; }

  // --- HELPER: CHECK ITEM RELEVANCE (UPDATED FOR COMBO SPLIT) ---
  const getSubItemsForCombo = (item: OrderItem): MenuItem[] => {
      if (item.menuItem.category !== Category.MENU_COMPLETO || !item.menuItem.comboItems) return [];
      // Resolve IDs to full items using allMenuItems reference
      return allMenuItems.filter(m => item.menuItem.comboItems?.includes(m.id));
  };

  const isItemRelevantForDept = (item: OrderItem): boolean => {
      // 1. If Normal Item -> Check destination directly
      if (item.menuItem.category !== Category.MENU_COMPLETO) {
          const dest = item.menuItem.specificDepartment || appSettings.categoryDestinations[item.menuItem.category];
          return dest === department;
      }
      
      // 2. If Combo Item -> Check if ANY sub-item belongs to this department
      const subItems = getSubItemsForCombo(item);
      return subItems.some(sub => {
          const dest = sub.specificDepartment || appSettings.categoryDestinations[sub.category];
          // Special Case for Sala Visibility: Drinks in combos usually go to Sala. 
          // If department is 'Sala' and item is Drink, return true.
          return dest === department;
      });
  };

  const showNotification = (msg: string, type: 'info' | 'success' | 'alert') => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 5000); };
  const handleCriticalDelay = (tableNum: string) => { /* NO AUDIO */ };

  const loadOrders = () => {
    const allOrders = getOrders();
    const sorted = allOrders.sort((a, b) => a.timestamp - b.timestamp);
    // Sync menu items for resolution
    const currentMenuItems = getMenuItems();
    setAllMenuItems(currentMenuItems);

    if (!isFirstLoad.current) {
        const prevOrders = previousOrdersRef.current;
        const prevOrderIds = prevOrders.map(o => o.id);
        const addedOrders = sorted.filter(o => !prevOrderIds.includes(o.id));
        
        // Use updated relevance logic for notifications
        const relevantNewOrders = addedOrders.filter(order => order.items.some(item => isItemRelevantForDept(item)));

        if (relevantNewOrders.length > 0) {
            const newOrder = relevantNewOrders[0];
            showNotification(`Nuovo Ordine ${department}: Tavolo ${newOrder.tableNumber}`, 'info');

            // --- AUTO PRINT LOGIC ---
            if (appSettings.printEnabled && appSettings.printEnabled[department]) {
                const itemsForDept = newOrder.items.filter(i => isItemRelevantForDept(i));
                if (itemsForDept.length > 0) {
                    const printContent = generateReceiptHtml(
                        itemsForDept, 
                        department, 
                        newOrder.tableNumber, 
                        newOrder.waiterName || 'Staff', 
                        appSettings.restaurantProfile?.name || 'Ristorante',
                        currentMenuItems // Pass full menu
                    );
                    setTimeout(() => {
                        showNotification(`🖨️ Stampa Comanda ${department}...`, 'info');
                        const printWindow = window.open('', `AUTO_PRINT_${department}_${Date.now()}`, 'height=600,width=400');
                        if (printWindow) { printWindow.document.write(printContent); printWindow.document.close(); printWindow.focus(); } 
                    }, 800);
                }
            }
        }
    }
    if (isFirstLoad.current) isFirstLoad.current = false;
    previousOrdersRef.current = sorted;
    setOrders(sorted);
  };

  const handleForceSync = async () => {
      setIsSyncing(true);
      await forceCloudSync();
      loadOrders();
      setTimeout(() => setIsSyncing(false), 500);
  };

  const handleConnectionClick = () => {
      initSupabaseSync();
  };

  useEffect(() => {
    initSupabaseSync(); // Ensure sync is active
    loadOrders();
    setIsConnected(getConnectionStatus());

    const handleStorageChange = (e: StorageEvent) => { if (e.key === 'ristosync_orders') loadOrders(); };
    const handleLocalUpdate = () => loadOrders();
    const handleSettingsUpdate = () => { setAppSettings(getAppSettings()); loadOrders(); };
    const handleConnection = (e: any) => setIsConnected(e.detail.connected);

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage-update', handleLocalUpdate);
    window.addEventListener('local-settings-update', handleSettingsUpdate);
    window.addEventListener('local-menu-update', handleLocalUpdate);
    window.addEventListener('connection-status-change', handleConnection);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-update', handleLocalUpdate);
      window.removeEventListener('local-settings-update', handleSettingsUpdate);
      window.removeEventListener('local-menu-update', handleLocalUpdate);
      window.removeEventListener('connection-status-change', handleConnection);
    };
  }, [appSettings, department]); 

  const advanceStatus = (orderId: string, currentStatus: OrderStatus) => {
    let nextStatus = currentStatus;
    if (currentStatus === OrderStatus.PENDING) nextStatus = OrderStatus.COOKING; else if (currentStatus === OrderStatus.COOKING) nextStatus = OrderStatus.READY; else if (currentStatus === OrderStatus.READY) nextStatus = OrderStatus.DELIVERED;
    updateOrderStatus(orderId, nextStatus);
  };

  // UPDATED: Handle Item Toggle (Partial or Full)
  const handleToggleItem = (orderId: string, originalIndex: number, subItemId?: string) => { 
      toggleOrderItemCompletion(orderId, originalIndex, subItemId); 
  };
  
  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (date: Date) => date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING: return 'bg-yellow-100 border-yellow-400 text-yellow-800';
      case OrderStatus.COOKING: return `bg-${themeColor}-100 border-${themeColor}-400 text-${themeColor}-800`;
      case OrderStatus.READY: return 'bg-green-200 border-green-500 text-green-900 shadow-green-500/20'; // VISIBLE GREEN
      case OrderStatus.DELIVERED: return 'bg-slate-700 border-slate-500 text-slate-300 opacity-80';
      default: return 'bg-gray-100 border-gray-400';
    }
  };

  const filteredHistoryOrders = useMemo(() => {
      return orders.filter(o => {
          if (o.status !== OrderStatus.DELIVERED) return false;
          const orderDate = new Date(o.createdAt || o.timestamp);
          return orderDate.getDate() === selectedDate.getDate() && orderDate.getMonth() === selectedDate.getMonth() && orderDate.getFullYear() === selectedDate.getFullYear();
      }).sort((a, b) => (b.createdAt || b.timestamp) - (a.createdAt || a.timestamp)); 
  }, [orders, selectedDate]);

  const stats = useMemo(() => {
      let totalRevenue = 0; let totalItems = 0;
      filteredHistoryOrders.forEach(order => {
          const relevantItems = order.items.filter(i => isItemRelevantForDept(i));
          const orderTotal = relevantItems.reduce((acc, i) => acc + (i.menuItem.price * i.quantity), 0);
          totalRevenue += orderTotal; relevantItems.forEach(i => totalItems += i.quantity);
      });
      return { totalRevenue, totalItems };
  }, [filteredHistoryOrders, department, appSettings, allMenuItems]); 

  const changeDate = (days: number) => { const newDate = new Date(selectedDate); newDate.setDate(newDate.getDate() + days); setSelectedDate(newDate); };
  
  // LOGICA DI VISUALIZZAZIONE "ATTIVA"
  // Le comande READY restano visibili (verdi) finché non diventano DELIVERED (dal cameriere o dal tasto "Servi")
  const displayedOrders = orders.filter(o => viewMode === 'active' && o.status !== OrderStatus.DELIVERED);
  
  const isAutoPrintActive = appSettings.printEnabled && appSettings.printEnabled[department];

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans flex flex-col relative overflow-hidden">
      <style>{`@keyframes wiggle { 0%, 100% { transform: rotate(-10deg); } 50% { transform: rotate(10deg); } } .animate-wiggle { animation: wiggle 0.3s ease-in-out infinite; } .receipt-edge { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 95% 95%, 90% 100%, 85% 95%, 80% 100%, 75% 95%, 70% 100%, 65% 95%, 60% 100%, 55% 95%, 50% 100%, 45% 95%, 40% 100%, 35% 95%, 30% 100%, 25% 95%, 20% 100%, 15% 95%, 10% 100%, 5% 95%, 0% 100%); }`}</style>

      {notification && (
        <div className={`fixed top-24 left-1/2 transform -translate-x-1/2 z-50 px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-down border-2 ${notification.type === 'success' ? 'bg-green-600 border-green-400' : notification.type === 'alert' ? 'bg-red-600 border-red-400 animate-pulse' : 'bg-blue-600 border-blue-400'}`}>
            {notification.type === 'success' ? <CheckCircle size={32} className="animate-bounce" /> : notification.type === 'alert' ? <Bell size={32} className="animate-wiggle" /> : <Bell size={32} className="animate-swing" />}
            <div><h3 className="font-black text-2xl uppercase">{notification.type === 'success' ? 'ORDINE PRONTO' : notification.type === 'alert' ? 'ATTENZIONE RITARDO' : 'NUOVO ORDINE'}</h3><p className="font-medium text-lg">{notification.msg}</p></div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
        <div className="flex items-center gap-3">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isPizzeria ? 'bg-red-600' : isPub ? 'bg-amber-500' : 'bg-orange-500'}`}><ThemeIcon className="w-8 h-8 text-white" /></div>
          <div>
              <h1 className="text-3xl font-bold">Risto<span className={`${isPizzeria ? 'text-red-500' : isPub ? 'text-amber-500' : 'text-orange-500'}`}>Sync</span></h1>
              <div className="flex items-center gap-2">
                  <p className="text-slate-400 text-xs uppercase font-semibold">{isPizzeria ? 'Pizzeria' : isPub ? 'Pub' : 'Kitchen'} Dashboard</p>
                  <button onClick={handleConnectionClick} className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity cursor-pointer ${isConnected ? 'bg-green-900/30 text-green-400 border border-green-500/30' : 'bg-red-900/30 text-red-400 border border-red-500/30 animate-pulse'}`}>
                      {isConnected ? <Wifi size={10}/> : <WifiOff size={10}/>} {isConnected ? 'ONLINE' : 'DISCONNESSO'}
                  </button>
              </div>
          </div>
          <button onClick={() => loadOrders()} className="ml-4 p-2 rounded-full bg-slate-800 text-slate-500 hover:text-white"><History size={16} /></button>
          <div className="ml-4 flex bg-slate-800 rounded-lg p-1 border border-slate-700">
             <button onClick={() => setViewMode('active')} className={`px-6 py-2 rounded-md font-bold text-sm uppercase transition-all ${viewMode === 'active' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Attivi</button>
             <button onClick={() => setViewMode('history')} className={`px-6 py-2 rounded-md font-bold text-sm uppercase transition-all ${viewMode === 'history' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Storico</button>
          </div>
        </div>
        <div className="flex gap-4 items-center">
            {isAutoPrintActive && (<div className="flex items-center gap-2 px-3 py-1 bg-green-900/30 border border-green-500/30 rounded-lg text-green-400 text-xs font-bold uppercase animate-pulse"><Receipt size={14}/> Auto-Print ON</div>)}
            <button onClick={handleForceSync} className={`p-2.5 rounded-lg border border-slate-700 hover:text-white transition-colors ${isSyncing ? 'bg-blue-600 text-white animate-spin' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`} title="Sincronizza Ora">
                <RefreshCw size={20}/>
            </button>
            <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700"><span className={`text-2xl font-mono font-bold ${isPizzeria ? 'text-red-400' : isPub ? 'text-amber-400' : 'text-orange-400'}`}>{new Date().toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}</span></div>
            <button onClick={onExit} className="bg-slate-800 text-slate-400 hover:text-white p-2.5 rounded-lg"><LogOut size={20} /></button>
        </div>
      </div>

      {viewMode === 'active' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
            {displayedOrders.map((order) => {
               const currentTime = Date.now();
               const timeDiffMinutes = Math.floor((currentTime - order.timestamp) / 60000);
               const isCritical = timeDiffMinutes >= THRESHOLD_CRITICAL && order.status !== OrderStatus.READY && order.status !== OrderStatus.DELIVERED;
               
               let borderColor = getStatusColor(order.status).replace('text', 'border').replace('bg-','border-');
               let cardBgClass = "bg-slate-800/95 bg-gradient-to-br from-slate-800 to-slate-900";
               
               // CRITICAL ALERT VISUALS
               if (isCritical) {
                   borderColor = 'border-red-500';
                   cardBgClass = "bg-red-600 animate-pulse shadow-[0_0_40px_rgba(220,38,38,0.6)]";
               }

               // COORDINATION LOGIC
               const otherDeptItems = order.items.filter(i => !isItemRelevantForDept(i) && i.menuItem.category !== Category.BEVANDE);
               const hasCoordinatedItems = otherDeptItems.length > 0;

               // FILTER: Determine visible items
               const visibleItems = order.items
                  .map((item, originalIndex) => ({ item, originalIndex }))
                  .filter(({ item }) => isItemRelevantForDept(item))
                  .sort((a, b) => (CATEGORY_PRIORITY[a.item.menuItem.category] || 99) - (CATEGORY_PRIORITY[b.item.menuItem.category] || 99));

               if (visibleItems.length === 0) return null;
               const displayTableNumber = order.tableNumber.replace('_HISTORY', '');

              return (
                <div key={order.id} className={`flex flex-col rounded-xl shadow-2xl border-t-8 ${borderColor} ${cardBgClass} text-slate-200 overflow-hidden relative hover:-translate-y-1 transition-transform`}>
                  <div className={`p-4 border-b border-slate-700/50 flex justify-between items-start bg-slate-800/50`}>
                    <div>
                        <h2 className="text-3xl font-black bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">Tav. {displayTableNumber}</h2>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase mt-1 ${getStatusColor(order.status)}`}>
                            {order.status === OrderStatus.READY ? 'COMPLETA' : order.status}
                        </span>
                        {hasCoordinatedItems && (<div className="mt-2 flex items-center gap-1.5 text-[9px] font-black uppercase text-blue-200 bg-blue-900/60 px-2 py-1.5 rounded-lg border border-blue-500/40 animate-pulse w-max shadow-lg shadow-blue-900/20"><ArrowRightLeft size={12} className="text-blue-400"/><span>SYNC: {otherDeptItems.length} ALTRI</span></div>)}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex flex-col items-end gap-1 mb-1"><span className="text-[10px] text-slate-400 font-mono bg-slate-800/80 px-1.5 py-0.5 rounded flex items-center gap-1 border border-slate-700">Entrata: <span className="text-white font-bold">{formatTime(order.createdAt || order.timestamp)}</span></span></div>
                      <OrderTimer timestamp={order.timestamp} status={order.status} onCritical={() => handleCriticalDelay(order.tableNumber)}/>
                      <div className="flex items-center justify-end gap-1 text-slate-500 text-xs font-bold"><User size={12} /> {order.waiterName || 'Staff'}</div>
                    </div>
                  </div>

                  <div className="p-4 flex-1 overflow-y-auto max-h-[300px] bg-slate-900/30">
                    <ul className="space-y-4">
                      {visibleItems.map(({ item, originalIndex }) => {
                          // COMBO LOGIC: If it's a combo, calculate specific display name for THIS department
                          const isCombo = item.menuItem.category === Category.MENU_COMPLETO;
                          
                          if (isCombo) {
                              // SUB-ITEMS SPECIFIC TO DEPT
                              const subItems = getSubItemsForCombo(item).filter(sub => {
                                  const dest = sub.specificDepartment || appSettings.categoryDestinations[sub.category];
                                  return dest === department;
                              });

                              return (
                                <li key={`${order.id}-${originalIndex}`} className="flex flex-col border-b border-dashed border-slate-700 pb-3 last:border-0 rounded-lg p-2 bg-slate-800/20">
                                    <div className="flex items-center gap-2 mb-2">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-pink-500 flex items-center gap-1"><ListPlus size={10}/> MENU COMBO ({item.menuItem.name})</p>
                                        <span className={`font-black text-xs px-2 py-0.5 rounded shadow-inner ${item.completed ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-white'}`}>x{item.quantity}</span>
                                    </div>
                                    <div className="flex flex-col gap-2 pl-2">
                                        {subItems.map((sub, idx) => {
                                            const isDone = item.comboCompletedParts?.includes(sub.id);
                                            return (
                                                <div key={sub.id} onClick={() => order.status !== OrderStatus.DELIVERED && handleToggleItem(order.id, originalIndex, sub.id)} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${isDone ? 'bg-green-900/20 opacity-60' : 'bg-slate-700/50 hover:bg-slate-700 border border-slate-600'}`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`pt-0.5 ${isDone ? 'text-green-500' : 'text-slate-400'}`}>{isDone ? <CheckSquare size={20} /> : <Square size={20} />}</div>
                                                        <span className={`font-black text-xl leading-none ${isDone ? 'text-slate-500 line-through' : 'text-orange-400'}`}>{sub.name}</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {subItems.length === 0 && <p className="text-xs text-slate-500 italic px-2">Nessun elemento per questo reparto.</p>}
                                    </div>
                                    {item.notes && <p className="text-red-300 text-xs font-bold mt-2 bg-red-900/20 inline-block px-2 py-1 rounded border border-red-900/30 shadow-sm ml-2">⚠️ {item.notes}</p>}
                                </li>
                              );
                          }

                          // STANDARD ITEM RENDERING
                          return (
                            <li key={`${order.id}-${originalIndex}`} onClick={() => order.status !== OrderStatus.DELIVERED && handleToggleItem(order.id, originalIndex)} className={`flex justify-between items-start border-b border-dashed border-slate-700 pb-3 last:border-0 rounded-lg p-2 transition-colors ${item.completed ? 'bg-green-900/10 opacity-70' : 'hover:bg-slate-800/50 cursor-pointer'}`}>
                              <div className="w-full">
                                  {item.isAddedLater && order.status !== OrderStatus.DELIVERED && <div className="flex items-center gap-1 mb-1 bg-blue-600 w-max px-2 py-0.5 rounded-md shadow-sm border border-blue-400"><PlusCircle size={10} className="text-white animate-pulse" /><span className="text-[10px] font-black text-white uppercase tracking-wide">AGGIUNTA</span></div>}
                                  <div className="flex gap-4 items-start w-full">
                                      <div className={`pt-1 ${item.completed ? 'text-green-500' : 'text-slate-600'}`}>{item.completed ? <CheckSquare size={28} /> : <Square size={28} />}</div>
                                      <span className={`font-black text-2xl w-10 h-10 flex items-center justify-center rounded-lg shadow-inner ${item.completed ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-white'}`}>{item.quantity}</span>
                                      <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                              <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isPizzeria ? 'text-red-500' : isPub ? 'text-amber-500' : 'text-orange-500'}`}>{item.menuItem.category}</p>
                                          </div>
                                          
                                          {/* MAIN NAME DISPLAY */}
                                          <p className={`font-black text-3xl leading-none tracking-tight break-words ${item.completed ? 'text-slate-500 line-through decoration-slate-600 decoration-2' : 'bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent'}`}>
                                              {item.menuItem.name}
                                          </p>

                                          {item.menuItem.ingredients && <p className="text-[10px] text-slate-500 mt-1 italic">{item.menuItem.ingredients}</p>}
                                          {item.notes && <p className="text-red-300 text-sm font-bold mt-2 bg-red-900/20 inline-block px-3 py-1 rounded border border-red-900/30 shadow-sm">⚠️ {item.notes}</p>}
                                      </div>
                                  </div>
                              </div>
                            </li>
                          )
                      })}
                    </ul>
                  </div>

                  <button onClick={() => advanceStatus(order.id, order.status)} className={`w-full py-5 text-center font-black text-lg uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:brightness-110 ${order.status === OrderStatus.READY ? 'bg-green-600 text-white' : `bg-${themeColor}-500 text-white`}`}>
                      {order.status === OrderStatus.READY ? <><CheckCircle /> COMPLETA (ATTENDI RITIRO)</> : <>AVANZA STATO {order.status === OrderStatus.PENDING && '→ PREPARAZIONE'} {order.status === OrderStatus.COOKING && '→ PRONTO'}</>}
                  </button>
                </div>
              );
            })}
        </div>
      ) : (
        <div className="flex flex-col h-full overflow-hidden animate-fade-in">
              <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
                  <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700"><button onClick={() => changeDate(-1)} className="p-3 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"><ChevronLeft/></button><div className="px-6 font-bold text-white flex items-center gap-2 uppercase tracking-wide"><Calendar size={18} className={`${isPizzeria ? 'text-red-500' : isPub ? 'text-amber-500' : 'text-orange-500'}`}/> {formatDate(selectedDate)}</div><button onClick={() => changeDate(1)} className="p-3 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"><ChevronRight/></button></div>
                  <div className="flex gap-4">
                      <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl flex items-center gap-3"><div className="p-3 bg-green-900/20 rounded-xl text-green-500"><DollarSign/></div><div><p className="text-slate-400 text-xs font-bold uppercase">Incasso {department}</p><p className="text-2xl font-black text-white">€ {stats.totalRevenue.toFixed(2)}</p></div></div>
                      <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl flex items-center gap-3"><div className="p-3 bg-blue-900/20 rounded-xl text-blue-500"><UtensilsCrossed/></div><div><p className="text-slate-400 text-xs font-bold uppercase">Piatti {department}</p><p className="text-2xl font-black text-white">{stats.totalItems}</p></div></div>
                  </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pb-10">
                  {filteredHistoryOrders.map(order => {
                      const items = order.items.filter(i => isItemRelevantForDept(i));
                      if (items.length === 0) return null;
                      const total = items.reduce((acc, i) => acc + (i.menuItem.price * i.quantity), 0);
                      const cleanTable = order.tableNumber.replace('_HISTORY', '');
                      return (
                          <div key={order.id} className="bg-slate-200 text-slate-900 p-0 relative shadow-xl font-mono text-sm leading-tight receipt-edge pb-6">
                              <div className="p-4 pb-2 text-center border-b border-dashed border-slate-400 mx-2"><h3 className="font-bold text-lg uppercase mb-1">{appSettings.restaurantProfile?.name || 'RistoSync'}</h3><p className="text-xs font-bold uppercase">{department}</p><p className="text-xs">Tavolo: {cleanTable}</p><p className="text-xs">{formatDate(new Date(order.createdAt || order.timestamp))} - {formatTime(order.timestamp)}</p><p className="text-[10px] mt-1 uppercase">Staff: {order.waiterName || '?'}</p></div>
                              <div className="p-4 space-y-2">{items.map((item, idx) => (<div key={idx} className="flex justify-between items-start"><div className="flex gap-2"><span className="font-bold">{item.quantity}x</span><span className="uppercase">{item.menuItem.name}</span></div><span>€ {(item.menuItem.price * item.quantity).toFixed(2)}</span></div>))}</div>
                              <div className="mx-4 pt-2 border-t border-dashed border-slate-900 flex justify-between items-end mb-2"><span className="font-bold text-lg">TOTALE</span><span className="font-bold text-xl">€ {total.toFixed(2)}</span></div>
                              <div className="text-center text-[10px] text-slate-500 mt-4">*** COPIA NON FISCALE ***</div>
                          </div>
                      );
                  })}
                  {filteredHistoryOrders.every(o => o.items.filter(i => isItemRelevantForDept(i)).length === 0) && (<div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-600"><Receipt size={64} className="opacity-20 mb-4"/><p className="font-bold text-lg">Nessuno scontrino presente</p><p className="text-sm">Non ci sono comande chiuse per {department} in questa data.</p></div>)}
              </div>
        </div>
      )}
    </div>
  );
};

export default KitchenDisplay;
