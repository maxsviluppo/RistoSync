
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Category, MenuItem, SocialLinks } from '../types';
import { ChefHat, Utensils, Pizza, CakeSlice, Wine, Wheat, Milk, Egg, Nut, Fish, Bean, Flame, Leaf, Info, Search, Star, MapPin, Instagram, Facebook, ArrowUp, AlertTriangle, LogOut, Loader, Smartphone, UtensilsCrossed, Sandwich, Youtube, Linkedin, Music, Compass, Store, Globe, ArrowRight } from 'lucide-react';

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
                    const { data: rawItems, error: menuError } = await supabase
                        .from('menu_items')
                        .select('*')
                        .eq('user_id', restaurantId);

                    if (menuError) {
                        console.error("Menu fetch error:", menuError);
                    }

                    if (rawItems && rawItems.length > 0) {
                        // MAP DATABASE (Snake_Case) TO APP (CamelCase)
                        // Critical for Combo Items array which is 'combo_items' in DB but 'comboItems' in App
                        const mappedItems: MenuItem[] = rawItems.map((row: any) => ({
                            id: row.id,
                            name: row.name,
                            price: row.price,
                            category: row.category,
                            description: row.description,
                            ingredients: row.ingredients,
                            allergens: row.allergens,
                            image: row.image,
                            isCombo: row.category === Category.MENU_COMPLETO,
                            comboItems: row.combo_items || [], // Correctly map snake_case
                            specificDepartment: row.specific_department
                        }));

                        setMenuItems(mappedItems);
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

    // FILTER: Determine visible categories (hide empty ones)
    const visibleCategories = useMemo(() => {
        return CATEGORY_ORDER.filter(cat => menuItems.some(item => item.category === cat));
    }, [menuItems]);

    // SET INITIAL ACTIVE CATEGORY ONCE DATA LOADS
    useEffect(() => {
        if (visibleCategories.length > 0 && !visibleCategories.includes(activeCategory)) {
            setActiveCategory(visibleCategories[0]);
        }
    }, [visibleCategories]);

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

    // Social Button Helper
    const SocialButton = ({ link, icon: Icon, colorClass, label }: { link?: string, icon: any, colorClass: string, label: string }) => {
        if (!link) return null;
        const href = link.startsWith('http') ? link : `https://${link}`;
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 hover:scale-110 transition-all ${colorClass}`} title={label}>
                <Icon size={20} />
            </a>
        );
    };

    if (loading) return (
        <div className={`${isPreview ? 'h-full bg-slate-900 rounded-[2rem]' : 'min-h-screen bg-slate-900'} flex flex-col items-center justify-center text-white p-4`}>
            <Loader className="animate-spin text-orange-500 mb-4" size={48} />
            <p className="animate-pulse font-medium text-lg text-slate-300">Caricamento Menu...</p>
        </div>
    );

    // SCREEN ERRORI
    if ((rlsError || (menuItems.length === 0 && !loading)) && !activeMenuData) {
        return (
            <div className={`${isPreview ? 'h-full bg-slate-950 rounded-[2rem]' : 'min-h-screen bg-slate-950'} flex flex-col items-center justify-center text-white p-8 text-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-black`}>
                <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse border border-orange-500/20">
                     <AlertTriangle size={40} className="text-orange-500" />
                </div>
                <h2 className="text-2xl font-black mb-3">Menu Non Disponibile</h2>
                
                {rlsError ? (
                    <div className="bg-slate-900/50 p-6 rounded-2xl border border-red-500/30 max-w-xs text-sm backdrop-blur-md">
                        <p className="text-slate-300 mb-2 font-medium">
                            {isPreview ? "Permessi pubblici non attivi." : "Il ristorante non è accessibile."}
                        </p>
                        {isPreview && <p className="text-xs text-orange-400">Esegui lo script SQL nella dashboard Super Admin.</p>}
                    </div>
                ) : (
                    <div className="max-w-md">
                        <p className="text-slate-400 mb-6 text-sm">
                            Non ci sono piatti da mostrare. <br/>Il proprietario sta aggiornando il menu.
                        </p>
                    </div>
                )}
                
                {!isPreview && (
                    <button onClick={exitMenuMode} className="mt-8 bg-white text-slate-900 hover:bg-slate-200 px-8 py-4 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg">
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

    // MAIN RENDER (PREMIUM DARK MODE)
    return (
        <div 
            id="digital-menu-container"
            className={`${isPreview ? 'h-full overflow-y-auto relative rounded-[2rem] bg-slate-950 scrollbar-hide pt-8' : 'min-h-screen bg-slate-950 pb-24 text-white'} selection:bg-orange-500/30`}
        >
            {/* AMBIENT BACKGROUND */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-orange-600/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px]"></div>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
            </div>

            {/* HERO HEADER */}
            <div className={`relative z-20 overflow-hidden bg-slate-900 border-b border-white/5`}>
                <div className="absolute inset-0 bg-gradient-to-r from-orange-600/20 to-red-600/20 opacity-50"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-950/90"></div>
                
                <div className={`relative z-10 px-6 ${isPreview ? 'pt-8 pb-4' : 'pt-8 pb-6'} flex flex-col items-center text-center`}>
                    <div className="p-3 bg-slate-950 rounded-2xl shadow-2xl border border-slate-800 mb-3 relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl opacity-20 blur-lg group-hover:opacity-40 transition-opacity"></div>
                        <ChefHat size={isPreview ? 24 : 32} className="text-orange-500 relative z-10" />
                    </div>
                    <h1 className={`${isPreview ? 'text-lg' : 'text-3xl'} font-black tracking-tight text-white mb-1 drop-shadow-sm`}>{restaurantName}</h1>
                    <div className="flex items-center gap-1.5 mt-2 bg-white/5 px-3 py-1 rounded-full border border-white/10 backdrop-blur-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Aperto Adesso</span>
                    </div>
                </div>
            </div>

            {/* STICKY NAV */}
            <div className={`sticky z-30 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 shadow-lg ${isPreview ? 'top-0 py-3' : 'top-0 py-4'}`}>
                <div className="flex overflow-x-auto gap-3 px-6 no-scrollbar snap-x items-center">
                    {visibleCategories.map(cat => (
                        <button 
                            key={cat} 
                            onClick={() => scrollToCategory(cat)}
                            className={`flex items-center gap-2 rounded-xl whitespace-nowrap font-bold transition-all snap-center border ${isPreview ? 'px-3 py-1.5 text-[10px]' : 'px-4 py-2.5 text-xs'} ${activeCategory === cat ? 'bg-orange-500 text-white border-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.4)] scale-105' : 'bg-slate-900/50 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'}`}
                        >
                            {getCategoryIcon(cat, isPreview ? 12 : 16)} {cat}
                        </button>
                    ))}
                    {visibleCategories.length === 0 && (
                         <div className="w-full text-center text-xs text-slate-500 py-2 italic">Menu in aggiornamento...</div>
                    )}
                </div>
            </div>

            {/* MENU CONTENT */}
            <div className={`px-4 max-w-2xl mx-auto relative z-10 ${isPreview ? 'py-4 space-y-8' : 'py-8 space-y-12'}`}>
                {visibleCategories.map(cat => {
                    const items = menuItems.filter(i => i.category === cat);
                    return (
                        <div key={cat} id={`cat-${cat}`} className="scroll-mt-40">
                            <div className={`flex items-center gap-4 mb-5 ${isPreview ? 'mt-2' : 'mt-0'}`}>
                                <h2 className={`${isPreview ? 'text-sm' : 'text-2xl'} font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 uppercase tracking-tight`}>{cat}</h2>
                                <div className="h-px bg-gradient-to-r from-slate-800 to-transparent flex-1"></div>
                            </div>

                            <div className={`grid ${isPreview ? 'gap-4' : 'gap-6'}`}>
                                {items.map(item => {
                                    const isCombo = item.category === Category.MENU_COMPLETO;
                                    let comboChildren: MenuItem[] = [];
                                    if(isCombo && item.comboItems) {
                                        const fullMenu = activeMenuData || menuItems; 
                                        comboChildren = fullMenu.filter(i => item.comboItems?.includes(i.id));
                                    }

                                    let displayAllergens = item.allergens || [];
                                    if (isCombo && comboChildren.length > 0) {
                                        const childAllergens = comboChildren.flatMap(c => c.allergens || []);
                                        displayAllergens = [...new Set([...displayAllergens, ...childAllergens])];
                                    }

                                    return (
                                        <div key={item.id} className={`group bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden flex transition-all hover:bg-slate-800/80 hover:border-white/10 hover:shadow-xl ${isPreview ? 'p-3 gap-3' : 'p-5 gap-5'}`}>
                                            <div className="flex-1 flex flex-col justify-between min-w-0">
                                                <div>
                                                    <div className="flex justify-between items-start gap-2 mb-1">
                                                        <h3 className={`${isPreview ? 'text-xs' : 'text-lg'} font-bold text-white leading-tight`}>{item.name}</h3>
                                                        <div className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 shadow-sm shrink-0">
                                                            <span className="font-bold text-orange-400 text-xs whitespace-nowrap">€ {item.price.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* INGREDIENTS */}
                                                    {item.ingredients && (
                                                        <p className={`text-slate-400 font-medium italic leading-relaxed mb-2 line-clamp-2 ${isPreview ? 'text-[9px]' : 'text-sm'}`}>
                                                            {item.ingredients}
                                                        </p>
                                                    )}

                                                    {/* COMBO DETAILS */}
                                                    {isCombo && comboChildren.length > 0 && (
                                                        <div className="bg-slate-950/50 rounded-lg p-2 border border-white/5 mb-2">
                                                            <p className={`text-[8px] font-bold text-slate-500 uppercase mb-1`}>Include:</p>
                                                            <ul className={`text-slate-300 space-y-0.5 ${isPreview ? 'text-[8px]' : 'text-xs'}`}>
                                                                {comboChildren.map(child => (
                                                                    <li key={child.id} className="flex items-center gap-1.5">
                                                                        <div className="w-1 h-1 rounded-full bg-orange-500"></div> {child.name}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {/* DESCRIPTION */}
                                                    {item.description && (
                                                        <p className={`text-slate-500 leading-snug mb-3 line-clamp-3 ${isPreview ? 'text-[8px]' : 'text-xs'}`}>
                                                            {item.description}
                                                        </p>
                                                    )}
                                                </div>
                                                
                                                {/* ALLERGENS */}
                                                {displayAllergens.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
                                                        {displayAllergens.map(alg => {
                                                            const Icon = ALLERGENS_ICONS[alg] || Info;
                                                            return (
                                                                <span key={alg} className={`inline-flex items-center gap-1 font-bold uppercase text-slate-400 bg-slate-950/80 border border-slate-800 rounded-md ${isPreview ? 'text-[7px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1'}`}>
                                                                    <Icon size={isPreview ? 8 : 10} className="text-orange-500"/> {alg}
                                                                </span>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* IMAGE */}
                                            {item.image && (
                                                <div className={`shrink-0 rounded-2xl overflow-hidden bg-slate-950 border border-white/10 shadow-lg relative ${isPreview ? 'w-16 h-16' : 'w-28 h-28'}`}>
                                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"/>
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {visibleCategories.length === 0 && (
                    <div className="text-center py-20 text-slate-600 bg-slate-900/30 rounded-3xl border border-white/5">
                        <Search size={40} className="mx-auto mb-4 opacity-30"/>
                        <p className="font-bold text-sm">Nessun piatto trovato.</p>
                    </div>
                )}
            </div>

            {/* FOOTER */}
            <div className={`text-center bg-slate-950 border-t border-white/5 relative z-20 ${isPreview ? 'py-8 mt-8 pb-12' : 'py-12 mt-12'}`}>
                 <div className="w-12 h-1 rounded-full bg-slate-800 mx-auto mb-6"></div>
                 <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-6">Seguici sui Social</p>
                 
                 <div className="flex flex-wrap justify-center gap-3 mb-8 px-6">
                     <SocialButton link={socials.instagram} icon={Instagram} colorClass="text-pink-500" label="Instagram" />
                     <SocialButton link={socials.facebook} icon={Facebook} colorClass="text-blue-500" label="Facebook" />
                     <SocialButton link={socials.tiktok} icon={Music} colorClass="text-white" label="TikTok" />
                     <SocialButton link={socials.google} icon={Store} colorClass="text-blue-400" label="Google Business" />
                     <SocialButton link={socials.tripadvisor} icon={Compass} colorClass="text-green-500" label="TripAdvisor" />
                     <SocialButton link={socials.thefork} icon={UtensilsCrossed} colorClass="text-emerald-500" label="TheFork" />
                     <SocialButton link={socials.youtube} icon={Youtube} colorClass="text-red-500" label="YouTube" />
                     <SocialButton link={socials.linkedin} icon={Linkedin} colorClass="text-blue-600" label="LinkedIn" />
                 </div>

                 <div className="flex items-center justify-center gap-2 text-slate-600 font-bold text-[10px] uppercase tracking-wide">
                     <ChefHat size={14}/> Powered by RistoSync
                 </div>
            </div>

            {/* FLOATING ACTIONS */}
            {!isPreview && (
                <>
                    <button 
                        onClick={exitMenuMode}
                        className="fixed bottom-6 left-6 w-12 h-12 bg-slate-800/80 backdrop-blur-md border border-white/10 text-white rounded-full z-50 shadow-2xl flex items-center justify-center active:scale-90 transition-all hover:bg-slate-700"
                        title="Esci dal Menu Digitale"
                    >
                        <LogOut size={18}/>
                    </button>
                    {showScrollTop && (
                        <button 
                            onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}
                            className="fixed bottom-6 right-6 w-12 h-12 bg-orange-600 text-white rounded-full shadow-[0_0_20px_rgba(249,115,22,0.5)] z-50 flex items-center justify-center animate-bounce hover:bg-orange-500 transition-colors"
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
