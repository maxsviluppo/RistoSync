import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Category, MenuItem, SocialLinks } from '../types';
import { ChefHat, Utensils, Pizza, CakeSlice, Wine, Wheat, Milk, Egg, Nut, Fish, Bean, Flame, Leaf, Info, Search, Star, MapPin, Instagram, Facebook, ArrowUp, AlertTriangle, LogOut, Loader, Smartphone, UtensilsCrossed, Sandwich, Youtube, Linkedin, Music, Compass, Store, Globe } from 'lucide-react';

interface DigitalMenuProps {
    restaurantId: string;
    isPreview?: boolean;
    activeMenuData?: MenuItem[]; // Data injected directly (for Preview)
    activeRestaurantName?: string; // Name injected directly (for Preview)
}

const CATEGORY_ORDER = [Category.MENU_COMPLETO, Category.ANTIPASTI, Category.PANINI, Category.PIZZE, Category.PRIMI, Category.SECONDI, Category.DOLCI, Category.BEVANDE];

const ALLERGENS_CONFIG = [
    { id: 'Glutine', icon: Wheat, label: 'Glutine' },
    { id: 'Latticini', icon: Milk, label: 'Latticini' },
    { id: 'Uova', icon: Egg, label: 'Uova' },
    { id: 'Frutta a guscio', icon: Nut, label: 'Noci' }, 
    { id: 'Pesce', icon: Fish, label: 'Pesce' },
    { id: 'Soia', icon: Bean, label: 'Soia' }, 
    { id: 'Piccante', icon: Flame, label: 'Piccante' },
    { id: 'Vegano', icon: Leaf, label: 'Vegano' },
];

const ALLERGENS_ICONS: Record<string, any> = {
    'Glutine': Wheat, 'Latticini': Milk, 'Uova': Egg, 'Frutta a guscio': Nut,
    'Pesce': Fish, 'Soia': Bean, 'Piccante': Flame, 'Vegano': Leaf
};

const DigitalMenu: React.FC<DigitalMenuProps> = ({ restaurantId, isPreview = false, activeMenuData, activeRestaurantName }) => {
    const [menuItems, setMenuItems] = useState<MenuItem[]>(activeMenuData || []);
    const [restaurantName, setRestaurantName] = useState(activeRestaurantName || 'Menu Digitale');
    const [socials, setSocials] = useState<SocialLinks>({});
    // If data is provided via props, we are not loading.
    const [loading, setLoading] = useState(!activeMenuData);
    const [error, setError] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<Category>(Category.ANTIPASTI);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [rlsError, setRlsError] = useState(false);

    // Sync state if props change (for real-time preview updates)
    useEffect(() => {
        if (activeMenuData) {
            setMenuItems(activeMenuData);
            setLoading(false);
        }
        if (activeRestaurantName) {
            setRestaurantName(activeRestaurantName);
        }
    }, [activeMenuData, activeRestaurantName]);

    useEffect(() => {
        const fetchData = async () => {
            if (!supabase) {
                if (!activeMenuData) setError("Database non connesso.");
                setLoading(false);
                return;
            }

            try {
                // 1. Fetch Restaurant Profile (Name & Socials)
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('restaurant_name, settings')
                    .eq('id', restaurantId)
                    .single();
                
                if (profile) {
                    setRestaurantName(profile.restaurant_name);
                    if (profile.settings?.restaurantProfile?.socials) {
                        setSocials(profile.settings.restaurantProfile.socials);
                    }
                } else if (profileError) {
                    console.error("Profile Fetch Error:", profileError);
                    if (profileError.code === 'PGRST116' || profileError.message.includes('security')) {
                        setRlsError(true);
                    }
                }

                // 2. Fetch Menu Items (Public Read)
                // If activeMenuData provided (Preview), we skip fetching menu items
                if (!activeMenuData) {
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
                }

            } catch (error: any) {
                console.error("Critical Error fetching public menu:", error);
                if (!activeMenuData) setError("Errore di caricamento.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();

        // Scroll listener logic
        const handleScroll = () => setShowScrollTop(window.scrollY > 300);
        if (!isPreview) {
            window.addEventListener('scroll', handleScroll);
        }
        return () => {
            if (!isPreview) window.removeEventListener('scroll', handleScroll);
        };
    }, [restaurantId, isPreview, activeMenuData]); 

    const scrollToCategory = (cat: Category) => {
        setActiveCategory(cat);
        const element = document.getElementById(`cat-${cat}`);
        if (element) {
            const container = isPreview ? document.getElementById('digital-menu-container') : window;
            
            if (isPreview && container instanceof HTMLElement) {
                 element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                 const offset = 140; 
                 const bodyRect = document.body.getBoundingClientRect().top;
                 const elementRect = element.getBoundingClientRect().top;
                 const elementPosition = elementRect - bodyRect;
                 const offsetPosition = elementPosition - offset;
                 window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }
        }
    };

    const getCategoryIcon = (cat: Category, size: number = 18) => {
        switch (cat) { case Category.MENU_COMPLETO: return <Star size={size}/>; case Category.ANTIPASTI: return <UtensilsCrossed size={size} />; case Category.PANINI: return <Sandwich size={size} />; case Category.PIZZE: return <Pizza size={size} />; case Category.PRIMI: return <ChefHat size={size} />; case Category.SECONDI: return <Utensils size={size} />; case Category.DOLCI: return <CakeSlice size={size} />; case Category.BEVANDE: return <Wine size={size} />; default: return <Utensils size={size} />; }
    };

    const exitMenuMode = () => {
        const url = new URL(window.location.href);
        url.searchParams.delete('menu');
        window.location.href = url.toString();
    };

    // FILTER: Determine visible categories (hide empty ones)
    const visibleCategories = useMemo(() => {
        return CATEGORY_ORDER.filter(cat => menuItems.some(item => item.category === cat));
    }, [menuItems]);

    // Social Button Helper
    const SocialButton = ({ link, icon: Icon, colorClass, label }: { link?: string, icon: any, colorClass: string, label: string }) => {
        if (!link) return null;
        const href = link.startsWith('http') ? link : `https://${link}`;
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border border-slate-200 hover:scale-110 transition-transform ${colorClass}`} title={label}>
                <Icon size={20} />
            </a>
        );
    };

    if (loading) return (
        <div className={`${isPreview ? 'h-full bg-slate-900 rounded-[2.5rem]' : 'min-h-screen bg-slate-900'} flex flex-col items-center justify-center text-white p-4`}>
            <Loader className="animate-spin text-orange-500 mb-4" size={48} />
            <p className="animate-pulse font-medium text-lg">Caricamento...</p>
        </div>
    );

    // SCREEN ERRORI
    if ((rlsError || (menuItems.length === 0 && !loading)) && !activeMenuData) {
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

    if (error && !activeMenuData) return (
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
            {/* THIN HEADER */}
            <div className={`bg-slate-900 text-white relative shadow-md z-20 ${isPreview ? 'rounded-b-2xl pt-8 pb-3' : 'pt-4 pb-4 sticky top-0'}`}>
                <div className="px-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-orange-500 shadow-lg shadow-orange-500/20">
                            <ChefHat size={isPreview ? 18 : 22} className="text-white" />
                        </div>
                        <h1 className={`${isPreview ? 'text-lg' : 'text-xl'} font-bold tracking-tight leading-none truncate max-w-[200px]`}>{restaurantName}</h1>
                    </div>
                    {/* Optional Status Indicator or Mini Icon */}
                    <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded-full border border-slate-700">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-[10px] font-bold text-slate-300 uppercase">Open</span>
                    </div>
                </div>
            </div>

            {/* CATEGORY NAV (STICKY BELOW HEADER) */}
            <div className={`sticky z-10 bg-slate-50/95 backdrop-blur-md shadow-sm border-b border-slate-200/50 ${isPreview ? 'top-0 py-2' : 'top-[60px] py-3'}`}>
                <div className="flex overflow-x-auto gap-2 px-4 no-scrollbar snap-x">
                    {visibleCategories.map(cat => (
                        <button 
                            key={cat} 
                            onClick={() => scrollToCategory(cat)}
                            className={`flex items-center gap-2 rounded-xl whitespace-nowrap font-bold transition-all snap-center shadow-sm border ${isPreview ? 'px-3 py-1.5 text-[10px]' : 'px-4 py-2 text-xs'} ${activeCategory === cat ? 'bg-slate-900 text-white border-slate-900 shadow-slate-900/20 scale-105' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                        >
                            {getCategoryIcon(cat, isPreview ? 12 : 14)} {cat}
                        </button>
                    ))}
                    {visibleCategories.length === 0 && (
                         <div className="w-full text-center text-xs text-slate-400 py-2 italic">Nessuna categoria disponibile</div>
                    )}
                </div>
            </div>

            {/* MENU CONTENT */}
            <div className={`px-4 max-w-2xl mx-auto ${isPreview ? 'py-4 space-y-6' : 'py-6 space-y-10'}`}>
                {visibleCategories.map(cat => {
                    const items = menuItems.filter(i => i.category === cat);
                    return (
                        <div key={cat} id={`cat-${cat}`} className="scroll-mt-36">
                            <div className={`flex items-center gap-2 mb-3 ${isPreview ? 'mt-2' : 'mt-0'}`}>
                                <h2 className={`${isPreview ? 'text-base' : 'text-lg'} font-black text-slate-800 uppercase tracking-tight`}>{cat}</h2>
                                <div className="h-px bg-slate-200 flex-1 ml-2"></div>
                            </div>

                            <div className={`grid ${isPreview ? 'gap-3' : 'gap-4'}`}>
                                {items.map(item => {
                                    // COMBO ITEMS DISPLAY LOGIC
                                    const isCombo = item.category === Category.MENU_COMPLETO;
                                    let comboChildren: MenuItem[] = [];
                                    if(isCombo && item.comboItems) {
                                        comboChildren = activeMenuData ? activeMenuData.filter(i => item.comboItems?.includes(i.id)) : [];
                                    }

                                    return (
                                        <div key={item.id} className={`bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden group ${isPreview ? 'p-3 gap-1.5' : 'p-5 gap-3'}`}>
                                            <div className="flex justify-between items-start gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <h3 className={`${isPreview ? 'text-sm' : 'text-base'} font-bold text-slate-900 leading-tight`}>{item.name}</h3>
                                                        <div className="font-bold text-orange-600 text-sm whitespace-nowrap ml-2">
                                                            € {item.price.toFixed(2)}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* 1. INGREDIENTS (New Order) */}
                                                    {item.ingredients && (
                                                        <p className={`text-slate-600 font-medium italic mt-1 leading-snug ${isPreview ? 'text-[10px]' : 'text-xs'}`}>
                                                            {item.ingredients}
                                                        </p>
                                                    )}

                                                    {/* COMBO CHILDREN LISTING */}
                                                    {isCombo && comboChildren.length > 0 && (
                                                        <div className="mt-2 mb-1">
                                                            <p className={`text-[9px] font-bold text-slate-400 uppercase mb-1`}>Include:</p>
                                                            <ul className={`list-disc list-inside text-slate-700 ${isPreview ? 'text-[10px]' : 'text-xs'}`}>
                                                                {comboChildren.map(child => (
                                                                    <li key={child.id}>{child.name}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {/* 2. DESCRIPTION */}
                                                    <p className={`text-slate-500 leading-relaxed mt-2 border-t border-dashed border-slate-100 pt-2 ${isPreview ? 'text-[10px]' : 'text-xs'}`}>
                                                        {item.description || <span className="italic opacity-50">.</span>}
                                                    </p>
                                                    
                                                    {/* 3. ALLERGENS */}
                                                    {item.allergens && item.allergens.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 pt-2 mt-1">
                                                            {item.allergens.map(alg => {
                                                                const Icon = ALLERGENS_ICONS[alg] || Info;
                                                                return (
                                                                    <span key={alg} className={`inline-flex items-center gap-1 font-bold uppercase text-slate-500 bg-slate-100 rounded-md ${isPreview ? 'text-[8px] px-1.5 py-0.5' : 'text-[9px] px-2 py-1'}`}>
                                                                        <Icon size={isPreview ? 8 : 10} className="text-orange-500"/> {alg}
                                                                    </span>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* DISH IMAGE */}
                                                {item.image && (
                                                    <div className={`shrink-0 rounded-xl border border-slate-100 overflow-hidden shadow-sm ${isPreview ? 'w-16 h-16' : 'w-24 h-24'}`}>
                                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover"/>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {visibleCategories.length === 0 && (
                    <div className="text-center py-10 text-slate-400">
                        <Search size={40} className="mx-auto mb-4 opacity-20"/>
                        <p className="font-bold text-sm">Menu vuoto</p>
                    </div>
                )}
            </div>

            {/* FOOTER - SOCIAL & LINKS */}
            <div className={`text-center bg-white rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] border-t border-slate-100 ${isPreview ? 'py-6 mt-4' : 'py-8 mt-8'}`}>
                 <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-4">Seguici & Contattaci</p>
                 
                 <div className="flex flex-wrap justify-center gap-3 mb-6 px-6">
                     <SocialButton link={socials.instagram} icon={Instagram} colorClass="text-pink-600 bg-pink-50" label="Instagram" />
                     <SocialButton link={socials.facebook} icon={Facebook} colorClass="text-blue-600 bg-blue-50" label="Facebook" />
                     <SocialButton link={socials.tiktok} icon={Music} colorClass="text-slate-900 bg-slate-100" label="TikTok" />
                     <SocialButton link={socials.google} icon={Store} colorClass="text-blue-500 bg-blue-50" label="Google Business" />
                     <SocialButton link={socials.tripadvisor} icon={Compass} colorClass="text-green-600 bg-green-50" label="TripAdvisor" />
                     <SocialButton link={socials.thefork} icon={UtensilsCrossed} colorClass="text-emerald-600 bg-emerald-50" label="TheFork" />
                     <SocialButton link={socials.youtube} icon={Youtube} colorClass="text-red-600 bg-red-50" label="YouTube" />
                     <SocialButton link={socials.linkedin} icon={Linkedin} colorClass="text-blue-700 bg-blue-50" label="LinkedIn" />
                 </div>

                 {/* Website Fallback */}
                 {!Object.values(socials).some(v => !!v) && (
                     <p className="text-xs text-slate-300 italic mb-4">Nessun social collegato</p>
                 )}

                 <div className="flex items-center justify-center gap-1.5 text-slate-300 font-bold text-[10px]">
                     <ChefHat size={12}/> Powered by RistoSync
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
                            className="fixed bottom-6 right-6 p-3 bg-orange-500 text-white rounded-full shadow-2xl shadow-orange-500/30 z-50 animate-bounce hover:bg-orange-600 transition-colors"
                        >
                            <ArrowUp size={20}/>
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

export default DigitalMenu;