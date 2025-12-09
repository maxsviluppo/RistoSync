import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Category, MenuItem } from '../types';
import { ChefHat, Utensils, Pizza, CakeSlice, Wine, Wheat, Milk, Egg, Nut, Fish, Bean, Flame, Leaf, Info, Search, Star, MapPin, Instagram, Facebook, ArrowUp, AlertTriangle, LogOut, Loader, Smartphone } from 'lucide-react';

interface DigitalMenuProps {
    restaurantId: string;
}

const CATEGORY_ORDER = [Category.ANTIPASTI, Category.PRIMI, Category.SECONDI, Category.DOLCI, Category.BEVANDE];

const ALLERGENS_ICONS: Record<string, any> = {
    'Glutine': Wheat, 'Latticini': Milk, 'Uova': Egg, 'Frutta a guscio': Nut,
    'Pesce': Fish, 'Soia': Bean, 'Piccante': Flame, 'Vegano': Leaf
};

const DigitalMenu: React.FC<DigitalMenuProps> = ({ restaurantId }) => {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [restaurantName, setRestaurantName] = useState('Menu Digitale');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<Category>(Category.ANTIPASTI);
    const [searchTerm, setSearchTerm] = useState('');
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [rlsError, setRlsError] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!supabase) {
                setError("Database non connesso.");
                setLoading(false);
                return;
            }

            try {
                // 1. Fetch Restaurant Profile (Name)
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('restaurant_name')
                    .eq('id', restaurantId)
                    .single();
                
                if (profile) {
                    setRestaurantName(profile.restaurant_name);
                } else if (profileError) {
                    // Check specifically for RLS/Permission errors
                    console.error("Profile Fetch Error:", profileError);
                    if (profileError.code === 'PGRST116' || profileError.message.includes('security')) {
                        // Likely RLS is blocking public access
                        setRlsError(true);
                    }
                }

                // 2. Fetch Menu Items (Public Read)
                const { data: items, error: menuError } = await supabase
                    .from('menu_items')
                    .select('*')
                    .eq('user_id', restaurantId);

                if (menuError) {
                    console.error("Menu fetch error:", menuError);
                }

                if (items && items.length > 0) {
                    setMenuItems(items);
                    setRlsError(false); // If we got items, RLS for items is likely fine
                }

            } catch (error: any) {
                console.error("Critical Error fetching public menu:", error);
                setError("Errore di caricamento.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();

        const handleScroll = () => setShowScrollTop(window.scrollY > 300);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [restaurantId]);

    const scrollToCategory = (cat: Category) => {
        setActiveCategory(cat);
        const element = document.getElementById(`cat-${cat}`);
        if (element) {
            const offset = 140; // Header offset
            const bodyRect = document.body.getBoundingClientRect().top;
            const elementRect = element.getBoundingClientRect().top;
            const elementPosition = elementRect - bodyRect;
            const offsetPosition = elementPosition - offset;
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
    };

    const getCategoryIcon = (cat: Category, size: number = 18) => {
        switch (cat) { case Category.ANTIPASTI: return <Pizza size={size} />; case Category.PRIMI: return <ChefHat size={size} />; case Category.SECONDI: return <Utensils size={size} />; case Category.DOLCI: return <CakeSlice size={size} />; case Category.BEVANDE: return <Wine size={size} />; default: return <Utensils size={size} />; }
    };

    const filteredItems = useMemo(() => {
        return menuItems.filter(item => 
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [menuItems, searchTerm]);

    const exitMenuMode = () => {
        const url = new URL(window.location.href);
        url.searchParams.delete('menu');
        window.location.href = url.toString();
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
            <Loader className="animate-spin text-orange-500 mb-4" size={48} />
            <p className="animate-pulse font-medium text-lg">Preparazione Tavolo...</p>
        </div>
    );

    // SCREEN ERRORI (Permessi mancanti o DB vuoto)
    if (rlsError || (menuItems.length === 0 && !loading)) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-8 text-center">
                <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                     <AlertTriangle size={40} className="text-orange-500" />
                </div>
                <h2 className="text-3xl font-black mb-3">Menu Non Disponibile</h2>
                
                {rlsError ? (
                    <div className="bg-slate-900 p-6 rounded-2xl border border-red-500/30 max-w-md">
                        <p className="text-slate-300 mb-4 font-medium">
                            Sembra che i permessi di visualizzazione pubblica non siano attivi.
                        </p>
                        <div className="bg-black/40 p-3 rounded-lg text-left mb-4">
                            <p className="text-xs text-orange-400 font-bold uppercase mb-1">Per l'Admin del Ristorante:</p>
                            <p className="text-xs text-slate-400">
                                1. Accedi al pannello di controllo.<br/>
                                2. Apri la <strong>Dashboard Super Admin</strong> (pulsante scudo).<br/>
                                3. Clicca sull'icona <strong>Mondo</strong> (Abilita Menu Pubblico).<br/>
                                4. Esegui lo script SQL fornito su Supabase.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-md">
                        <p className="text-slate-400 mb-6">
                            Questo ristorante non ha ancora inserito piatti nel menu digitale.
                        </p>
                    </div>
                )}

                <button onClick={exitMenuMode} className="mt-8 bg-slate-800 hover:bg-slate-700 text-white px-8 py-4 rounded-xl font-bold border border-slate-700 transition-all flex items-center gap-2">
                    <LogOut size={20}/> Torna alla Home
                </button>
            </div>
        );
    }

    if (error) return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center">
            <AlertTriangle size={48} className="text-red-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Errore Tecnico</h2>
            <p className="text-slate-400 mb-6">{error}</p>
            <button onClick={exitMenuMode} className="bg-slate-800 px-6 py-3 rounded-xl font-bold border border-slate-700">Torna alla Home</button>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
            {/* HERO HEADER */}
            <div className="bg-slate-900 text-white relative overflow-hidden rounded-b-[2.5rem] shadow-2xl z-10">
                <div className="absolute top-0 left-0 w-full h-full opacity-30 bg-[url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80')] bg-cover bg-center"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 to-slate-900"></div>
                
                <div className="relative z-10 px-6 pt-12 pb-10 text-center">
                    <div className="inline-block p-4 rounded-3xl bg-orange-500 shadow-xl shadow-orange-500/30 mb-5 transform -rotate-3 animate-slide-up">
                        <ChefHat size={40} className="text-white" />
                    </div>
                    <h1 className="text-4xl font-black mb-3 tracking-tight leading-none">{restaurantName}</h1>
                    <div className="flex justify-center gap-4 text-slate-300 text-sm mb-6 font-medium">
                         <span className="flex items-center gap-1.5"><Star size={16} className="text-yellow-400 fill-yellow-400"/> Benvenuti</span>
                         <span className="flex items-center gap-1.5"><MapPin size={16}/> Menu Digitale</span>
                    </div>
                    
                    {/* Search Bar */}
                    <div className="relative max-w-sm mx-auto group">
                        <input 
                            type="text" 
                            placeholder="Cerca piatto o ingrediente..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-slate-900/90 transition-all text-base shadow-lg"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" size={20} />
                    </div>
                </div>
            </div>

            {/* CATEGORY NAV (STICKY) */}
            <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-md py-4 shadow-sm border-b border-slate-200/50">
                <div className="flex overflow-x-auto gap-3 px-4 no-scrollbar snap-x">
                    {CATEGORY_ORDER.map(cat => (
                        <button 
                            key={cat} 
                            onClick={() => scrollToCategory(cat)}
                            className={`flex items-center gap-2 px-5 py-3 rounded-2xl whitespace-nowrap text-sm font-bold transition-all snap-center shadow-sm border ${activeCategory === cat ? 'bg-slate-900 text-white border-slate-900 shadow-slate-900/20 scale-105' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                        >
                            {getCategoryIcon(cat, 18)} {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* MENU CONTENT */}
            <div className="px-4 py-8 max-w-2xl mx-auto space-y-12">
                {CATEGORY_ORDER.map(cat => {
                    const items = filteredItems.filter(i => i.category === cat);
                    if (items.length === 0) return null;

                    return (
                        <div key={cat} id={`cat-${cat}`} className="scroll-mt-48">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-2 bg-orange-100 rounded-xl text-orange-600">{getCategoryIcon(cat, 24)}</div>
                                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{cat}</h2>
                            </div>

                            <div className="grid gap-6">
                                {items.map(item => (
                                    <div key={item.id} className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col gap-4 relative overflow-hidden group hover:scale-[1.01] transition-transform">
                                        <div className="flex justify-between items-start gap-4">
                                            <h3 className="text-xl font-bold text-slate-900 leading-tight w-[70%]">{item.name}</h3>
                                            <div className="bg-slate-900 text-white px-4 py-2 rounded-xl font-black text-lg shadow-lg">
                                                € {item.price.toFixed(2)}
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            <p className="text-slate-500 text-sm leading-relaxed flex-1">
                                                {item.description || <span className="italic opacity-50">Nessuna descrizione.</span>}
                                            </p>
                                        </div>

                                        {/* Allergens */}
                                        {item.allergens && item.allergens.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-50 mt-2">
                                                {item.allergens.map(alg => {
                                                    const Icon = ALLERGENS_ICONS[alg] || Info;
                                                    return (
                                                        <span key={alg} className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                                                            <Icon size={14} className="text-orange-500"/> {alg}
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        )}
                                        
                                        {/* Decorative gradient blob */}
                                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-gradient-to-br from-orange-100 to-transparent rounded-full opacity-50 pointer-events-none"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {filteredItems.length === 0 && (
                    <div className="text-center py-20 text-slate-400">
                        <Search size={64} className="mx-auto mb-6 opacity-20"/>
                        <p className="font-bold text-lg">Nessun piatto trovato</p>
                        <p className="text-sm">Prova a cercare qualcos'altro.</p>
                    </div>
                )}
            </div>

            {/* FOOTER */}
            <div className="py-12 text-center bg-white rounded-t-[3rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] border-t border-slate-100">
                 <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6">Condividi la tua esperienza</p>
                 <div className="flex justify-center gap-6 mb-10">
                     <button className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-pink-600 shadow-sm border border-slate-100 hover:scale-110 transition-transform"><Instagram size={24}/></button>
                     <button className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm border border-slate-100 hover:scale-110 transition-transform"><Facebook size={24}/></button>
                 </div>
                 <div className="flex items-center justify-center gap-2 text-slate-300 font-bold text-sm">
                     <ChefHat size={16}/> Powered by RistoSync
                 </div>
            </div>

            {/* HIDDEN EXIT BUTTON (For testing on same device) */}
            <button 
                onClick={exitMenuMode}
                className="fixed bottom-6 left-6 p-3 bg-slate-900 text-white rounded-full z-50 shadow-2xl hover:scale-110 transition-all opacity-50 hover:opacity-100"
                title="Esci dal Menu Digitale"
            >
                <LogOut size={20}/>
            </button>

            {/* BACK TO TOP */}
            {showScrollTop && (
                <button 
                    onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}
                    className="fixed bottom-6 right-6 p-4 bg-orange-500 text-white rounded-full shadow-2xl shadow-orange-500/30 z-50 animate-bounce hover:bg-orange-600 transition-colors"
                >
                    <ArrowUp size={24}/>
                </button>
            )}
        </div>
    );
};

export default DigitalMenu;