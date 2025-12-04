import React, { useState, useEffect } from 'react';
import KitchenDisplay from './components/KitchenDisplay';
import WaiterPad from './components/WaiterPad';
import { ChefHat, Smartphone, User, ArrowRight } from 'lucide-react';
import { getWaiterName, saveWaiterName } from './services/storageService';

const App: React.FC = () => {
  const [role, setRole] = useState<'kitchen' | 'waiter' | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [waiterNameInput, setWaiterNameInput] = useState('');

  const handleWaiterClick = () => {
      const existingName = getWaiterName();
      if (existingName) {
          setRole('waiter');
      } else {
          setShowLogin(true);
      }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (waiterNameInput.trim()) {
          saveWaiterName(waiterNameInput.trim());
          setShowLogin(false);
          setRole('waiter');
      }
  };

  const handleLogout = () => {
      setRole(null);
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        
        {/* Login Modal */}
        {showLogin && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                <form onSubmit={handleLoginSubmit} className="bg-slate-800 border border-slate-700 p-8 rounded-3xl w-full max-w-sm shadow-2xl animate-slide-up">
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center border-2 border-blue-500">
                            <User size={40} className="text-blue-500" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white text-center mb-2">Chi sei?</h2>
                    <p className="text-slate-400 text-center text-sm mb-6">Inserisci il tuo nome per accedere all'app cameriere.</p>
                    
                    <input 
                        type="text" 
                        value={waiterNameInput}
                        onChange={(e) => setWaiterNameInput(e.target.value)}
                        placeholder="Nome (es. Marco)"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none mb-4 text-center font-bold text-lg"
                        autoFocus
                    />
                    
                    <div className="flex gap-3">
                        <button 
                            type="button" 
                            onClick={() => setShowLogin(false)}
                            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-bold transition-colors"
                        >
                            Annulla
                        </button>
                        <button 
                            type="submit" 
                            disabled={!waiterNameInput.trim()}
                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
                        >
                            Accedi
                        </button>
                    </div>
                </form>
            </div>
        )}

        <div className="text-center mb-12 z-10">
            <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400 mb-4">
                RistoSync AI
            </h1>
            <p className="text-slate-400 text-lg">Scegli la modalità per questo dispositivo</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl z-10">
            {/* Kitchen Card */}
            <button 
                onClick={() => setRole('kitchen')}
                className="group relative bg-slate-800 hover:bg-slate-700 border border-slate-700 p-8 rounded-2xl transition-all duration-300 hover:scale-105 hover:border-green-500 shadow-2xl flex flex-col items-center gap-6"
            >
                <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center border-2 border-slate-600 group-hover:border-green-500 transition-colors">
                    <ChefHat className="w-12 h-12 text-slate-300 group-hover:text-green-400" />
                </div>
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">Monitor Cucina</h2>
                    <p className="text-slate-400 text-sm">Visualizzazione 16:9 ottimizzata per schermi grandi. Gestione comande in tempo reale.</p>
                </div>
                <div className="absolute bottom-4 text-xs text-slate-600 uppercase tracking-widest font-semibold">Landscape Mode</div>
            </button>

            {/* Waiter Card */}
            <button 
                onClick={handleWaiterClick}
                className="group relative bg-slate-800 hover:bg-slate-700 border border-slate-700 p-8 rounded-2xl transition-all duration-300 hover:scale-105 hover:border-blue-500 shadow-2xl flex flex-col items-center gap-6"
            >
                <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center border-2 border-slate-600 group-hover:border-blue-500 transition-colors">
                    <Smartphone className="w-12 h-12 text-slate-300 group-hover:text-blue-400" />
                </div>
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">App Cameriere</h2>
                    <p className="text-slate-400 text-sm">Interfaccia 9:16 per smartphone. Presa comande veloce e assistente AI.</p>
                </div>
                <div className="absolute bottom-4 text-xs text-slate-600 uppercase tracking-widest font-semibold">Portrait Mode</div>
            </button>
        </div>

        <div className="mt-16 text-slate-500 text-sm max-w-md text-center z-10">
            <p>Per testare la sincronizzazione, apri questa pagina in due schede diverse: una come Cucina e una come Cameriere.</p>
        </div>
      </div>
    );
  }

  return (
    <>
        {role === 'kitchen' ? <KitchenDisplay onExit={handleLogout} /> : <WaiterPad onExit={handleLogout} />}
    </>
  );
};

export default App;