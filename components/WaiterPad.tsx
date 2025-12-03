import React, { useState, useEffect } from 'react';
import { Category, MenuItem, Order, OrderItem, OrderStatus } from '../types';
import { MENU_ITEMS } from '../constants';
import { addOrder, getOrders } from '../services/storageService';
import { askChefAI } from '../services/geminiService';
import { ShoppingBag, Send, X, Plus, Minus, Bot, AlertCircle, History, Clock } from 'lucide-react';

const WaiterPad: React.FC = () => {
  const [table, setTable] = useState<string>('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category>(Category.ANTIPASTI);
  const [isSending, setIsSending] = useState(false);
  
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
  // Dependency on table ensures we reload if user switches table number

  // --- Cart Management ---
  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.menuItem.id === item.id);
      if (existing) {
        return prev.map(i => i.menuItem.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { menuItem: item, quantity: 1, notes: '' }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(i => i.menuItem.id !== itemId));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.menuItem.id === itemId) {
        const newQ = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQ };
      }
      return i;
    }));
  };

  const updateNote = (itemId: string, note: string) => {
    setCart(prev => prev.map(i => i.menuItem.id === itemId ? { ...i, notes: note } : i));
  }

  // --- Submit Order ---
  const handleSendOrder = () => {
    if (!table || cart.length === 0) return;
    
    setIsSending(true);
    const newOrder: Order = {
      id: Date.now().toString(),
      tableNumber: table,
      items: cart,
      status: OrderStatus.PENDING,
      timestamp: Date.now(),
    };

    addOrder(newOrder);

    // Reset UI
    setTimeout(() => {
      setCart([]);
      setIsSending(false);
      // Wait a moment to ensure local storage event has fired or just manual reload
      loadExistingOrders(); 
      alert('Ordine inviato in cucina!');
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

  const total = cart.reduce((acc, item) => acc + (item.menuItem.price * item.quantity), 0);
  const pendingCount = existingOrders.filter(o => o.status !== OrderStatus.DELIVERED).length;

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 max-w-md mx-auto shadow-2xl overflow-hidden relative border-x border-gray-200">
      
      {/* Header */}
      <div className="bg-white p-4 shadow-sm z-10 flex justify-between items-center sticky top-0">
        <h1 className="font-bold text-xl text-blue-600 tracking-tight">RistoSync</h1>
        <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">Tav:</span>
            <input 
                type="number" 
                value={table}
                onChange={(e) => setTable(e.target.value)}
                placeholder="#"
                className="w-14 p-2 border rounded-lg text-center font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
            />
            {table && (
                <button 
                    onClick={() => setHistoryOpen(true)}
                    className={`p-2 rounded-lg transition-colors relative ${existingOrders.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}
                    title="Storico Tavolo"
                >
                    <History size={20} />
                    {pendingCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold animate-pulse">
                            {pendingCount}
                        </span>
                    )}
                </button>
            )}
        </div>
      </div>

      {/* Categories */}
      <div className="flex overflow-x-auto gap-2 p-2 bg-white border-b sticky top-[72px] z-10 no-scrollbar">
        {Object.values(Category).map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors
              ${selectedCategory === cat 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="grid grid-cols-1 gap-4">
          {MENU_ITEMS.filter(i => i.category === selectedCategory).map(item => (
            <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-800 text-lg">{item.name}</h3>
                    <button 
                        onClick={() => openAiFor(item)}
                        className="text-blue-400 hover:text-blue-600 p-1 rounded-full bg-blue-50"
                        title="Chiedi info"
                    >
                        <AlertCircle size={16} />
                    </button>
                </div>
                <p className="text-gray-500 text-sm line-clamp-2 leading-snug">{item.description}</p>
                <p className="font-semibold text-gray-900 mt-2">€ {item.price.toFixed(2)}</p>
              </div>
              <button
                onClick={() => addToCart(item)}
                className="ml-4 w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 active:scale-95 transition-transform"
              >
                <Plus size={24} />
              </button>
            </div>
          ))}
        </div>
        
        {/* Helper Button for AI */}
        <button 
            onClick={() => openAiFor(null)}
            className="fixed bottom-32 right-4 w-12 h-12 bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center z-20 hover:bg-purple-700 transition-colors"
        >
            <Bot size={24} />
        </button>
      </div>

      {/* Cart Summary (Sticky Bottom) */}
      {cart.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] rounded-t-2xl z-30 flex flex-col max-h-[50vh]">
          <div className="p-3 bg-gray-50 border-b flex justify-between items-center rounded-t-2xl">
            <div className="flex items-center gap-2">
                <ShoppingBag size={20} className="text-blue-600"/>
                <span className="font-bold">{cart.length} Articoli</span>
            </div>
            <span className="font-bold text-lg">Totale: € {total.toFixed(2)}</span>
          </div>

          <div className="overflow-y-auto p-4 space-y-4 flex-1">
            {cart.map((item) => (
              <div key={item.menuItem.id} className="flex flex-col gap-2 border-b pb-2 last:border-0">
                <div className="flex justify-between items-start">
                    <span className="font-medium">{item.menuItem.name}</span>
                    <button onClick={() => removeFromCart(item.menuItem.id)} className="text-red-400 hover:text-red-600">
                        <X size={16} />
                    </button>
                </div>
                <div className="flex justify-between items-center">
                    <input 
                        type="text" 
                        placeholder="Note cucina..." 
                        value={item.notes || ''}
                        onChange={(e) => updateNote(item.menuItem.id, e.target.value)}
                        className="text-xs bg-gray-100 p-2 rounded w-2/3 outline-none focus:ring-1 ring-blue-300"
                    />
                    <div className="flex items-center gap-3 bg-gray-100 rounded-lg p-1">
                        <button onClick={() => updateQuantity(item.menuItem.id, -1)} className="p-1"><Minus size={14}/></button>
                        <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.menuItem.id, 1)} className="p-1"><Plus size={14}/></button>
                    </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-white">
            <button
              onClick={handleSendOrder}
              disabled={!table || isSending}
              className={`w-full py-3 rounded-xl font-bold text-white text-lg flex items-center justify-center gap-2 shadow-lg transition-all
                ${(!table || isSending) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'}
              `}
            >
              {isSending ? 'Invio...' : <><Send size={20}/> Invia Ordine</>}
            </button>
            {!table && <p className="text-red-500 text-xs text-center mt-2">Inserisci numero tavolo per ordinare</p>}
          </div>
        </div>
      )}

      {/* Table History Modal */}
      {historyOpen && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center">
            <div className="bg-white w-full h-[90vh] sm:h-auto sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl flex flex-col animate-slide-up">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <h2 className="font-bold text-lg text-gray-800">Storico Tavolo {table}</h2>
                    <button onClick={() => setHistoryOpen(false)} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4">
                    {existingOrders.length === 0 ? (
                        <p className="text-center text-gray-400 mt-10">Nessun ordine presente per questo tavolo.</p>
                    ) : (
                        existingOrders.map(order => (
                            <div key={order.id} className="border rounded-lg p-3 bg-gray-50">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="text-xs text-gray-500 flex items-center gap-1">
                                        <Clock size={12}/> {new Date(order.timestamp).toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'})}
                                    </div>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase
                                        ${order.status === OrderStatus.PENDING ? 'bg-yellow-100 text-yellow-700' :
                                          order.status === OrderStatus.COOKING ? 'bg-orange-100 text-orange-700' :
                                          order.status === OrderStatus.READY ? 'bg-green-100 text-green-700' :
                                          'bg-gray-200 text-gray-600'}`}>
                                        {order.status}
                                    </span>
                                </div>
                                <ul className="space-y-1">
                                    {order.items.map((item, idx) => (
                                        <li key={idx} className="text-sm flex justify-between">
                                            <span><span className="font-bold">{item.quantity}x</span> {item.menuItem.name}</span>
                                            {item.notes && <span className="text-xs bg-red-50 text-red-500 px-1 rounded ml-2 max-w-[100px] truncate">{item.notes}</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))
                    )}
                </div>
                
                <div className="mt-4 pt-4 border-t text-center text-xs text-gray-400">
                    Gli ordini "Serviti" sono archiviati.
                </div>
            </div>
        </div>
      )}

      {/* AI Assistant Modal */}
      {aiModalOpen && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center">
            <div className="bg-white w-full h-[80vh] sm:h-auto sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl flex flex-col animate-slide-up">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2 text-purple-700">
                        <Bot size={24} />
                        <h2 className="font-bold text-lg">Assistente Chef</h2>
                    </div>
                    <button onClick={() => setAiModalOpen(false)} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto mb-4 bg-purple-50 rounded-xl p-4 min-h-[150px]">
                    {aiItem && (
                        <div className="mb-3 pb-3 border-b border-purple-200 text-sm text-purple-800">
                            <strong>Oggetto:</strong> {aiItem.name}
                        </div>
                    )}
                    {aiResponse ? (
                        <p className="text-gray-800 leading-relaxed">{aiResponse}</p>
                    ) : (
                        <p className="text-gray-400 italic text-center mt-4">Chiedimi ingredienti, allergeni o consigli...</p>
                    )}
                    {aiLoading && <p className="text-purple-600 text-center mt-4 animate-pulse">Consulto lo chef...</p>}
                </div>

                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={aiQuery}
                        onChange={(e) => setAiQuery(e.target.value)}
                        placeholder="Es: C'è glutine?"
                        className="flex-1 border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                    />
                    <button 
                        onClick={handleAskAI}
                        disabled={aiLoading || !aiQuery}
                        className="bg-purple-600 text-white p-3 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                        <Send size={20} />
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default WaiterPad;