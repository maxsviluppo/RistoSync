import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Order, OrderStatus, Category, AppSettings, Department, OrderItem } from '../types';
import { getOrders, updateOrderStatus, toggleOrderItemCompletion, getAppSettings } from '../services/storageService';
import { Clock, CheckCircle, ChefHat, Bell, User, LogOut, Square, CheckSquare, AlertOctagon, Timer, PlusCircle, History, Calendar, ChevronLeft, ChevronRight, DollarSign, UtensilsCrossed, Receipt, Pizza, ArrowRightLeft, Utensils, CakeSlice, Wine, Sandwich } from 'lucide-react';

const CATEGORY_PRIORITY: Record<Category, number> = {
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

// --- RECEIPT GENERATOR (Duplicated for Distributed Printing) ---
const generateReceiptHtml = (items: OrderItem[], dept: string, table: string, waiter: string, restaurantName: string) => {
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
                .item { display: flex; margin-bottom: 8px; align-items: baseline; }
                .qty { font-weight: bold; width: 30px; font-size: 16px; }
                .name { flex: 1; font-weight: bold; font-size: 16px; }
                .notes { display: block; font-size: 12px; margin-left: 30px; font-style: italic; margin-top: 2px; }
                .footer { border-top: 2px dashed black; margin-top: 15px; padding-top: 10px; text-align: center; font-size: 10px; }
                
                /* NO PRINT UI */
                @media print {
                    .no-print { display: none !important; }
                }
                .close-btn {
                    display: block;
                    width: 100%;
                    background-color: #ef4444;
                    color: white;
                    text-align: center;
                    padding: 15px 0;
                    font-weight: bold;
                    font-size: 16px;
                    border: none;
                    cursor: pointer;
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    text-transform: uppercase;
                    box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
                }
                .close-btn:hover { background-color: #dc2626; }
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
            ${items.map(item => `
                <div class="item">
                    <span class="qty">${item.quantity}</span>
                    <span class="name">${item.menuItem.name}</span>
                </div>
                ${item.notes ? `<span class="notes">Note: ${item.notes}</span>` : ''}
            `).join('')}
            <div class="footer">
                RistoSync AI - Copia di Cortesia
            </div>

            <!-- BUTTON FOR UI ONLY -->
            <button class="no-print close-btn" onclick="window.close()">✖ CHIUDI FINESTRA</button>

            <script>
                window.onload = function() { 
                    setTimeout(function(){ 
                        window.focus(); 
                        window.print(); 
                        // window.close(); // Optional: close automatically
                    }, 500); 
                }
            </script>
        </body>
    </html>
    `;
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
    department?: Department; // 'Cucina' | 'Pizzeria' | 'Pub'
}

const KitchenDisplay: React.FC<KitchenDisplayProps> = ({ onExit, department = 'Cucina' }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [appSettings, setAppSettings] = useState<AppSettings>(getAppSettings());
  const [notification, setNotification] = useState<{msg: string, type: 'info' | 'success' | 'alert'} | null>(null);
  
  // Analytics State
  const [selectedDate, setSelectedDate] = useState(new Date());

  const previousOrdersRef = useRef<Order[]>([]);
  const isFirstLoad = useRef(true);

  // --- DEPARTMENT THEME LOGIC ---
  const isPizzeria = department === 'Pizzeria';
  const isPub = department === 'Pub';
  
  let themeColor = 'orange'; // Default Kitchen
  let ThemeIcon = ChefHat;

  if (isPizzeria) {
      themeColor = 'red';
      ThemeIcon = Pizza;
  } else if (isPub) {
      themeColor = 'amber';
      ThemeIcon = Sandwich;
  }

  const showNotification = (msg: string, type: 'info' | 'success' | 'alert') => {
      setNotification({ msg, type });
      setTimeout(() => setNotification(null), 5000);
  };

  const handleCriticalDelay = (tableNum: string) => {
      playNotificationSound('alert');
  };

  const loadOrders = () => {
    const allOrders = getOrders();
    // Sort by Last Updated (Timestamp) to bubble active ones
    const sorted = allOrders.sort((a, b) => a.timestamp - b.timestamp);

    if (!isFirstLoad.current) {
        const prevOrders = previousOrdersRef.current;
        const prevOrderIds = prevOrders.map(o => o.id);
        
        // Find newly added orders
        const addedOrders = sorted.filter(o => !prevOrderIds.includes(o.id));
        
        // 1. FILTER FOR RELEVANT ITEMS
        const relevantNewOrders = addedOrders.filter(order => 
            order.items.some(item => {
                const dest = appSettings.categoryDestinations[item.menuItem.category];
                return dest === department; 
            })
        );

        if (relevantNewOrders.length > 0) {
            const newOrder = relevantNewOrders[0];
            playNotificationSound('new');
            showNotification(`Nuovo Ordine ${department}: Tavolo ${newOrder.tableNumber}`, 'info');

            // --- AUTO PRINT LOGIC (DISTRIBUTED) ---
            // If Admin enabled auto-print for this department, we print HERE, on the receiving terminal.
            // This prevents popup blockers on the waiter's device.
            if (appSettings.printEnabled && appSettings.printEnabled[department]) {
                const itemsForDept = newOrder.items.filter(i => appSettings.categoryDestinations[i.menuItem.category] === department);
                
                if (itemsForDept.length > 0) {
                    const printContent = generateReceiptHtml(
                        itemsForDept, 
                        department, 
                        newOrder.tableNumber, 
                        newOrder.waiterName || 'Staff', 
                        appSettings.restaurantProfile?.name || 'Ristorante'
                    );
                    
                    // We use a slight timeout to ensure the UI update doesn't clash with the print dialog
                    setTimeout(() => {
                        // SIMULATION FEEDBACK
                        showNotification(`🖨️ Stampa Comanda ${department}...`, 'info');

                        const printWindow = window.open('', `AUTO_PRINT_${department}_${Date.now()}`, 'height=600,width=400');
                        if (printWindow) {
                            printWindow.document.write(printContent);
                            printWindow.document.close();
                            printWindow.focus();
                            // The receipt HTML contains window.print() onload
                        } else {
                            console.warn("Popup bloccato. Impossibile stampare.");
                        }
                    }, 800);
                }
            }
        }

        // Check if an order became READY (handled similarly for both, usually controlled by Chef/Pizzaiolo finishing items)
        sorted.forEach(newOrder => {
            const oldOrder = prevOrders.find(o => o.id === newOrder.id);
            if (oldOrder && oldOrder.status !== OrderStatus.READY && newOrder.status === OrderStatus.READY) {
                // Optionally filter this notification too, but order status is global
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
  }, [appSettings, department]); 

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
      case OrderStatus.COOKING: return `bg-${themeColor}-100 border-${themeColor}-400 text-${themeColor}-800`;
      case OrderStatus.READY: return 'bg-green-100 border-green-400 text-green-800';
      case OrderStatus.DELIVERED: return 'bg-slate-700 border-slate-500 text-slate-300 opacity-80';
      default: return 'bg-gray-100 border-gray-400';
    }
  };

  // --- ANALYTICS CALCULATIONS ---
  // Analytics should probably filter by department too? Yes, usually.
  const filteredHistoryOrders = useMemo(() => {
      return orders.filter(o => {
          if (o.status !== OrderStatus.DELIVERED) return false;
          const orderDate = new Date(o.createdAt || o.timestamp);
          return orderDate.getDate() === selectedDate.getDate() &&
                 orderDate.getMonth() === selectedDate.getMonth() &&
                 orderDate.getFullYear() === selectedDate.getFullYear();
      }).sort((a, b) => (b.createdAt || b.timestamp) - (a.createdAt || a.timestamp)); 
  }, [orders, selectedDate]);

  const stats = useMemo(() => {
      let totalRevenue = 0;
      let totalItems = 0;
      filteredHistoryOrders.forEach(order => {
          // Filter items specific to this department for accurate stats
          const relevantItems = order.items.filter(i => appSettings.categoryDestinations[i.menuItem.category] === department);
          
          const orderTotal = relevantItems.reduce((acc, i) => acc + (i.menuItem.price * i.quantity), 0);
          totalRevenue += orderTotal;
          relevantItems.forEach(i => totalItems += i.quantity);
      });
      return { totalRevenue, totalItems };
  }, [filteredHistoryOrders, department, appSettings]);

  const changeDate = (days: number) => {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + days);
      setSelectedDate(newDate);
  };

  // CORRECT FILTER LOGIC
  const displayedOrders = orders.filter(o => viewMode === 'active' && o.status !== OrderStatus.DELIVERED);

  // Check if Auto Print is active for visual indication
  const isAutoPrintActive = appSettings.printEnabled && appSettings.printEnabled[department];

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans flex flex-col relative overflow-hidden">
      <style>{`
        @keyframes wiggle { 0%, 100% { transform: rotate(-10deg); } 50% { transform: rotate(10deg); } }
        .animate-wiggle { animation: wiggle 0.3s ease-in-out infinite; }
        .receipt-edge { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 95% 95%, 90% 100%, 85% 95%, 80% 100%, 75% 95%, 70% 100%, 65% 95%, 60% 100%, 55% 95%, 50% 100%, 45% 95%, 40% 100%, 35% 95%, 30% 100%, 25% 95%, 20% 100%, 15% 95%, 10% 100%, 5% 95%, 0% 100%); }
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

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
        <div className="flex items-center gap-3">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isPizzeria ? 'bg-red-600' : isPub ? 'bg-amber-500' : 'bg-orange-500'}`}>
              <ThemeIcon className="w-8 h-8 text-white" />
          </div>
          <div>
              <h1 className="text-3xl font-bold">Risto<span className={`${isPizzeria ? 'text-red-500' : isPub ? 'text-amber-500' : 'text-orange-500'}`}>Sync</span></h1>
              <p className="text-slate-400 text-xs uppercase font-semibold">{isPizzeria ? 'Pizzeria' : isPub ? 'Pub' : 'Kitchen'} Dashboard</p>
          </div>
          <button onClick={() => loadOrders()} className="ml-4 p-2 rounded-full bg-slate-800 text-slate-500 hover:text-white"><History size={16} /></button>
          
          {/* TABS */}
          <div className="ml-4 flex bg-slate-800 rounded-lg p-1 border border-slate-700">
             <button onClick={() => setViewMode('active')} className={`px-6 py-2 rounded-md font-bold text-sm uppercase transition-all ${viewMode === 'active' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Attivi</button>
             <button onClick={() => setViewMode('history')} className={`px-6 py-2 rounded-md font-bold text-sm uppercase transition-all ${viewMode === 'history' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Storico</button>
          </div>
        </div>
        <div className="flex gap-4 items-center">
            {isAutoPrintActive && (
                <div className="flex items-center gap-2 px-3 py-1 bg-green-900/30 border border-green-500/30 rounded-lg text-green-400 text-xs font-bold uppercase animate-pulse">
                    <Receipt size={14}/> Auto-Print ON
                </div>
            )}
            <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700"><span className={`text-2xl font-mono font-bold ${isPizzeria ? 'text-red-400' : isPub ? 'text-amber-400' : 'text-orange-400'}`}>{new Date().toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}</span></div>
            <button onClick={onExit} className="bg-slate-800 text-slate-400 hover:text-white p-2.5 rounded-lg"><LogOut size={20} /></button>
        </div>
      </div>

      {viewMode === 'active' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
            {displayedOrders.map((order) => {
               const currentTime = Date.now();
               const timeDiffMinutes = Math.floor((currentTime - order.timestamp) / 60000);
               
               // Is Critical? (>25 mins and not ready)
               const isCritical = timeDiffMinutes >= THRESHOLD_CRITICAL && order.status !== OrderStatus.READY && order.status !== OrderStatus.DELIVERED;
               
               // Dynamic border color based on timer
               let borderColor = getStatusColor(order.status).replace('text', 'border').replace('bg-','border-');
               if (isCritical) borderColor = 'border-red-600 animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.4)]';

               // COORDINATION LOGIC: Check for items from the OTHER department
               const otherDeptItems = order.items.filter(i => {
                   const dest = appSettings.categoryDestinations[i.menuItem.category];
                   // If we are Pizzeria/Pub, we look for 'Cucina'. If Kitchen, we look for 'Pizzeria' or 'Pub'.
                   // Items for 'Sala' (Drinks) are ignored for coordination.
                   // NOTE: For Pub, user said no sync needed, but we keep this visual aid if applicable.
                   return dest !== department && dest !== 'Sala';
               });
               const hasCoordinatedItems = otherDeptItems.length > 0;

               // FILTER: Determine visible items (Only items for THIS department)
               const visibleItems = order.items
                  .map((item, originalIndex) => ({ item, originalIndex }))
                  .filter(({ item }) => {
                      const dest = appSettings.categoryDestinations[item.menuItem.category];
                      return dest === department; 
                  })
                  .sort((a, b) => (CATEGORY_PRIORITY[a.item.menuItem.category] || 99) - (CATEGORY_PRIORITY[b.item.menuItem.category] || 99));

               if (visibleItems.length === 0) return null;

               const displayTableNumber = order.tableNumber.replace('_HISTORY', '');

              return (
                <div key={order.id} className={`flex flex-col rounded-xl shadow-2xl border-t-8 ${borderColor} bg-slate-800/95 bg-gradient-to-br from-slate-800 to-slate-900 text-slate-200 overflow-hidden relative hover:-translate-y-1 transition-transform`}>
                  <div className={`p-4 border-b border-slate-700/50 flex justify-between items-start bg-slate-800/50`}>
                    <div>
                        <h2 className="text-3xl font-black bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">Tav. {displayTableNumber}</h2>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase mt-1 ${getStatusColor(order.status)}`}>{order.status}</span>
                        {/* COORDINATION BADGE */}
                        {hasCoordinatedItems && (
                           <div className="mt-2 flex items-center gap-1.5 text-[9px] font-black uppercase text-blue-200 bg-blue-900/60 px-2 py-1.5 rounded-lg border border-blue-500/40 animate-pulse w-max shadow-lg shadow-blue-900/20">
                              <ArrowRightLeft size={12} className="text-blue-400"/>
                              <span>SYNC: {otherDeptItems.length} ALTRI</span>
                           </div>
                        )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {/* TIMESTAMPS */}
                      <div className="flex flex-col items-end gap-1 mb-1">
                          <span className="text-[10px] text-slate-400 font-mono bg-slate-800/80 px-1.5 py-0.5 rounded flex items-center gap-1 border border-slate-700">
                              Entrata: <span className="text-white font-bold">{formatTime(order.createdAt || order.timestamp)}</span>
                          </span>
                      </div>

                      {/* TIMER & WAITER */}
                      <OrderTimer 
                          timestamp={order.timestamp} 
                          status={order.status} 
                          onCritical={() => handleCriticalDelay(order.tableNumber)}
                      />
                      <div className="flex items-center justify-end gap-1 text-slate-500 text-xs font-bold"><User size={12} /> {order.waiterName || 'Staff'}</div>
                    </div>
                  </div>

                  <div className="p-4 flex-1 overflow-y-auto max-h-[300px] bg-slate-900/30">
                    <ul className="space-y-4">
                      {visibleItems.map(({ item, originalIndex }) => (
                        <li key={`${order.id}-${originalIndex}`} onClick={() => order.status !== OrderStatus.DELIVERED && handleToggleItem(order.id, originalIndex)} className={`flex justify-between items-start border-b border-dashed border-slate-700 pb-3 last:border-0 rounded-lg p-2 transition-colors ${item.completed ? 'bg-green-900/10 opacity-50' : 'hover:bg-slate-800/50 cursor-pointer'}`}>
                          <div className="w-full">
                              {item.isAddedLater && order.status !== OrderStatus.DELIVERED && <div className="flex items-center gap-1 mb-1 bg-blue-600 w-max px-2 py-0.5 rounded-md shadow-sm border border-blue-400"><PlusCircle size={10} className="text-white animate-pulse" /><span className="text-[10px] font-black text-white uppercase tracking-wide">AGGIUNTA</span></div>}
                              <div className="flex gap-4 items-start w-full">
                                  <div className={`pt-1 ${item.completed ? 'text-green-500' : 'text-slate-600'}`}>{item.completed ? <CheckSquare size={28} /> : <Square size={28} />}</div>
                                  <span className={`font-black text-2xl w-10 h-10 flex items-center justify-center rounded-lg shadow-inner ${item.completed ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-white'}`}>{item.quantity}</span>
                                  <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                          <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isPizzeria ? 'text-red-500' : isPub ? 'text-amber-500' : 'text-orange-500'}`}>{item.menuItem.category}</p>
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

                  <button onClick={() => advanceStatus(order.id, order.status)} className={`w-full py-5 text-center font-black text-lg uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:brightness-110 ${order.status === OrderStatus.READY ? 'bg-green-600 text-white' : `bg-${themeColor}-500 text-white`}`}>
                      {order.status === OrderStatus.READY ? <><CheckCircle /> SERVI AL TAVOLO</> : <>AVANZA STATO {order.status === OrderStatus.PENDING && '→ PREPARAZIONE'} {order.status === OrderStatus.COOKING && '→ PRONTO'}</>}
                  </button>
                </div>
              );
            })}
        </div>
      ) : (
        <div className="flex flex-col h-full overflow-hidden animate-fade-in">
              {/* DATE SELECTOR & KPI HEADER */}
              <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
                  <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
                      <button onClick={() => changeDate(-1)} className="p-3 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"><ChevronLeft/></button>
                      <div className="px-6 font-bold text-white flex items-center gap-2 uppercase tracking-wide"><Calendar size={18} className={`${isPizzeria ? 'text-red-500' : isPub ? 'text-amber-500' : 'text-orange-500'}`}/> {formatDate(selectedDate)}</div>
                      <button onClick={() => changeDate(1)} className="p-3 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"><ChevronRight/></button>
                  </div>
                  <div className="flex gap-4">
                      <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl flex items-center gap-3">
                          <div className="p-3 bg-green-900/20 rounded-xl text-green-500"><DollarSign/></div>
                          <div><p className="text-slate-400 text-xs font-bold uppercase">Incasso {department}</p><p className="text-2xl font-black text-white">€ {stats.totalRevenue.toFixed(2)}</p></div>
                      </div>
                      <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl flex items-center gap-3">
                          <div className="p-3 bg-blue-900/20 rounded-xl text-blue-500"><UtensilsCrossed/></div>
                          <div><p className="text-slate-400 text-xs font-bold uppercase">Piatti {department}</p><p className="text-2xl font-black text-white">{stats.totalItems}</p></div>
                      </div>
                  </div>
              </div>

              {/* RECEIPTS GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pb-10">
                  {filteredHistoryOrders.map(order => {
                      const items = order.items.filter(i => appSettings.categoryDestinations[i.menuItem.category] === department);
                      if (items.length === 0) return null;

                      const total = items.reduce((acc, i) => acc + (i.menuItem.price * i.quantity), 0);
                      const cleanTable = order.tableNumber.replace('_HISTORY', '');
                      
                      return (
                          <div key={order.id} className="bg-slate-200 text-slate-900 p-0 relative shadow-xl font-mono text-sm leading-tight receipt-edge pb-6">
                              {/* Receipt Header */}
                              <div className="p-4 pb-2 text-center border-b border-dashed border-slate-400 mx-2">
                                  <h3 className="font-bold text-lg uppercase mb-1">{appSettings.restaurantProfile?.name || 'RistoSync'}</h3>
                                  <p className="text-xs font-bold uppercase">{department}</p>
                                  <p className="text-xs">Tavolo: {cleanTable}</p>
                                  <p className="text-xs">{formatDate(new Date(order.createdAt || order.timestamp))} - {formatTime(order.timestamp)}</p>
                                  <p className="text-[10px] mt-1 uppercase">Staff: {order.waiterName || '?'}</p>
                              </div>
                              
                              {/* Items */}
                              <div className="p-4 space-y-2">
                                  {items.map((item, idx) => (
                                      <div key={idx} className="flex justify-between items-start">
                                          <div className="flex gap-2">
                                              <span className="font-bold">{item.quantity}x</span>
                                              <span className="uppercase">{item.menuItem.name}</span>
                                          </div>
                                          <span>€ {(item.menuItem.price * item.quantity).toFixed(2)}</span>
                                      </div>
                                  ))}
                              </div>
                              
                              {/* Total */}
                              <div className="mx-4 pt-2 border-t border-dashed border-slate-900 flex justify-between items-end mb-2">
                                  <span className="font-bold text-lg">TOTALE</span>
                                  <span className="font-bold text-xl">€ {total.toFixed(2)}</span>
                              </div>
                              
                              <div className="text-center text-[10px] text-slate-500 mt-4">
                                  *** COPIA NON FISCALE ***
                              </div>
                          </div>
                      );
                  })}
                  {filteredHistoryOrders.every(o => o.items.filter(i => appSettings.categoryDestinations[i.menuItem.category] === department).length === 0) && (
                      <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-600">
                          <Receipt size={64} className="opacity-20 mb-4"/>
                          <p className="font-bold text-lg">Nessuno scontrino presente</p>
                          <p className="text-sm">Non ci sono comande chiuse per {department} in questa data.</p>
                      </div>
                  )}
              </div>
        </div>
      )}
    </div>
  );
};

export default KitchenDisplay;