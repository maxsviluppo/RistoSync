import React, { useState } from 'react';
import KitchenDisplay from './components/KitchenDisplay';
import WaiterPad from './components/WaiterPad';
import { ChefHat, Smartphone } from 'lucide-react';

const App: React.FC = () => {
  const [role, setRole] = useState<'kitchen' | 'waiter' | null>(null);

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400 mb-4">
                RistoSync AI
            </h1>
            <p className="text-slate-400 text-lg">Scegli la modalità per questo dispositivo</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
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
                onClick={() => setRole('waiter')}
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

        <div className="mt-16 text-slate-500 text-sm max-w-md text-center">
            <p>Per testare la sincronizzazione, apri questa pagina in due schede diverse: una come Cucina e una come Cameriere.</p>
        </div>
      </div>
    );
  }

  return (
    <>
        {role === 'kitchen' ? <KitchenDisplay /> : <WaiterPad />}
        
        {/* Helper to switch back (usually hidden in prod, kept for demo) */}
        <button 
            onClick={() => setRole(null)}
            className="fixed top-2 right-2 z-50 bg-black/20 hover:bg-black/50 text-white/50 hover:text-white p-1 rounded text-xs backdrop-blur-sm"
            title="Cambia Ruolo"
        >
            Esci
        </button>
    </>
  );
};

export default App;
