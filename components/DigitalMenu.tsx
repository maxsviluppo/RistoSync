import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Category, MenuItem } from '../types';
import { ChefHat, Utensils, Pizza, CakeSlice, Wine, Wheat, Milk, Egg, Nut, Fish, Bean, Flame, Leaf, Info, Search, Star, MapPin, Instagram, Facebook, ArrowUp, AlertTriangle, LogOut, Loader, Smartphone } from 'lucide-react';

interface DigitalMenuProps {
    restaurantId: string;
    isPreview?: boolean; // New Prop for embedded mode
}

const CATEGORY_ORDER = [Category.ANTIPASTI, Category.PRIMI, Category.SECONDI, Category.DOLCI, Category.BEVANDE];

const ALLERGENS_ICONS: Record<string, any> = {
    'Glutine': Wheat, 'Latticini': Milk, 'Uova': Egg, 'Frutta a guscio': Nut,
    'Pesce': Fish, 'Soia': Bean, 'Piccante': Flame, 'Vegano': Leaf
};

const DigitalMenu: React.FC<DigitalMenuProps> = ({ restaurantId, isPreview = false }) => {
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
                    console.error("Profile Fetch Error:", profileError);
                    if (profileError.code === 'PGRST116' || profileError.message.includes('security')) {
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
                    setRlsError(false); 
                }

            } catch (error: any) {
                console.error("Critical Error fetching public menu:", error);
                setError("Errore di caricamento.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();

        // Scroll listener (only attach to window if not preview, otherwise attach to container ref would be better but simplified here)
        const handleScroll = () => setShowScrollTop(window.scrollY > 300);
        if (!isPreview) {
            window.addEventListener('scroll', handleScroll);
        }
        return () => {
            if (!isPreview) window.removeEventListener('scroll', handleScroll);
        };
    }, [restaurantId, isPreview]);

    const scrollToCategory = (cat: Category) => {
        setActiveCategory(cat);
        const element = document.getElementById(`cat-${cat}`);
        if (element) {
            // Adjust offset for preview mode vs full screen
            const container = isPreview ? document.getElementById('digital-menu-container') : window;
            const offset = 140; 
            
            if (isPreview && container instanceof HTMLElement) {
                 // For preview, we need to scroll the container
                 element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                 const bodyRect = document.body.getBoundingClientRect().top;
                 const elementRect = element.getBoundingClientRect().top;
                 const elementPosition = elementRect - bodyRect;
                 const offsetPosition = elementPosition - offset;
                 window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }
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
        <div className={`${isPreview ? 'h-full bg-slate-900 rounded-[2.5rem]' : 'min-h-screen bg-slate-900'} flex flex-col items-center justify-center text-white p-4`}>
            <Loader className="animate-spin text-orange-500 mb-4" size={48} />
            <p className="animate-pulse font-medium text-lg">Caricamento...</p>
        </div>
    );

    // SCREEN ERRORI
    if (rlsError || (menuItems.length === 0 && !loading)) {
        return (
            <div className={`${isPreview ? 'h-full bg-slate-950 rounded-[2.5rem]' : 'min-h-screen bg-slate-950'} flex flex-col items-center justify-center text-white p-8 text-center`}>
                <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                     <AlertTriangle size={40} className="text-orange-500" />
                </div>
                <h2 className="text-2xl font-black mb-3">Menu Non Disponibile</h2>
                
                {rlsError ? (
                    <div className="bg-slate-900 p-4 rounded-2xl border border-red-500/30 max-w-xs text-sm">
                        <p className="text-slate-300 mb-2 font-medium">
                            {isPreview ? "Permessi pubblici non attivi." : "Il ristorante non è accessibile."}
                        </p>
                        {isPreview && <p className="text-xs text-orange-400">Esegui lo script SQL nella dashboard Super Admin.</p>}
                    </div>
                ) : (
                    <div className="max-w-md">
                        <p className="text-slate-400 mb-6 text-sm">
                            Nessun piatto inserito. Vai su "Menu" per aggiungerne uno.
                        </p>
                    </div>
                )}
                
                {!isPreview && (
                    <button onClick={exitMenuMode} className="mt-8 bg-slate-800 hover:bg-slate-700 text-white px-8 py-4 rounded-xl font-bold border border-slate-700 transition-all flex items-center gap-2">
                        <LogOut size={20}/> Torna alla Home
                    </button>
                )}
            </div>
        );
    }

    if (error) return (
        <div className={`${isPreview ? 'h-full' : 'min-h-screen'} bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center`}>
            <AlertTriangle size={48} className="text-red-500 mb-4" />
            <p className="text-slate-400 mb-6">{error}</p>
        </div>
    );

    // MAIN RENDER
    return (
        <div 
            id="digital-menu-container"
            className={`${isPreview ? 'h-full overflow-y-auto relative rounded-[2.5rem] bg-slate-50 scrollbar-hide' : 'min-h-screen bg-slate-50 pb-24'}`}
        >
            {/* HERO HEADER */}
            <div className={`bg-slate-900 text-white relative overflow-hidden shadow-2xl z-10 ${isPreview ? 'rounded-b-[2rem]' : 'rounded-b-[2.5rem]'}`}>
                <div className="absolute top-0 left-0 w-full h-full opacity-30 bg-[url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80')] bg-cover bg-center"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 to-slate-900"></div>
                
                <div className={`relative z-10 px-6 text-center ${isPreview ? 'pt-8 pb-6' : 'pt-12 pb-10'}`}>
                    <div className={`inline-block p-3 rounded-3xl bg-orange-500 shadow-xl shadow-orange-500/30 mb-3 transform -rotate-3 animate-slide-up`}>
                        <ChefHat size={isPreview ? 24 : 40} className="text-white" />
                    </div>
                    <h1 className={`${isPreview ? 'text-2xl' : 'text-4xl'} font-black mb-2 tracking-tight leading-none`}>{restaurantName}</h1>
                    <div className="flex justify-center gap-4 text-slate-300 text-xs mb-4 font-medium">
                         <span className="flex items-center gap-1"><Star size={12} className="text-yellow-400 fill-yellow-400"/> Benvenuti</span>
                         <span className="flex items-center gap-1"><MapPin size={12}/> Menu</span>
                    </div>
                    
                    {/* Search Bar */}
                    <div className="relative max-w-sm mx-auto group">
                        <input 
                            type="text" 
                            placeholder="Cerca piatto..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl pl-10 pr-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-slate-900/90 transition-all shadow-lg ${isPreview ? 'py-2 text-xs' : 'py-4 text-base'}`}
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" size={isPreview ? 14 : 20} />
                    </div>
                </div>
            </div>

            {/* CATEGORY NAV (STICKY) */}
            <div className={`sticky top-0 z-40 bg-slate-50/95 backdrop-blur-md shadow-sm border-b border-slate-200/50 ${isPreview ? 'py-2' : 'py-4'}`}>
                <div className="flex overflow-x-auto gap-2 px-4 no-scrollbar snap-x">
                    {CATEGORY_ORDER.map(cat => (
                        <button 
                            key={cat} 
                            onClick={() => scrollToCategory(cat)}
                            className={`flex items-center gap-2 rounded-2xl whitespace-nowrap font-bold transition-all snap-center shadow-sm border ${isPreview ? 'px-3 py-2 text-xs' : 'px-5 py-3 text-sm'} ${activeCategory === cat ? 'bg-slate-900 text-white border-slate-900 shadow-slate-900/20 scale-105' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                        >
                            {getCategoryIcon(cat, isPreview ? 14 : 18)} {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* MENU CONTENT */}
            <div className={`px-4 max-w-2xl mx-auto ${isPreview ? 'py-4 space-y-6' : 'py-8 space-y-12'}`}>
                {CATEGORY_ORDER.map(cat => {
                    const items = filteredItems.filter(i => i.category === cat);
                    if (items.length === 0) return null;

                    return (
                        <div key={cat} id={`cat-${cat}`} className="scroll-mt-32">
                            <div className={`flex items-center gap-3 mb-4 ${isPreview ? 'mt-2' : 'mt-0'}`}>
                                <div className="p-1.5 bg-orange-100 rounded-lg text-orange-600">{getCategoryIcon(cat, isPreview ? 16 : 24)}</div>
                                <h2 className={`${isPreview ? 'text-lg' : 'text-2xl'} font-black text-slate-800 uppercase tracking-tight`}>{cat}</h2>
                            </div>

                            <div className={`grid ${isPreview ? 'gap-3' : 'gap-6'}`}>
                                {items.map(item => (
                                    <div key={item.id} className={`bg-white rounded-[1.5rem] shadow-sm border border-slate-100 flex flex-col relative overflow-hidden group ${isPreview ? 'p-4 gap-2' : 'p-6 gap-4 hover:scale-[1.01] transition-transform shadow-xl shadow-slate-200/50'}`}>
                                        <div className="flex justify-between items-start gap-3">
                                            <h3 className={`${isPreview ? 'text-sm' : 'text-xl'} font-bold text-slate-900 leading-tight w-[70%]`}>{item.name}</h3>
                                            <div className="bg-slate-900 text-white px-3 py-1 rounded-lg font-black text-sm shadow-lg whitespace-nowrap">
                                                € {item.price.toFixed(2)}
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            <p className={`text-slate-500 leading-relaxed flex-1 ${isPreview ? 'text-xs' : 'text-sm'}`}>
                                                {item.description || <span className="italic opacity-50">Nessuna descrizione.</span>}
                                            </p>
                                        </div>

                                        {/* Allergens */}
                                        {item.allergens && item.allergens.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pt-3 border-t border-slate-50 mt-1">
                                                {item.allergens.map(alg => {
                                                    const Icon = ALLERGENS_ICONS[alg] || Info;
                                                    return (
                                                        <span key={alg} className={`inline-flex items-center gap-1 font-bold uppercase text-slate-500 bg-slate-100 rounded-md ${isPreview ? 'text-[8px] px-2 py-1' : 'text-[10px] px-3 py-1.5'}`}>
                                                            <Icon size={isPreview ? 10 : 14} className="text-orange-500"/> {alg}
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        )}
                                        
                                        {/* Decorative gradient blob */}
                                        <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-gradient-to-br from-orange-100 to-transparent rounded-full opacity-50 pointer-events-none"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {filteredItems.length === 0 && (
                    <div className="text-center py-10 text-slate-400">
                        <Search size={40} className="mx-auto mb-4 opacity-20"/>
                        <p className="font-bold text-sm">Nessun piatto trovato</p>
                    </div>
                )}
            </div>

            {/* FOOTER */}
            <div className={`text-center bg-white rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] border-t border-slate-100 ${isPreview ? 'py-8 mt-4' : 'py-12 mt-12'}`}>
                 <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-4">Condividi la tua esperienza</p>
                 <div className="flex justify-center gap-4 mb-6">
                     <button className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-pink-600 shadow-sm border border-slate-100"><Instagram size={18}/></button>
                     <button className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-slate-100"><Facebook size={18}/></button>
                 </div>
                 <div className="flex items-center justify-center gap-2 text-slate-300 font-bold text-xs">
                     <ChefHat size={14}/> Powered by RistoSync
                 </div>
            </div>

            {/* PREVIEW MODE DOES NOT HAVE EXIT BUTTONS */}
            {!isPreview && (
                <>
                    <button 
                        onClick={exitMenuMode}
                        className="fixed bottom-6 left-6 p-3 bg-slate-900 text-white rounded-full z-50 shadow-2xl hover:scale-110 transition-all opacity-50 hover:opacity-100"
                        title="Esci dal Menu Digitale"
                    >
                        <LogOut size={20}/>
                    </button>
                    {showScrollTop && (
                        <button 
                            onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}
                            className="fixed bottom-6 right-6 p-4 bg-orange-500 text-white rounded-full shadow-2xl shadow-orange-500/30 z-50 animate-bounce hover:bg-orange-600 transition-colors"
                        >
                            <ArrowUp size={24}/>
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

export default DigitalMenu;