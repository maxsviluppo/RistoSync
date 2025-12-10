import React, { useEffect, useState } from 'react';
import { supabase, signOut } from '../services/supabase';
import { ShieldCheck, Users, Database, LogOut, RefreshCw, Smartphone, PlayCircle, PauseCircle, AlertTriangle, Copy, Check, User, PlusCircle, Edit2, Save, X, FlaskConical, Terminal, Trash2, Lock, LifeBuoy, Globe, Image as ImageIcon, FileText, MapPin, CreditCard, Mail, MessageCircle, Share2, PhoneCall, Facebook, Instagram, Store, Compass, Wrench, Calendar, DollarSign, Briefcase, Sparkles } from 'lucide-react';

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
    const [copiedPublic, setCopiedPublic] = useState(false);
    const [copiedImage, setCopiedImage] = useState(false);
    const [copiedFix, setCopiedFix] = useState(false);
    const [currentEmail, setCurrentEmail] = useState<string>('');
    const [showSqlModal, setShowSqlModal] = useState(false);
    const [showRecoveryModal, setShowRecoveryModal] = useState(false);
    const [showPublicModal, setShowPublicModal] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [showFixModal, setShowFixModal] = useState(false);
    
    const [viewingProfile, setViewingProfile] = useState<any | null>(null);
    const [isEditingRegistry, setIsEditingRegistry] = useState(false);
    const [registryForm, setRegistryForm] = useState<any>({});
    const [subDate, setSubDate] = useState(''); 
    const [subCost, setSubCost] = useState(''); // New: Cost State
    const [subPlan, setSubPlan] = useState(''); // New: Plan Type State

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
        if (data) setProfiles(data);
        if (error) console.error("Errore recupero profili:", error);
        setLoading(false);
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
            phoneNumber: profileData.phoneNumber || '',
            landlineNumber: profileData.landlineNumber || '',
            whatsappNumber: profileData.whatsappNumber || '',
            email: profileData.email || '',
            address: profileData.address || '',
            billingAddress: profileData.billingAddress || '',
            website: profileData.website || '',
            socials: profileData.socials || {}
        });

        setSubDate(profileData.subscriptionEndDate || '');
        setSubCost(profileData.subscriptionCost || '29.90');
        setSubPlan(profileData.planType || 'Pro');
    };

    const handleRegistryChange = (field: string, value: string) => {
        setRegistryForm((prev: any) => ({ ...prev, [field]: value }));
    };

    const activateFreeTrial = () => {
        const today = new Date();
        today.setDate(today.getDate() + 15);
        setSubDate(today.toISOString());
        setSubPlan('Trial');
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
                name: viewingProfile.restaurant_name 
            }
        };

        const updatedProfile = { ...viewingProfile, settings: updatedSettings };
        setViewingProfile(updatedProfile);
        setProfiles(prev => prev.map(p => p.id === viewingProfile.id ? updatedProfile : p));

        const { error } = await supabase
            .from('profiles')
            .update({ settings: updatedSettings })
            .eq('id', viewingProfile.id);

        if (error) {
            alert("ERRORE SALVATAGGIO: " + error.message);
            fetchProfiles();
        } else {
            setIsEditingRegistry(false);
            alert("Dati aggiornati con successo!");
        }
    };

    // ... (Other functions like toggleStatus, deleteProfile, etc. kept same) ...
    const toggleStatus = async (id: string, currentStatus: string, email: string) => { if (id.startsWith('demo-')) { alert("Questa è una riga simulata."); return; } if (email === SUPER_ADMIN_EMAIL) { alert("Non puoi sospendere l'account Super Admin."); return; } if (!supabase) return; const newStatus = currentStatus === 'active' ? 'suspended' : 'active'; const { error } = await supabase.from('profiles').update({ subscription_status: newStatus }).eq('id', id); if (!error) fetchProfiles(); else alert("Errore modifica stato: " + error.message); };
    const deleteProfile = async (id: string, name: string, email: string) => { if (email === SUPER_ADMIN_EMAIL) { alert("OPERAZIONE NEGATA."); return; } if (id.startsWith('demo-')) { setProfiles(prev => prev.filter(p => p.id !== id)); return; } if (!confirm(`⚠️ ATTENZIONE: ELIMINAZIONE RISTORANTE\n\nStai per cancellare definitivamente:\nNome: "${name}"\nEmail: ${email}\n\nSei assolutamente sicuro di voler ELIMINARE?`)) { return; } if (!supabase) return; const { error } = await supabase.from('profiles').delete().eq('id', id); if (!error) { fetchProfiles(); } else { console.error(error); alert("ERRORE CANCELLAZIONE: " + error.message); } };
    const startEdit = (profile: any) => { if (profile.id.startsWith('demo-')) return; setEditingId(profile.id); setEditName(profile.restaurant_name || ''); };
    const cancelEdit = () => { setEditingId(null); setEditName(''); };
    const saveEdit = async () => { if (!supabase || !editingId) return; const { error } = await supabase.from('profiles').update({ restaurant_name: editName }).eq('id', editingId); if (!error) { setEditingId(null); fetchProfiles(); } else { alert("Errore salvataggio: " + error.message); } };
    const simulateDemoRow = () => { const fakeId = `demo-${Date.now()}`; const fakeProfile = { id: fakeId, restaurant_name: 'Ristorante Demo (Simulato)', email: 'demo@ristosync.com', subscription_status: 'active', created_at: new Date().toISOString(), settings: { restaurantProfile: { address: "Via Roma 1, Milano", vatNumber: "IT12345678901", phoneNumber: "3339998877" } } }; setProfiles(prev => [fakeProfile, ...prev]); };
    const addMonths = (dateStr: string, months: number) => { const d = dateStr ? new Date(dateStr) : new Date(); d.setMonth(d.getMonth() + months); return d.toISOString().split('T')[0]; };
    const getStatusColor = (profile: any) => { if (profile.subscription_status === 'banned') return 'bg-red-500/20 text-red-400 border-red-500/30'; if (profile.subscription_status === 'suspended') return 'bg-orange-500/20 text-orange-400 border-orange-500/30'; const expiry = profile.settings?.restaurantProfile?.subscriptionEndDate; if (expiry && new Date(expiry) < new Date()) return 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse'; return 'bg-green-500/20 text-green-400 border-green-500/30'; };
    const copySQL = (sql: string, type: 'reset' | 'demo' | 'recovery' | 'public' | 'image' | 'fix') => { navigator.clipboard.writeText(sql); if (type === 'reset') { setCopiedSQL(true); setTimeout(() => setCopiedSQL(false), 2000); } else if (type === 'demo') { setCopiedDemo(true); setTimeout(() => setCopiedDemo(false), 2000); } else if (type === 'public') { setCopiedPublic(true); setTimeout(() => setCopiedPublic(false), 2000); } else if (type === 'image') { setCopiedImage(true); setTimeout(() => setCopiedImage(false), 2000); } else if (type === 'fix') { setCopiedFix(true); setTimeout(() => setCopiedFix(false), 2000); } else { setCopiedRecovery(true); setTimeout(() => setCopiedRecovery(false), 2000); } };
    const getDemoUserSQL = () => `create extension if not exists pgcrypto; insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token) values ('d0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0', '00000000-0000-0000-0000-000000000000', 'demo@ristosync.com', crypt('password123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}', '{"restaurant_name":"Ristorante Demo"}', now(), now(), '', '') on conflict (id) do nothing; insert into public.profiles (id, email, restaurant_name, subscription_status) values ('d0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0', 'demo@ristosync.com', 'Ristorante Demo', 'active') on conflict (id) do update set restaurant_name = 'Ristorante Demo';`;
    const getFixStructureSQL = () => `-- 1. AGGIUNGI COLONNA SETTINGS (Se manca)\nalter table public.profiles add column if not exists settings jsonb default '{}'::jsonb;\n\n-- 2. FORZA AGGIORNAMENTO CACHE API\nNOTIFY pgrst, 'reload schema';\n\n-- 3. ABILITA PERMESSI SUPER ADMIN\ndrop policy if exists "Super Admin Update All" on public.profiles;\ncreate policy "Super Admin Update All" on public.profiles for update\nusing (auth.jwt() ->> 'email' = '${SUPER_ADMIN_EMAIL}');\n\n-- 4. GARANTISCI CHE GLI UTENTI POSSANO MODIFICARE SE STESSI\ndrop policy if exists "User update own profile" on public.profiles;\ncreate policy "User update own profile" on public.profiles for update using (auth.uid() = id);`;
    const isEmailCorrect = currentEmail.toLowerCase() === SUPER_ADMIN_EMAIL;

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                    <div className="flex items-center gap-4"><div className="p-4 bg-red-600 rounded-2xl shadow-lg shadow-red-600/20"><ShieldCheck size={32} /></div><div><h1 className="text-3xl font-black">SUPER ADMIN</h1><div className="flex items-center gap-2 text-slate-400 text-sm"><User size={14}/> {currentEmail ? (<span>Loggato come: <strong className={isEmailCorrect ? "text-green-400" : "text-red-400"}>{currentEmail}</strong></span>) : 'Verifica utente...'}</div></div></div>
                    <div className="flex gap-3"><button onClick={onEnterApp} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all"><Smartphone size={18} /> Entra come Utente</button><button onClick={signOut} className="flex items-center gap-2 text-slate-400 hover:text-white bg-slate-800 px-6 py-3 rounded-xl font-bold border border-slate-700"><LogOut size={18} /> Logout</button></div>
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
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl animate-slide-up relative flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 rounded-t-3xl"><div><h2 className="text-xl font-bold text-white flex items-center gap-2"><FileText className="text-indigo-500" /> Scheda & Abbonamento</h2><p className="text-slate-400 text-sm">{viewingProfile.restaurant_name}</p></div><div className="flex gap-2">{!isEditingRegistry ? (<button onClick={() => setIsEditingRegistry(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center gap-2 transition-colors text-xs"><Edit2 size={14}/> MODIFICA</button>) : (<button onClick={saveRegistryChanges} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl flex items-center gap-2 transition-colors text-xs"><Save size={14}/> SALVA</button>)}<button onClick={() => setViewingProfile(null)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"><X size={20}/></button></div></div>
                        <div className="p-6 overflow-y-auto space-y-6 bg-slate-900">
                            
                            {/* SUBSCRIPTION MANAGEMENT */}
                            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-5"><DollarSign size={80} className="text-green-500"/></div>
                                <h3 className="text-xs font-bold text-green-500 uppercase mb-4 flex items-center gap-2"><Calendar size={14}/> Stato Abbonamento</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                                    <div>
                                        <label className="text-[10px] text-slate-500 uppercase block mb-1">Scadenza Attuale</label>
                                        {isEditingRegistry ? (<input type="date" value={subDate || ''} onChange={(e) => setSubDate(e.target.value)} className="bg-slate-900 border border-slate-700 text-white p-2 rounded-lg w-full font-bold focus:border-green-500 outline-none"/>) : (<div className="flex items-center gap-2"><p className={`text-xl font-mono font-bold ${subDate && new Date(subDate) < new Date() ? 'text-red-500 animate-pulse' : 'text-white'}`}>{subDate ? new Date(subDate).toLocaleDateString() : 'Nessuna data'}</p>{subDate && new Date(subDate) < new Date() && <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-bold uppercase">SCADUTO</span>}</div>)}
                                        <p className="text-[10px] text-slate-500 mt-1">Imposta una data futura per riattivare il servizio.</p>
                                    </div>
                                    
                                    <div>
                                        <label className="text-[10px] text-slate-500 uppercase block mb-1">Costo Mensile (€)</label>
                                        {isEditingRegistry ? (
                                            <input type="text" value={subCost} onChange={(e) => setSubCost(e.target.value)} className="bg-slate-900 border border-slate-700 text-white p-2 rounded-lg w-full font-bold focus:border-green-500 outline-none text-right" placeholder="29.90"/>
                                        ) : (
                                            <p className="text-xl font-mono font-bold text-white text-right">€ {subCost || '29.90'}</p>
                                        )}
                                        <p className="text-[10px] text-slate-500 mt-1 text-right">Visibile al cliente nella dashboard.</p>
                                    </div>

                                    {isEditingRegistry && (
                                        <div className="col-span-full border-t border-slate-800 pt-3">
                                            <div className="flex flex-wrap gap-2 justify-end">
                                                <button onClick={activateFreeTrial} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg border border-blue-500/50 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"><Sparkles size={14}/> Attiva 15gg Gratis</button>
                                                <button onClick={() => setSubDate(addMonths(subDate, 1))} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg border border-slate-700 flex items-center justify-center gap-2">+1 Mese</button>
                                                <button onClick={() => setSubDate(addMonths(subDate, 12))} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg border border-slate-700 flex items-center justify-center gap-2">+1 Anno</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Account Info (Read Only) */}
                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800"><h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2"><User size={14}/> Account ID (Non modificabile)</h3><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] text-slate-500 uppercase block mb-1">ID Tenant</label><p className="text-xs font-mono text-slate-300 break-all">{viewingProfile.id}</p></div><div><label className="text-[10px] text-slate-500 uppercase block mb-1">Email Login</label><p className="text-xs font-mono text-slate-300 break-all">{viewingProfile.email}</p></div></div></div>

                            {/* EDIT FORM */}
                            <div className="space-y-4">
                                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-700"><h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><Briefcase size={14}/> Dati Aziendali</h4><div className="grid grid-cols-1 gap-3"><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Ragione Sociale</label>{isEditingRegistry ? (<input type="text" value={registryForm.businessName} onChange={e => handleRegistryChange('businessName', e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1 text-white" placeholder="Es. Rossi S.r.l." />) : ( <p className="text-white font-bold">{viewingProfile.settings?.restaurantProfile?.businessName || '-'}</p> )}</div><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Responsabile</label>{isEditingRegistry ? (<input type="text" value={registryForm.responsiblePerson} onChange={e => handleRegistryChange('responsiblePerson', e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1 text-white" placeholder="Nome Cognome" />) : ( <p className="text-white font-bold">{viewingProfile.settings?.restaurantProfile?.responsiblePerson || '-'}</p> )}</div></div></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="bg-slate-800 p-3 rounded-xl border border-slate-700"><div className="flex items-center gap-2 mb-2 text-slate-400 text-xs font-bold uppercase"><CreditCard size={14}/> P.IVA / C.F.</div>{isEditingRegistry ? (<input type="text" value={registryForm.vatNumber} onChange={e => handleRegistryChange('vatNumber', e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1 text-white font-mono" placeholder="IT..." />) : ( <p className="text-white font-mono font-bold text-lg">{viewingProfile.settings?.restaurantProfile?.vatNumber || '-'}</p> )}</div><div className="bg-slate-800 p-3 rounded-xl border border-slate-700"><div className="flex items-center gap-2 mb-2 text-slate-400 text-xs font-bold uppercase"><Smartphone size={14}/> Cellulare</div>{isEditingRegistry ? (<input type="text" value={registryForm.phoneNumber} onChange={e => handleRegistryChange('phoneNumber', e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1 text-white" placeholder="333..." />) : ( <p className="text-white font-bold">{viewingProfile.settings?.restaurantProfile?.phoneNumber || '-'}</p> )}</div></div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-900 border-t border-slate-800 rounded-b-3xl flex justify-end gap-3">{isEditingRegistry && <button onClick={() => setIsEditingRegistry(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors">Annulla</button>}<button onClick={isEditingRegistry ? saveRegistryChanges : () => setViewingProfile(null)} className={`px-6 py-2 font-bold rounded-xl transition-colors ${isEditingRegistry ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>{isEditingRegistry ? 'Salva Modifiche' : 'Chiudi'}</button></div>
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