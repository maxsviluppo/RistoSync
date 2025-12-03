import React, { useEffect, useState } from 'react';
import { Order, OrderStatus } from '../types';
import { getOrders, updateOrderStatus, clearHistory } from '../services/storageService';
import { Clock, CheckCircle, ChefHat, Trash2, History, UtensilsCrossed } from 'lucide-react';

const KitchenDisplay: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');

  const loadOrders = () => {
    const allOrders = getOrders();
    // Sort by time: oldest first
    const sorted = allOrders.sort((a, b) => a.timestamp - b.timestamp);
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
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans flex flex-col">
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
        <div className="flex items-center gap-3">
          <ChefHat className="w-10 h-10 text-orange-500" />
          <h1 className="text-3xl font-bold tracking-tight">CUCINA</h1>
          
          {/* Tabs */}
          <div className="ml-8 flex bg-slate-800 rounded-lg p-1">
             <button 
                onClick={() => setViewMode('active')}
                className={`px-4 py-2 rounded-md font-medium transition-all ${viewMode === 'active' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
             >
                In Corso ({orders.filter(o => o.status !== OrderStatus.DELIVERED).length})
             </button>
             <button 
                onClick={() => setViewMode('history')}
                className={`px-4 py-2 rounded-md font-medium transition-all ${viewMode === 'history' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
             >
                Storico
             </button>
          </div>
        </div>

        <div className="flex gap-4 items-center">
            <span className="text-xl font-mono text-slate-300">
                {new Date().toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}
            </span>
            {viewMode === 'history' && (
                <button 
                    onClick={() => {
                        if(confirm('Sei sicuro di voler cancellare definitivamente lo storico degli ordini serviti?')) {
                            clearHistory();
                        }
                    }}
                    className="flex items-center gap-2 bg-red-900/50 hover:bg-red-900 text-red-200 px-4 py-2 rounded text-sm transition-colors border border-red-800"
                >
                    <Trash2 size={16} /> Svuota Storico
                </button>
            )}
        </div>
      </div>

      {/* Grid */}
      {displayedOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-slate-500 min-h-[400px]">
          {viewMode === 'active' ? (
             <>
               <UtensilsCrossed className="w-24 h-24 mb-4 opacity-20" />
               <p className="text-2xl">Tutto tranquillo, Chef!</p>
             </>
          ) : (
             <>
               <History className="w-24 h-24 mb-4 opacity-20" />
               <p className="text-2xl">Nessun ordine nello storico</p>
             </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
          {displayedOrders.map((order) => {
             const timeDiff = Math.floor((Date.now() - order.timestamp) / 60000);
             const isLate = viewMode === 'active' && timeDiff > 15 && order.status !== OrderStatus.READY;

            return (
              <div 
                key={order.id} 
                className={`flex flex-col rounded-lg shadow-lg border-l-8 ${getStatusColor(order.status).replace('text', 'border')} bg-white text-slate-800 overflow-hidden transform transition-all duration-300 ${viewMode === 'active' ? 'hover:scale-[1.02]' : 'opacity-90'}`}
              >
                {/* Header Card */}
                <div className={`p-4 border-b flex justify-between items-start ${isLate ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <div>
                    <h2 className="text-2xl font-bold">Tavolo {order.tableNumber}</h2>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide mt-1 ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-slate-500 font-mono text-lg">
                        <Clock size={18} />
                        {formatTime(order.timestamp)}
                    </div>
                    {isLate && <div className="text-red-600 font-bold text-xs mt-1 animate-pulse">RITARDO {timeDiff}m</div>}
                  </div>
                </div>

                {/* Body Card */}
                <div className="p-4 flex-1 overflow-y-auto max-h-[300px]">
                  <ul className="space-y-3">
                    {order.items.map((item, idx) => (
                      <li key={idx} className="flex justify-between items-start border-b border-dashed border-slate-200 pb-2 last:border-0">
                        <div className="flex gap-2">
                           <span className="font-bold text-lg w-6 h-6 flex items-center justify-center bg-slate-100 rounded-full text-slate-700">
                             {item.quantity}
                           </span>
                           <div>
                               <p className="font-semibold text-lg leading-tight">{item.menuItem.name}</p>
                               {item.notes && (
                                   <p className="text-red-500 text-sm font-medium mt-0.5 bg-red-50 inline-block px-1 rounded">
                                       Note: {item.notes}
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
                    className={`w-full py-4 text-center font-bold text-white uppercase tracking-wider transition-colors flex items-center justify-center gap-2
                        ${order.status === OrderStatus.READY ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}
                    `}
                    >
                    {order.status === OrderStatus.READY ? (
                        <> <CheckCircle /> Segna Consegnato </>
                    ) : (
                        <> Avanza Stato </>
                    )}
                    </button>
                )}
                {viewMode === 'history' && (
                     <div className="p-2 bg-slate-100 text-center text-xs text-slate-500 font-mono">
                         COMPLETATO
                     </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default KitchenDisplay;