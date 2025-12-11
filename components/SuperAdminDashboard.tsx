
import React, { useEffect, useState } from 'react';
import { supabase, signOut } from '../services/supabase';
import { ShieldCheck, Users, Database, LogOut, RefreshCw, Smartphone, PlayCircle, PauseCircle, AlertTriangle, Copy, Check, User, PlusCircle, Edit2, Save, X, FlaskConical, Terminal, Trash2, Lock, LifeBuoy, Globe, Image as ImageIcon, FileText, MapPin, CreditCard, Mail, MessageCircle, Share2, PhoneCall, Facebook, Instagram, Store, Compass, Wrench, Calendar, DollarSign, Briefcase, Sparkles, Clock, AlertOctagon, UserCheck, Banknote, CalendarCheck, Settings, Inbox, Hash, MonitorPlay } from 'lucide-react';

interface SuperAdminDashboardProps {
    onEnterApp: () => void;
}

const SUPER_ADMIN_EMAIL = 'castro.massimo@yahoo.com';

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onEnterApp }) => {
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [copiedSQL, setCopiedSQL] = useState(false);
    const [copiedDemo, setCopiedDemo] = useState(false);
    const [copiedRecovery, setCopiedRecovery] = useState(false);
    const [copiedFix, setCopiedFix] = useState(false);
    const [currentEmail, setCurrentEmail] = useState<string>('');
    const [showSqlModal, setShowSqlModal] = useState(false);
    const [showFixModal, setShowFixModal] = useState(false);
    
    // Global Config State
    const [globalContactEmail, setGlobalContactEmail] = useState(SUPER_ADMIN_EMAIL);
    const [globalDefaultCost, setGlobalDefaultCost] = useState('49.90');
    
    // Global Bank & Support Data
    const [globalIban, setGlobalIban] = useState('IT73W0623074792000057589384');
    const [globalBankHolder, setGlobalBankHolder] = useState('Massimo Castro');
    const [globalSupportPhone, setGlobalSupportPhone] = useState('3478127440');
    
    const [isSavingGlobal, setIsSavingGlobal] = useState(false);

    // Edit State
    const [viewingProfile, setViewingProfile] = useState<any | null>(null);
    const [isEditingRegistry, setIsEditingRegistry] = useState(false);
    const [registryForm, setRegistryForm] = useState<any>({});
    const [subDate, setSubDate] = useState(''); 
    const [subCost, setSubCost] = useState(''); 
    const [subPlan, setSubPlan] = useState('');
    
    // Agent State
    const [agentName, setAgentName] = useState('');
    const [agentType, setAgentType] = useState('Percentage');
    const [agentValue, setAgentValue] = useState('');
    const [agentLastPay, setAgentLastPay] = useState('');
    const [agentNextPay, setAgentNextPay] = useState('');

    // Inline Name Edit
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    
    useEffect(() => {
        supabase?.auth.getUser().then(({ data }) => {
            if (data.user?.email) setCurrentEmail(data.user.email);
        });

        fetchProfiles();
        const interval = setInterval(fetchProfiles, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchProfiles = async () => {
        if (!supabase) return;
        setLoading(true);
        const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (data) {
            setProfiles(data);
            
            // Extract Global Config from Super Admin Profile
            const superAdminProfile = data.find(p => p.email === SUPER_ADMIN_EMAIL);
            if (superAdminProfile && superAdminProfile.settings?.globalConfig) {
                const config = superAdminProfile.settings.globalConfig;
                setGlobalContactEmail(config.contactEmail || SUPER_ADMIN_EMAIL);
                setGlobalDefaultCost(config.defaultCost || '49.90');
                
                // Load Bank & Phone
                if (config.bankDetails) {
                    setGlobalIban(config.bankDetails.iban || '');
                    setGlobalBankHolder(config.bankDetails.holder || '');
                }
                if (config.supportContact) {
                    setGlobalSupportPhone(config.supportContact.phone || '');
                }
            }
        }
        if (error) console.error("Errore recupero profili:", error);
        setLoading(false);
    };

    const saveGlobalConfig = async () => {
        if (!supabase) return;
        setIsSavingGlobal(true);
        
        // Find Super Admin ID
        const adminProfile = profiles.find(p => p.email === SUPER_ADMIN_EMAIL);
        if (!adminProfile) {
            alert("Profilo Super Admin non trovato nel DB.");
            setIsSavingGlobal(false);
            return;
        }

        const currentSettings = adminProfile.settings || {};
        const updatedSettings = {
            ...currentSettings,
            globalConfig: {
                contactEmail: globalContactEmail,
                defaultCost: globalDefaultCost,
                bankDetails: {
                    iban: globalIban,
                    holder: globalBankHolder
                },
                supportContact: {
                    phone: globalSupportPhone
                }
            }
        };

        const { error } = await supabase
            .from('profiles')
            .update({ settings: updatedSettings })
            .eq('id', adminProfile.id);

        if (error) alert("Errore salvataggio globali: " + error.message);
        else {
            // alert("Configurazione globale salvata!");
            fetchProfiles();
        }
        setIsSavingGlobal(false);
    };

    const openRegistry = (profile: any) => {
        setViewingProfile(profile);
        setIsEditingRegistry(false);
        const profileData = profile.settings?.restaurantProfile || {};
        
        // Load Registry Data
        setRegistryForm({
            businessName: profileData.businessName || '', 
            responsiblePerson: profileData.responsiblePerson || '',
            vatNumber: profileData.vatNumber || '',
            sdiCode: profileData.sdiCode || '', 
            pecEmail: profileData.pecEmail || '', 
            phoneNumber: profileData.phoneNumber || '',
            landlineNumber: profileData.landlineNumber || '',
            whatsappNumber: profileData.whatsappNumber || '',
            email: profileData.email || '',
            address: profileData.address || '',
            billingAddress: profileData.billingAddress || '',
            website: profileData.website || '',
            socials: profileData.socials || { instagram: '', facebook: '', google: '', tripadvisor: '' }
        });

        setSubDate(profileData.subscriptionEndDate || '');
        setSubCost(profileData.subscriptionCost || '49.90');
        setSubPlan(profileData.planType || 'Pro');

        // Load Agent Data
        const agent = profileData.agent || {};
        setAgentName(agent.name || '');
        setAgentType(agent.commissionType || 'Percentage');
        setAgentValue(agent.commissionValue || '');
        setAgentLastPay(agent.lastPaymentDate || '');
        setAgentNextPay(agent.nextPaymentDate || '');
    };

    const handleRegistryChange = (field: string, value: string) => {
        setRegistryForm((prev: any) => ({ ...prev, [field]: value }));
    };
    
    const handleSocialChange = (network: string, value: string) => {
        setRegistryForm((prev: any) => ({ 
            ...prev, 
            socials: { ...prev.socials, [network]: value } 
        }));
    };

    const activateFreeTrial = () => {
        const today = new Date();
        today.setDate(today.getDate() + 15); // 15 Giorni
        setSubDate(today.toISOString());
        setSubPlan('Trial');
    };

    const activateDemoAgent = () => {
        // Data molto lontana per "Free/Demo"
        setSubDate('2099-12-31T23:59:59.000Z');
        setSubPlan('Demo');
        setSubCost('0.00');
    };

    const saveRegistryChanges = async () => {
        if (!supabase || !viewingProfile) return;

        const currentSettings = viewingProfile.settings || {};
        
        const updatedSettings = {
            ...currentSettings,
            restaurantProfile: {
                ...registryForm,
                subscriptionEndDate: subDate,
                subscriptionCost: subCost,
                planType: subPlan,
                name: viewingProfile.restaurant_name,
                agent: {
                    name: agentName,
                    commissionType: agentType,
                    commissionValue: agentValue,
                    lastPaymentDate: agentLastPay,
                    nextPaymentDate: agentNextPay
                }
            }
        };

        // Aggiorna stato locale
        const updatedProfile = { ...viewingProfile, settings: updatedSettings };
        setViewingProfile(updatedProfile);
        setProfiles(prev => prev.map(p => p.id === viewingProfile.id ? updatedProfile : p));

        // Aggiorna DB
        const { error } = await supabase
            .from('profiles')
            .update({ settings: updatedSettings })
            .eq('id', viewingProfile.id);

        if (error) {
            alert("ERRORE SALVATAGGIO: " + error.message);
            fetchProfiles();
        } else {
            setIsEditingRegistry(false);
            // alert("Dati aggiornati con successo!");
        }
    };

    const toggleStatus = async (id: string, currentStatus: string, email: string) => { if (id.startsWith('demo-')) { alert("Questa è una riga simulata."); return; } if (email === SUPER_ADMIN_EMAIL) { alert("Non puoi sospendere l'account Super Admin."); return; } if (!supabase) return; const newStatus = currentStatus === 'active' ? 'suspended' : 'active'; const { error } = await supabase.from('profiles').update({ subscription_status: newStatus }).eq('id', id); if (!error) fetchProfiles(); else alert("Errore modifica stato: " + error.message); };
    const deleteProfile = async (id: string, name: string, email: string) => { if (email === SUPER_ADMIN_EMAIL) { alert("OPERAZIONE NEGATA."); return; } if (id.startsWith('demo-')) { setProfiles(prev => prev.filter(p => p.id !== id)); return; } if (!confirm(`⚠️ ATTENZIONE: ELIMINAZIONE RISTORANTE\n\nStai per cancellare definitivamente:\nNome: "${name}"\nEmail: ${email}\n\nSei assolutamente sicuro di voler ELIMINARE?`)) { return; } if (!supabase) return; const { error } = await supabase.from('profiles').delete().eq('id', id); if (!error) { fetchProfiles(); } else { console.error(error); alert("ERRORE CANCELLAZIONE: " + error.message); } };
    const startEdit = (profile: any) => { if (profile.id.startsWith('demo-')) return; setEditingId(profile.id); setEditName(profile.restaurant_name || ''); };
    const cancelEdit = () => { setEditingId(null); setEditName(''); };
    const saveEdit = async () => { if (!supabase || !editingId) return; const { error } = await supabase.from('profiles').update({ restaurant_name: editName }).eq('id', editingId); if (!error) { setEditingId(null); fetchProfiles(); } else { alert("Errore salvataggio: " + error.message); } };
    const addMonths = (dateStr: string, months: number) => { const d = dateStr ? new Date(dateStr) : new Date(); d.setMonth(d.getMonth() + months); return d.toISOString().split('T')[0]; };
    
    // Status Logic
    const getStatusColor = (profile: any) => { if (profile.subscription_status === 'banned') return 'bg-red-500/20 text-red-400 border-red-500/30'; if (profile.subscription_status === 'suspended') return 'bg-orange-500/20 text-orange-400 border-orange-500/30'; const expiry = profile.settings?.restaurantProfile?.subscriptionEndDate; if (expiry && new Date(expiry) < new Date()) return 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse'; return 'bg-green-500/20 text-green-400 border-green-500/30'; };
    const copySQL = (sql: string, type: 'reset' | 'demo' | 'recovery' | 'fix') => { navigator.clipboard.writeText(sql); if (type === 'demo') { setCopiedDemo(true); setTimeout(() => setCopiedDemo(false), 2000); } else if (type === 'fix') { setCopiedFix(true); setTimeout(() => setCopiedFix(false), 2000); } else { setCopiedRecovery(true); setTimeout(() => setCopiedRecovery(false), 2000); } };
    const getDemoUserSQL = () => `create extension if not exists pgcrypto; insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token) values ('d0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0', '00000000-0000-0000-0000-000000000000', 'demo@ristosync.com', crypt('password123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}', '{"restaurant_name":"Ristorante Demo"}', now(), now(), '', '') on conflict (id) do nothing; insert into public.profiles (id, email, restaurant_name, subscription_status) values ('d0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0', 'demo@ristosync.com', 'Ristorante Demo', 'active') on conflict (id) do update set restaurant_name = 'Ristorante Demo';`;
    const getFixStructureSQL = () => `-- FIX PERMESSI E STRUTTURA DB\n\n-- 1. Aggiorna colonne Menu Items\nalter table public.menu_items add column if not exists combo_items jsonb;\nalter table public.menu_items add column if not exists specific_department text;\nalter table public.menu_items add column if not exists image text;\nalter table public.menu_items add column if not exists ingredients text;\n\n-- 2. Permessi espliciti (Grant)\ngrant all on table public.orders to authenticated;\ngrant all on table public.orders to service_role;\ngrant all on table public.menu_items to authenticated;\ngrant all on table public.menu_items to service_role;\n\n-- 3. Policy Ordini (Fix Inserimento)\ndrop policy if exists "Enable All for Users" on public.orders;\ndrop policy if exists "Manage own orders" on public.orders;\ncreate policy "Enable All for Users" on public.orders for all using (auth.uid() = user_id);\n\n-- 4. Policy Menu\ndrop policy if exists "Manage own menu" on public.menu_items;\ncreate policy "Public Read Menu" on public.menu_items for select using (true);\ncreate policy "Owner Manage Menu" on public.menu_items for all using (auth.uid() = user_id);\n\n-- 5. Attiva Realtime\nalter publication supabase_realtime add table public.orders;\nalter publication supabase_realtime add table public.menu_items;\n\nNOTIFY pgrst, 'reload schema';`;
    const isEmailCorrect = currentEmail.toLowerCase() === SUPER_ADMIN_EMAIL;

    // Derived Status for Modal
    const isTrial = subPlan === 'Trial';
    const isFree = subPlan === 'Free' || subPlan === 'Demo';
    const isExpired = subDate && new Date(subDate) < new Date() && !isFree;
    const statusLabel = isFree ? 'GRATIS / DEMO' : isExpired ? 'SCADUTO' : isTrial ? 'IN PROVA' : 'ATTIVO';
    const statusColorClass = isFree ? 'bg-indigo-600' : isExpired ? 'bg-red-600' : isTrial ? 'bg-blue-500' : 'bg-green-600';

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <div className="flex items-center gap-4"><div className="p-4 bg-red-600 rounded-2xl shadow-lg shadow-red-600/20"><ShieldCheck size={32} /></div><div><h1 className="text-3xl font-black">SUPER ADMIN</h1><div className="flex items-center gap-2 text-slate-400 text-sm"><User size={14}/> {currentEmail ? (<span>Loggato come: <strong className={isEmailCorrect ? "text-green-400" : "text-red-400"}>{currentEmail}</strong></span>) : 'Verifica utente...'}</div></div></div>
                    <div className="flex gap-3">
                        <button onClick={() => setShowFixModal(true)} className="p-3 bg-red-600/20 rounded-xl text-red-400 hover:text-white hover:bg-red-600 transition-colors border border-red-500/50 shadow-lg shadow-red-900/20 active:scale-95" title="Strumenti Riparazione DB"><Wrench size={20} /></button>
                        <button onClick={() => setShowSqlModal(true)} className="p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700 active:scale-95" title="Genera Demo User"><Database size={20} /></button>
                        <button onClick={onEnterApp} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all"><Smartphone size={18} /> Entra come Utente</button>
                        <button onClick={signOut} className="flex items-center gap-2 text-slate-400 hover:text-white bg-slate-800 px-6 py-3 rounded-xl font-bold border border-slate-700"><LogOut size={18} /> Logout</button>
                    </div>
                </div>

                {/* GLOBAL CONFIGURATION CARD */}
                <div className="bg-slate-800 rounded-3xl border border-slate-700 p-6 mb-8 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5"><Settings size={120} /></div>
                    <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-4 relative z-10">
                        <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><Globe size={24}/></div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Configurazione Globale</h2>
                            <p className="text-sm text-slate-400">Dati aziendali visibili a tutti i clienti.</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 mb-6">
                        {/* COSTI & EMAIL */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-500 uppercase font-bold block mb-2 flex items-center gap-2"><Inbox size={14}/> Email Ricezione</label>
                                <input type="email" value={globalContactEmail} onChange={(e) => setGlobalContactEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white font-medium focus:border-indigo-500 outline-none" placeholder="admin@example.com" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 uppercase font-bold block mb-2 flex items-center gap-2"><DollarSign size={14}/> Costo Default</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                                    <input type="text" value={globalDefaultCost} onChange={(e) => setGlobalDefaultCost(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-xl pl-8 pr-4 py-3 text-white font-bold focus:border-indigo-500 outline-none" placeholder="49.90" />
                                </div>
                            </div>
                        </div>

                        {/* DATI BANCARI */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-500 uppercase font-bold block mb-2 flex items-center gap-2"><Banknote size={14}/> Intestatario Bonifico</label>
                                <input type="text" value={globalBankHolder} onChange={(e) => setGlobalBankHolder(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white font-medium focus:border-indigo-500 outline-none" placeholder="Nome Cognome" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 uppercase font-bold block mb-2 flex items-center gap-2"><Hash size={14}/> IBAN</label>
                                <input type="text" value={globalIban} onChange={(e) => setGlobalIban(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-indigo-500 outline-none" placeholder="IT00..." />
                            </div>
                        </div>

                        {/* CONTATTI SUPPORTO */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-500 uppercase font-bold block mb-2 flex items-center gap-2"><Smartphone size={14}/> Telefono / WhatsApp</label>
                                <input type="text" value={globalSupportPhone} onChange={(e) => setGlobalSupportPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white font-medium focus:border-indigo-500 outline-none" placeholder="+39..." />
                            </div>
                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-600 opacity-50 flex items-center justify-center h-[52px]">
                                <span className="text-xs text-slate-400">DevTools Branding Attivo</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end mt-6 relative z-10 border-t border-slate-700 pt-4">
                        <button onClick={saveGlobalConfig} disabled={isSavingGlobal} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                            {isSavingGlobal ? <RefreshCw size={18} className="animate-spin"/> : <Save size={18}/>}
                            Salva Configurazione Globale
                        </button>
                    </div>
                </div>

                {/* KPI & LIST */}
                <div className="bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800"><h2 className="font-bold text-xl">Gestione Tenants</h2><button onClick={fetchProfiles} className="flex items-center gap-2 text-sm font-bold bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-slate-300 transition-colors"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Aggiorna</button></div>
                    <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-bold"><tr><th className="p-6">Nome Ristorante</th><th className="p-6">Email Admin</th><th className="p-6">Stato</th><th className="p-6 text-right">Azioni</th></tr></thead><tbody className="divide-y divide-slate-700">
                        {profiles.map(p => {
                            const isFake = p.id.toString().startsWith('demo-');
                            const isSuperAdminProfile = p.email === SUPER_ADMIN_EMAIL;
                            const hasProfileData = p.settings?.restaurantProfile?.vatNumber || p.settings?.restaurantProfile?.phoneNumber;
                            const statusColor = getStatusColor(p);
                            return (
                                <tr key={p.id} className={`transition-colors ${isFake ? 'bg-orange-500/5 hover:bg-orange-500/10' : 'hover:bg-slate-700/30'} ${isSuperAdminProfile ? 'bg-blue-900/10' : ''}`}>
                                    <td className="p-6">{editingId === p.id ? (<div className="flex items-center gap-2"><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-slate-950 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-bold w-full focus:border-blue-500 outline-none" autoFocus /><button onClick={saveEdit} className="p-2 bg-green-600 rounded-lg hover:bg-green-500"><Save size={16}/></button><button onClick={cancelEdit} className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600"><X size={16}/></button></div>) : (<div className="flex items-center gap-3 group"><div><div className="flex items-center gap-2"><div className="font-bold text-white text-lg">{p.restaurant_name || 'N/A'}</div>{isFake && <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Simulato</span>}{isSuperAdminProfile && <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">HQ</span>}</div><div className="text-xs font-mono text-slate-500 mt-1">{p.id}</div></div>{!isFake && (<button onClick={() => startEdit(p)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-slate-800 text-blue-400 hover:bg-blue-500 hover:text-white transition-all" title="Modifica Nome"><Edit2 size={14}/></button>)}</div>)}</td>
                                    <td className="p-6 text-slate-300 font-medium">{p.email}</td>
                                    <td className="p-6"><span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${statusColor}`}>{p.subscription_status}</span></td>
                                    <td className="p-6 text-right"><div className="flex justify-end gap-2"><button onClick={() => openRegistry(p)} className={`inline-flex items-center justify-center p-2 rounded-lg border transition-colors ${hasProfileData ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-600 hover:text-white border-indigo-500/20'}`} title="Gestione Abbonamento & Anagrafica">{hasProfileData ? <FileText size={14}/> : <DollarSign size={14}/>}{hasProfileData && <span className="ml-1 text-[10px] font-bold">GESTISCI</span>}</button>{!isSuperAdminProfile && (<button onClick={() => toggleStatus(p.id, p.subscription_status, p.email)} className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${isFake ? 'opacity-50 cursor-not-allowed bg-slate-700 text-slate-400' : (p.subscription_status === 'active' ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white border border-green-500/20')}`} title={p.subscription_status === 'active' ? 'Sospendi Account' : 'Attiva Account'}>{p.subscription_status === 'active' ? <PauseCircle size={14}/> : <PlayCircle size={14}/>}</button>)}{isSuperAdminProfile ? (<div className="inline-flex items-center justify-center p-2 rounded-lg bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed" title="Protetto da cancellazione"><Lock size={14} /></div>) : (<button onClick={() => deleteProfile(p.id, p.restaurant_name, p.email)} className="inline-flex items-center justify-center p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-600 hover:text-white border border-red-500/20 transition-colors" title="Elimina Definitivamente"><Trash2 size={14} /></button>)}</div></td>
                                </tr>
                            );
                        })}
                    </tbody></table></div>
                </div>
            </div>

            {/* EDITABLE ANAGRAFICA & SUBSCRIPTION MODAL */}
            {viewingProfile && (
                <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-[2rem] w-full max-w-5xl shadow-2xl animate-slide-up relative flex flex-col max-h-[95vh]">
                        {/* HEADER MODAL */}
                        <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-950 rounded-t-[2rem]">
                            <div className="flex items-start gap-4">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${statusColorClass} text-white`}>
                                    <Store size={28} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-2xl font-black text-white">{viewingProfile.restaurant_name}</h2>
                                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-white shadow-sm ${statusColorClass}`}>{statusLabel}</div>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                                        <div className="flex items-center gap-1"><Mail size={12}/> {viewingProfile.email}</div>
                                        <div className="flex items-center gap-1 font-mono text-xs opacity-50"><Database size={10}/> {viewingProfile.id}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {!isEditingRegistry ? (
                                    <button onClick={() => setIsEditingRegistry(true)} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 hover:scale-105 active:scale-95 text-xs uppercase tracking-wide"><Edit2 size={16}/> Modifica Dati</button>
                                ) : (
                                    <button onClick={saveRegistryChanges} className="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-green-600/20 hover:scale-105 active:scale-95 text-xs uppercase tracking-wide animate-pulse"><Save size={16}/> Salva Tutto</button>
                                )}
                                <button onClick={() => setViewingProfile(null)} className="p-2.5 bg-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"><X size={20}/></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-slate-900 custom-scroll">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                
                                {/* COLONNA SINISTRA - ABBONAMENTO & AGENTE (CRITICO) */}
                                <div className="space-y-6">
                                    
                                    {/* SEZIONE AGENTE */}
                                    <div className="p-6 rounded-3xl border border-purple-500/30 bg-purple-900/10 relative overflow-hidden">
                                        <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-purple-400"><UserCheck size={14}/> Agente & Provvigioni</h3>
                                        <div className="space-y-4 relative z-10">
                                            <div>
                                                <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Nome Agente</label>
                                                {isEditingRegistry ? (
                                                    <input type="text" value={agentName} onChange={(e) => setAgentName(e.target.value)} className="bg-slate-950 border border-slate-700 text-white p-2 rounded-lg w-full text-xs font-bold outline-none" placeholder="Nessun agente"/>
                                                ) : (
                                                    <p className="text-sm font-bold text-white">{agentName || 'Nessuno assegnato'}</p>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Tipo</label>
                                                    {isEditingRegistry ? (
                                                        <select value={agentType} onChange={(e) => setAgentType(e.target.value)} className="bg-slate-950 border border-slate-700 text-white p-2 rounded-lg w-full text-[10px] font-bold outline-none">
                                                            <option value="Percentage">% su Abb.</option>
                                                            <option value="Monthly">Fisso Mese</option>
                                                            <option value="Annual">Fisso Anno</option>
                                                            <option value="OneOff">Una Tantum</option>
                                                        </select>
                                                    ) : (
                                                        <div className="bg-slate-950 px-2 py-2 rounded-lg border border-slate-800 text-purple-300 font-bold text-[10px]">{agentType === 'Percentage' ? '% Percentuale' : agentType}</div>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Valore</label>
                                                    {isEditingRegistry ? (
                                                        <input type="text" value={agentValue} onChange={(e) => setAgentValue(e.target.value)} className="bg-slate-950 border border-slate-700 text-white p-2 rounded-lg w-full text-xs font-bold text-right outline-none" placeholder="0"/>
                                                    ) : (
                                                        <div className="bg-slate-950 px-2 py-2 rounded-lg border border-slate-800 text-white font-bold text-[10px] text-right">{agentValue ? (agentType === 'Percentage' ? `${agentValue}%` : `€ ${agentValue}`) : '-'}</div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-purple-500/20">
                                                <div>
                                                    <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1 flex items-center gap-1"><Banknote size={10}/> Ultimo Pag.</label>
                                                    {isEditingRegistry ? (
                                                        <input type="date" value={agentLastPay} onChange={(e) => setAgentLastPay(e.target.value)} className="bg-slate-950 border border-slate-700 text-white p-1 rounded-lg w-full text-[10px]"/>
                                                    ) : (
                                                        <p className="text-[10px] text-slate-300">{agentLastPay ? new Date(agentLastPay).toLocaleDateString() : '-'}</p>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1 flex items-center gap-1"><CalendarCheck size={10}/> Prossimo</label>
                                                    {isEditingRegistry ? (
                                                        <input type="date" value={agentNextPay} onChange={(e) => setAgentNextPay(e.target.value)} className="bg-slate-950 border border-slate-700 text-white p-1 rounded-lg w-full text-[10px]"/>
                                                    ) : (
                                                        <p className="text-[10px] text-slate-300">{agentNextPay ? new Date(agentNextPay).toLocaleDateString() : '-'}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`p-6 rounded-3xl border relative overflow-hidden ${isFree ? 'bg-indigo-900/10 border-indigo-500/30' : isExpired ? 'bg-red-900/10 border-red-500/30' : isTrial ? 'bg-blue-900/10 border-blue-500/30' : 'bg-green-900/10 border-green-500/30'}`}>
                                        <div className="absolute top-0 right-0 p-4 opacity-10"><Calendar size={120} className={isFree ? 'text-indigo-500' : isExpired ? 'text-red-500' : isTrial ? 'text-blue-500' : 'text-green-500'}/></div>
                                        
                                        <h3 className={`text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${isFree ? 'text-indigo-400' : isExpired ? 'text-red-400' : isTrial ? 'text-blue-400' : 'text-green-400'}`}><CreditCard size={14}/> Stato Abbonamento</h3>
                                        
                                        <div className="space-y-4 relative z-10">
                                            <div>
                                                <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Scadenza</label>
                                                {isEditingRegistry ? (
                                                    <input type="date" value={subDate ? subDate.split('T')[0] : ''} onChange={(e) => setSubDate(e.target.value)} className="bg-slate-950 border border-slate-700 text-white p-3 rounded-xl w-full font-bold focus:border-indigo-500 outline-none shadow-inner"/>
                                                ) : (
                                                    <p className={`text-3xl font-black font-mono tracking-tight ${isExpired ? 'text-red-500' : 'text-white'}`}>{subDate ? new Date(subDate).toLocaleDateString() : 'N/A'}</p>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Piano</label>
                                                    {isEditingRegistry ? (
                                                        <select value={subPlan} onChange={(e) => setSubPlan(e.target.value)} className="bg-slate-950 border border-slate-700 text-white p-2 rounded-lg w-full text-xs font-bold outline-none">
                                                            <option value="Pro">Pro</option>
                                                            <option value="Trial">Trial (Prova)</option>
                                                            <option value="Enterprise">Enterprise</option>
                                                            <option value="Free">Free</option>
                                                            <option value="Demo">Demo</option>
                                                        </select>
                                                    ) : (
                                                        <div className="bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 text-white font-bold text-sm">{subPlan || 'Pro'}</div>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Costo (€)</label>
                                                    {isEditingRegistry ? (
                                                        <input type="text" value={subCost} onChange={(e) => setSubCost(e.target.value)} className="bg-slate-950 border border-slate-700 text-white p-2 rounded-lg w-full text-xs font-bold text-right outline-none"/>
                                                    ) : (
                                                        <div className="bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 text-white font-bold text-sm text-right">€ {subCost || '49.90'}</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* AZIONI RAPIDE */}
                                            {isEditingRegistry && (
                                                <div className="pt-4 border-t border-white/5 flex flex-col gap-2">
                                                    <button onClick={activateFreeTrial} className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 transition-all">
                                                        <Sparkles size={14} className="animate-pulse text-yellow-300"/> ATTIVA 15 GIORNI GRATIS
                                                    </button>
                                                    <button onClick={activateDemoAgent} className="w-full py-3 bg-gradient-to-r from-indigo-700 to-purple-700 hover:from-indigo-600 hover:to-purple-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 active:scale-95 transition-all">
                                                        <MonitorPlay size={14} className="text-white"/> ATTIVA DEMO AGENTE (FREE)
                                                    </button>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button onClick={() => setSubDate(addMonths(subDate, 1))} className="py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold rounded-lg border border-slate-700">+1 Mese</button>
                                                        <button onClick={() => setSubDate(addMonths(subDate, 12))} className="py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold rounded-lg border border-slate-700">+1 Anno</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* INFO UTILI */}
                                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2"><Clock size={14}/> Ultimo Accesso</h4>
                                        <p className="text-sm text-slate-400">Non disponibile</p>
                                    </div>
                                </div>

                                {/* COLONNA DESTRA - DATI ANAGRAFICI (LARGA) */}
                                <div className="lg:col-span-2 space-y-6">
                                    
                                    {/* SEZIONE FISCALE */}
                                    <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800">
                                        <h4 className="text-sm font-black text-white uppercase mb-5 flex items-center gap-2 border-b border-slate-800 pb-3"><Briefcase className="text-orange-500" size={18}/> Dati Fiscali & Aziendali</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="md:col-span-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Ragione Sociale</label>
                                                {isEditingRegistry ? <input type="text" value={registryForm.businessName} onChange={e => handleRegistryChange('businessName', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold" /> : <p className="text-lg text-white font-bold">{viewingProfile.settings?.restaurantProfile?.businessName || '-'}</p>}
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">P.IVA / C.F.</label>
                                                {isEditingRegistry ? <input type="text" value={registryForm.vatNumber} onChange={e => handleRegistryChange('vatNumber', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono" /> : <p className="text-white font-mono bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 w-max">{viewingProfile.settings?.restaurantProfile?.vatNumber || '-'}</p>}
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Responsabile Legale</label>
                                                {isEditingRegistry ? <input type="text" value={registryForm.responsiblePerson} onChange={e => handleRegistryChange('responsiblePerson', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white" /> : <p className="text-white">{viewingProfile.settings?.restaurantProfile?.responsiblePerson || '-'}</p>}
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Codice SDI</label>
                                                {isEditingRegistry ? <input type="text" value={registryForm.sdiCode} onChange={e => handleRegistryChange('sdiCode', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono uppercase" placeholder="XXXXXXX" /> : <p className="text-white font-mono">{viewingProfile.settings?.restaurantProfile?.sdiCode || '-'}</p>}
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Email PEC</label>
                                                {isEditingRegistry ? <input type="text" value={registryForm.pecEmail} onChange={e => handleRegistryChange('pecEmail', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono" /> : <p className="text-white font-mono">{viewingProfile.settings?.restaurantProfile?.pecEmail || '-'}</p>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* SEZIONE CONTATTI E SEDE */}
                                    <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800">
                                        <h4 className="text-sm font-black text-white uppercase mb-5 flex items-center gap-2 border-b border-slate-800 pb-3"><MapPin className="text-blue-500" size={18}/> Contatti & Sede</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="md:col-span-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Indirizzo Sede Operativa</label>
                                                {isEditingRegistry ? <input type="text" value={registryForm.address} onChange={e => handleRegistryChange('address', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white" /> : <p className="text-white">{viewingProfile.settings?.restaurantProfile?.address || '-'}</p>}
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Cellulare</label>
                                                {isEditingRegistry ? <input type="text" value={registryForm.phoneNumber} onChange={e => handleRegistryChange('phoneNumber', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white" /> : <p className="text-white">{viewingProfile.settings?.restaurantProfile?.phoneNumber || '-'}</p>}
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Email Pubblica</label>
                                                {isEditingRegistry ? <input type="text" value={registryForm.email} onChange={e => handleRegistryChange('email', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white" /> : <p className="text-white">{viewingProfile.settings?.restaurantProfile?.email || '-'}</p>}
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Sito Web</label>
                                                {isEditingRegistry ? <input type="text" value={registryForm.website} onChange={e => handleRegistryChange('website', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-blue-400" /> : <a href={viewingProfile.settings?.restaurantProfile?.website} target="_blank" className="text-blue-400 hover:underline truncate block">{viewingProfile.settings?.restaurantProfile?.website || '-'}</a>}
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Fisso</label>
                                                {isEditingRegistry ? <input type="text" value={registryForm.landlineNumber} onChange={e => handleRegistryChange('landlineNumber', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white" /> : <p className="text-white">{viewingProfile.settings?.restaurantProfile?.landlineNumber || '-'}</p>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* SEZIONE SOCIAL */}
                                    <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800">
                                        <h4 className="text-sm font-black text-white uppercase mb-5 flex items-center gap-2 border-b border-slate-800 pb-3"><Share2 className="text-pink-500" size={18}/> Social Media</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-xl border border-slate-800">
                                                <Instagram className="text-pink-500"/>
                                                {isEditingRegistry ? <input type="text" value={registryForm.socials?.instagram || ''} onChange={e => handleSocialChange('instagram', e.target.value)} className="bg-transparent outline-none text-white text-xs w-full placeholder-slate-600" placeholder="Username/Link"/> : <span className="text-xs text-slate-300 truncate">{viewingProfile.settings?.restaurantProfile?.socials?.instagram || '-'}</span>}
                                            </div>
                                            <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-xl border border-slate-800">
                                                <Facebook className="text-blue-600"/>
                                                {isEditingRegistry ? <input type="text" value={registryForm.socials?.facebook || ''} onChange={e => handleSocialChange('facebook', e.target.value)} className="bg-transparent outline-none text-white text-xs w-full placeholder-slate-600" placeholder="Link"/> : <span className="text-xs text-slate-300 truncate">{viewingProfile.settings?.restaurantProfile?.socials?.facebook || '-'}</span>}
                                            </div>
                                            <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-xl border border-slate-800">
                                                <Store className="text-blue-400"/>
                                                {isEditingRegistry ? <input type="text" value={registryForm.socials?.google || ''} onChange={e => handleSocialChange('google', e.target.value)} className="bg-transparent outline-none text-white text-xs w-full placeholder-slate-600" placeholder="Google Business"/> : <span className="text-xs text-slate-300 truncate">{viewingProfile.settings?.restaurantProfile?.socials?.google || '-'}</span>}
                                            </div>
                                            <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-xl border border-slate-800">
                                                <Compass className="text-green-500"/>
                                                {isEditingRegistry ? <input type="text" value={registryForm.socials?.tripadvisor || ''} onChange={e => handleSocialChange('tripadvisor', e.target.value)} className="bg-transparent outline-none text-white text-xs w-full placeholder-slate-600" placeholder="TripAdvisor"/> : <span className="text-xs text-slate-300 truncate">{viewingProfile.settings?.restaurantProfile?.socials?.tripadvisor || '-'}</span>}
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* OTHER MODALS */}
            {showFixModal && (<div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"><div className="bg-slate-900 border border-red-500/30 rounded-3xl p-6 w-full max-w-2xl shadow-2xl animate-slide-up relative"><button onClick={() => setShowFixModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X /></button><div className="flex items-center gap-3 mb-4 text-red-400"><div className="p-2 bg-red-500/10 rounded-lg"><Wrench size={24} /></div><h2 className="text-xl font-bold text-white">Riparazione Database & Permessi</h2></div><p className="text-slate-400 text-sm mb-4">Esegui questo script per aggiornare la struttura e i permessi.</p><div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative group text-left mb-6"><pre className="text-left text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto h-48 custom-scroll p-2">{getFixStructureSQL()}</pre><button onClick={() => copySQL(getFixStructureSQL(), 'fix')} className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-lg transition-all">{copiedFix ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>} {copiedFix ? 'COPIATO!' : 'COPIA SQL'}</button></div><div className="mt-6 flex justify-end"><button onClick={() => setShowFixModal(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold">Chiudi</button></div></div></div>)}
            {showSqlModal && (<div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"><div className="bg-slate-900 border border-orange-500/30 rounded-3xl p-6 w-full max-w-2xl shadow-2xl animate-slide-up relative"><button onClick={() => setShowSqlModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X /></button><h2 className="text-xl font-bold text-white mb-4">Genera Utente Demo</h2><div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative group text-left mb-6"><pre className="text-left text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto h-64 custom-scroll p-2">{getDemoUserSQL()}</pre><button onClick={() => copySQL(getDemoUserSQL(), 'demo')} className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2">{copiedDemo ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}</button></div><div className="mt-6 flex justify-end"><button onClick={() => setShowSqlModal(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold">Chiudi</button></div></div></div>)}
        </div>
    );
};

export default SuperAdminDashboard;
