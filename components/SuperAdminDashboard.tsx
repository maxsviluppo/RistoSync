import React, { useEffect, useState } from 'react';
import { supabase, signOut } from '../services/supabase';
import { ShieldCheck, Users, Database, LogOut, Activity, RefreshCw, Smartphone, PlayCircle, PauseCircle, AlertTriangle, Copy, Check, User, PlusCircle, Edit2, Save, X, FlaskConical, Terminal, Trash2, Lock, LifeBuoy, Globe, Image as ImageIcon, FileText, MapPin, Phone, CreditCard, Mail, MessageCircle, Share2, PhoneCall, Facebook, Instagram, Music, Linkedin, Youtube, Store, Compass, UtensilsCrossed, Wrench } from 'lucide-react';

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
    
    // Registry / Profile View & Edit State
    const [viewingProfile, setViewingProfile] = useState<any | null>(null);
    const [isEditingRegistry, setIsEditingRegistry] = useState(false);
    const [registryForm, setRegistryForm] = useState<any>({});

    // Recovery State
    const [recoveryEmail, setRecoveryEmail] = useState('');

    // Inline Name Editing State
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

    // --- REGISTRY EDIT LOGIC ---
    const openRegistry = (profile: any) => {
        setViewingProfile(profile);
        setIsEditingRegistry(false);
        const profileData = profile.settings?.restaurantProfile || {};
        setRegistryForm({
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
    };

    const handleRegistryChange = (field: string, value: string) => {
        setRegistryForm((prev: any) => ({ ...prev, [field]: value }));
    };

    const handleSocialChange = (network: string, value: string) => {
        setRegistryForm((prev: any) => ({
            ...prev,
            socials: {
                ...prev.socials,
                [network]: value
            }
        }));
    };

    const saveRegistryChanges = async () => {
        if (!supabase || !viewingProfile) return;

        const currentSettings = viewingProfile.settings || {};
        
        const updatedSettings = {
            ...currentSettings,
            restaurantProfile: {
                ...registryForm,
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
            alert("ERRORE SALVATAGGIO: " + error.message + "\n\nCausa: Manca la colonna 'settings' o i permessi.\n\nSOLUZIONE: Chiudi questo popup, clicca sul tasto rosso 'Chiave Inglese' (Fix Database) e esegui quel codice SQL su Supabase.");
            fetchProfiles();
        } else {
            setIsEditingRegistry(false);
            alert("Dati aggiornati con successo!");
        }
    };

    // --- EXISTING LOGIC ---

    const toggleStatus = async (id: string, currentStatus: string, email: string) => {
        if (id.startsWith('demo-')) {
            alert("Questa è una riga simulata. Non puoi modificarne lo stato reale.");
            return;
        }
        if (email === SUPER_ADMIN_EMAIL) {
            alert("Non puoi sospendere l'account Super Admin principale.");
            return;
        }
        if (!supabase) return;
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        const { error } = await supabase.from('profiles').update({ subscription_status: newStatus }).eq('id', id);
        if (!error) fetchProfiles();
        else alert("Errore modifica stato: " + error.message);
    };

    const deleteProfile = async (id: string, name: string, email: string) => {
        if (email === SUPER_ADMIN_EMAIL) {
            alert("OPERAZIONE NEGATA\n\nNon è possibile eliminare l'account Super Admin principale.");
            return;
        }
        if (id.startsWith('demo-')) {
            setProfiles(prev => prev.filter(p => p.id !== id));
            return;
        }
        if (!confirm(`⚠️ ATTENZIONE: ELIMINAZIONE RISTORANTE\n\nStai per cancellare definitivamente:\nNome: "${name}"\nEmail: ${email}\n\nSei assolutamente sicuro di voler ELIMINARE?`)) {
            return;
        }
        if (!supabase) return;
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (!error) {
            fetchProfiles();
        } else {
            console.error(error);
            alert("ERRORE CANCELLAZIONE: " + error.message);
        }
    };

    const startEdit = (profile: any) => {
        if (profile.id.startsWith('demo-')) return;
        setEditingId(profile.id);
        setEditName(profile.restaurant_name || '');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName('');
    };

    const saveEdit = async () => {
        if (!supabase || !editingId) return;
        const { error } = await supabase.from('profiles').update({ restaurant_name: editName }).eq('id', editingId);
        if (!error) {
            setEditingId(null);
            fetchProfiles();
        } else {
            alert("Errore salvataggio: " + error.message);
        }
    };

    const ensureAdminProfile = async () => {
        if (!supabase) return;
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            alert("Utente non autenticato.");
            setLoading(false);
            return;
        }
        const { data } = await supabase.from('profiles').select('id').eq('id', user.id).single();
        if (!data) {
            const { error } = await supabase.from('profiles').insert({
                id: user.id,
                email: user.email,
                restaurant_name: 'Super Admin HQ',
                subscription_status: 'active'
            });
            if (error) alert("Errore creazione profilo: " + error.message);
            else {
                alert("Profilo creato!");
                fetchProfiles();
            }
        } else {
            alert("Il tuo profilo esiste già.");
        }
        setLoading(false);
    };

    // --- DEMO FEATURES ---
    const simulateDemoRow = () => {
        const fakeId = `demo-${Date.now()}`;
        const fakeProfile = {
            id: fakeId,
            restaurant_name: 'Ristorante Demo (Simulato)',
            email: 'demo@ristosync.com',
            subscription_status: 'active',
            created_at: new Date().toISOString(),
            settings: {
                restaurantProfile: {
                    address: "Via Roma 1, Milano",
                    vatNumber: "IT12345678901",
                    phoneNumber: "3339998877"
                }
            }
        };
        setProfiles(prev => [fakeProfile, ...prev]);
    };

    const getDemoUserSQL = () => `create extension if not exists pgcrypto; insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token) values ('d0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0', '00000000-0000-0000-0000-000000000000', 'demo@ristosync.com', crypt('password123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}', '{"restaurant_name":"Ristorante Demo"}', now(), now(), '', '') on conflict (id) do nothing; insert into public.profiles (id, email, restaurant_name, subscription_status) values ('d0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0', 'demo@ristosync.com', 'Ristorante Demo', 'active') on conflict (id) do update set restaurant_name = 'Ristorante Demo';`;
    
    const getRecoverySQL = (email: string) => `insert into public.profiles (id, email, restaurant_name, subscription_status) select id, email, 'Ristorante Ripristinato', 'active' from auth.users where email = '${email}' on conflict (id) do update set subscription_status = 'active';`;
    
    const getPublicAccessSQL = () => `drop policy if exists "Public profiles are viewable by everyone" on public.profiles; create policy "Public profiles are viewable by everyone" on public.profiles for select using (true); drop policy if exists "Public menu items are viewable by everyone" on public.menu_items; create policy "Public menu items are viewable by everyone" on public.menu_items for select using (true);`;
    
    const getImageUpdateSQL = () => `alter table public.menu_items add column if not exists image text;`;

    // NEW: Fix Structure SQL - ROBUST VERSION
    const getFixStructureSQL = () => `-- 1. AGGIUNGI COLONNA SETTINGS (Se manca)
alter table public.profiles add column if not exists settings jsonb default '{}'::jsonb;

-- 2. FORZA AGGIORNAMENTO CACHE API (Cruciale per errore 'column not found')
NOTIFY pgrst, 'reload schema';

-- 3. ABILITA PERMESSI SUPER ADMIN (Per modificare i clienti)
drop policy if exists "Super Admin Update All" on public.profiles;
create policy "Super Admin Update All" on public.profiles for update
using (auth.jwt() ->> 'email' = '${SUPER_ADMIN_EMAIL}');

-- 4. GARANTISCI CHE GLI UTENTI POSSANO MODIFICARE SE STESSI
drop policy if exists "User update own profile" on public.profiles;
create policy "User update own profile" on public.profiles for update using (auth.uid() = id);`;
    
    const copySQL = (sql: string, type: 'reset' | 'demo' | 'recovery' | 'public' | 'image' | 'fix') => {
        navigator.clipboard.writeText(sql);
        if (type === 'reset') { setCopiedSQL(true); setTimeout(() => setCopiedSQL(false), 2000); }
        else if (type === 'demo') { setCopiedDemo(true); setTimeout(() => setCopiedDemo(false), 2000); }
        else if (type === 'public') { setCopiedPublic(true); setTimeout(() => setCopiedPublic(false), 2000); }
        else if (type === 'image') { setCopiedImage(true); setTimeout(() => setCopiedImage(false), 2000); }
        else if (type === 'fix') { setCopiedFix(true); setTimeout(() => setCopiedFix(false), 2000); }
        else { setCopiedRecovery(true); setTimeout(() => setCopiedRecovery(false), 2000); }
    };

    const resetSQL = `-- SCRIPT CONFIGURAZIONE DATABASE
create table if not exists public.profiles (id uuid references auth.users on delete cascade not null primary key, email text, restaurant_name text, subscription_status text default 'active', google_api_key text, settings jsonb, created_at timestamp with time zone default timezone('utc'::text, now()) not null);
create table if not exists public.menu_items (id text primary key, user_id uuid references auth.users(id), name text, price numeric, category text, description text, allergens jsonb, image text, created_at timestamp with time zone default timezone('utc'::text, now()) not null);
create table if not exists public.orders (id text primary key, user_id uuid references auth.users(id), table_number text, status text, items jsonb, timestamp bigint, waiter_name text, created_at timestamp with time zone default timezone('utc'::text, now()) not null);
alter table public.profiles enable row level security; alter table public.menu_items enable row level security; alter table public.orders enable row level security;
grant usage on schema public to postgres, anon, authenticated, service_role; grant all privileges on all tables in schema public to postgres, anon, authenticated, service_role; grant all privileges on all functions in schema public to postgres, anon, authenticated, service_role; grant all privileges on all sequences in schema public to postgres, anon, authenticated, service_role;
drop policy if exists "Public profiles view" on public.profiles; create policy "Public profiles view" on public.profiles for select using (true);
drop policy if exists "User update own profile" on public.profiles; create policy "User update own profile" on public.profiles for update using (auth.uid() = id);
drop policy if exists "User insert own profile" on public.profiles; create policy "User insert own profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "Public menu view" on public.menu_items; create policy "Public menu view" on public.menu_items for select using (true);
drop policy if exists "User manage menu" on public.menu_items; create policy "User manage menu" on public.menu_items for all using (auth.uid() = user_id);
drop policy if exists "User manage orders" on public.orders; create policy "User manage orders" on public.orders for all using (auth.uid() = user_id);
insert into public.profiles (id, email, restaurant_name, subscription_status) select id, email, 'Ristorante Demo', 'active' from auth.users where email = 'demo@ristosync.com' on conflict (id) do nothing;`;

    const isEmailCorrect = currentEmail.toLowerCase() === SUPER_ADMIN_EMAIL;

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-red-600 rounded-2xl shadow-lg shadow-red-600/20">
                            <ShieldCheck size={32} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black">SUPER ADMIN</h1>
                            <div className="flex items-center gap-2 text-slate-400 text-sm">
                                <User size={14}/> 
                                {currentEmail ? (
                                    <span>Loggato come: <strong className={isEmailCorrect ? "text-green-400" : "text-red-400"}>{currentEmail}</strong></span>
                                ) : 'Verifica utente...'}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex gap-3">
                        <button onClick={onEnterApp} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all">
                            <Smartphone size={18} /> Entra come Utente
                        </button>
                        <button onClick={signOut} className="flex items-center gap-2 text-slate-400 hover:text-white bg-slate-800 px-6 py-3 rounded-xl font-bold border border-slate-700">
                            <LogOut size={18} /> Logout
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400"><Users /></div>
                            <span className="text-3xl font-bold">{profiles.length}</span>
                        </div>
                        <h3 className="text-slate-400 font-bold uppercase text-xs tracking-wider">Ristoranti Registrati</h3>
                    </div>
                    
                    {/* DEMO CARD */}
                    <div className="bg-slate-800 p-6 rounded-2xl border border-orange-500/30 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity"><FlaskConical size={80} /></div>
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-orange-500/10 rounded-xl text-orange-400"><FlaskConical /></div>
                            <div className="flex gap-2">
                                <button onClick={() => setShowFixModal(true)} className="text-xs bg-red-600 hover:bg-red-500 text-white w-8 h-8 rounded-lg flex items-center justify-center transition-colors shadow-lg animate-pulse" title="FIX DATABASE STRUTTURA & PERMESSI"><Wrench size={16}/></button>
                                <button onClick={() => setShowImageModal(true)} className="text-xs bg-indigo-600/20 hover:bg-indigo-600 hover:text-white text-indigo-400 w-8 h-8 rounded-lg flex items-center justify-center transition-colors border border-indigo-500/30" title="Abilita Foto Database"><ImageIcon size={16}/></button>
                                <button onClick={() => setShowPublicModal(true)} className="text-xs bg-pink-600/20 hover:bg-pink-600 hover:text-white text-pink-400 w-8 h-8 rounded-lg flex items-center justify-center transition-colors border border-pink-500/30" title="Abilita Menu Pubblico"><Globe size={16}/></button>
                                <button onClick={() => setShowRecoveryModal(true)} className="text-xs bg-slate-700 hover:bg-slate-600 text-white w-8 h-8 rounded-lg flex items-center justify-center transition-colors" title="SOS Recovery Utente"><LifeBuoy size={16} className="text-blue-400"/></button>
                                <button onClick={() => setShowSqlModal(true)} className="text-xs bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors"><Terminal size={12}/> CREA DEMO</button>
                            </div>
                        </div>
                        <h3 className="text-slate-400 font-bold uppercase text-xs tracking-wider mb-2">Area Demo & Utility</h3>
                        <button onClick={simulateDemoRow} className="text-orange-400 text-xs hover:underline text-left">+ Aggiungi riga simulata alla tabella</button>
                    </div>

                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-green-500/10 rounded-xl text-green-400"><Database /></div>
                            <span className="text-xs font-mono bg-green-900/30 text-green-400 px-2 py-1 rounded">ONLINE</span>
                        </div>
                        <h3 className="text-slate-400 font-bold uppercase text-xs tracking-wider">Stato Database</h3>
                    </div>
                </div>

                <div className="bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                         <h2 className="font-bold text-xl">Gestione Tenants</h2>
                         <button onClick={fetchProfiles} className="flex items-center gap-2 text-sm font-bold bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-slate-300 transition-colors">
                             <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Aggiorna
                         </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-bold">
                                <tr>
                                    <th className="p-6">Nome Ristorante</th>
                                    <th className="p-6">Email Admin</th>
                                    <th className="p-6">Stato</th>
                                    <th className="p-6 text-right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {profiles.map(p => {
                                    const isFake = p.id.toString().startsWith('demo-');
                                    const isSuperAdminProfile = p.email === SUPER_ADMIN_EMAIL;
                                    const isBanned = p.subscription_status === 'banned';
                                    const hasProfileData = p.settings?.restaurantProfile?.vatNumber || p.settings?.restaurantProfile?.phoneNumber;
                                    
                                    return (
                                        <tr key={p.id} className={`transition-colors ${isFake ? 'bg-orange-500/5 hover:bg-orange-500/10' : 'hover:bg-slate-700/30'} ${isSuperAdminProfile ? 'bg-blue-900/10' : ''}`}>
                                            <td className="p-6">
                                                {editingId === p.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-slate-950 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-bold w-full focus:border-blue-500 outline-none" autoFocus />
                                                        <button onClick={saveEdit} className="p-2 bg-green-600 rounded-lg hover:bg-green-500"><Save size={16}/></button>
                                                        <button onClick={cancelEdit} className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600"><X size={16}/></button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-3 group">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="font-bold text-white text-lg">{p.restaurant_name || 'N/A'}</div>
                                                                {isFake && <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Simulato</span>}
                                                                {isSuperAdminProfile && <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">HQ</span>}
                                                                {isBanned && <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">RICHIESTA SBLOCCO</span>}
                                                            </div>
                                                            <div className="text-xs font-mono text-slate-500 mt-1">{p.id}</div>
                                                        </div>
                                                        {!isFake && (
                                                            <button onClick={() => startEdit(p)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-slate-800 text-blue-400 hover:bg-blue-500 hover:text-white transition-all" title="Modifica Nome"><Edit2 size={14}/></button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-6 text-slate-300 font-medium">{p.email}</td>
                                            <td className="p-6">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${p.subscription_status === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : p.subscription_status === 'banned' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>{p.subscription_status}</span>
                                            </td>
                                            <td className="p-6 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => openRegistry(p)} className={`inline-flex items-center justify-center p-2 rounded-lg border transition-colors ${hasProfileData ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-600 hover:text-white border-indigo-500/20'}`} title="Vedi/Modifica Anagrafica">
                                                        <FileText size={14} />
                                                        {hasProfileData && <span className="ml-1 text-[10px] font-bold">INFO</span>}
                                                    </button>
                                                    {!isSuperAdminProfile && (
                                                        <button onClick={() => toggleStatus(p.id, p.subscription_status, p.email)} className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${isFake ? 'opacity-50 cursor-not-allowed bg-slate-700 text-slate-400' : (p.subscription_status === 'active' ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white border border-green-500/20')}`} title={p.subscription_status === 'active' ? 'Sospendi Account' : 'Attiva Account'}>
                                                            {p.subscription_status === 'active' ? <PauseCircle size={14}/> : <PlayCircle size={14}/>}
                                                        </button>
                                                    )}
                                                    {isSuperAdminProfile ? (
                                                        <div className="inline-flex items-center justify-center p-2 rounded-lg bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed" title="Protetto da cancellazione"><Lock size={14} /></div>
                                                    ) : (
                                                        <button onClick={() => deleteProfile(p.id, p.restaurant_name, p.email)} className="inline-flex items-center justify-center p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-600 hover:text-white border border-red-500/20 transition-colors" title="Elimina Definitivamente"><Trash2 size={14} /></button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {profiles.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={5} className="p-10 text-center">
                                            <div className="flex flex-col items-center gap-3 text-slate-500 max-w-lg mx-auto">
                                                <AlertTriangle size={40} className="text-orange-500 mb-2"/>
                                                <p className="font-bold text-white text-lg">Nessun Ristorante Trovato</p>
                                                <button onClick={ensureAdminProfile} className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-green-600/20 my-4"><PlusCircle size={20} /> Crea Profilo</button>
                                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-700 w-full mt-4 relative group text-left">
                                                    <div className="mb-2 text-xs text-slate-400 uppercase font-bold flex items-center gap-2"><Database size={12}/> SQL Configurazione Iniziale:</div>
                                                    <pre className="text-left text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto h-20 custom-scroll">{resetSQL}</pre>
                                                    <button onClick={() => copySQL(resetSQL, 'reset')} className="absolute top-2 right-2 p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white flex items-center gap-2 font-bold text-xs">{copiedSQL ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}</button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* EDITABLE ANAGRAFICA MODAL */}
            {viewingProfile && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl animate-slide-up relative flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 rounded-t-3xl">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <FileText className="text-indigo-500" /> Scheda Cliente
                                </h2>
                                <p className="text-slate-400 text-sm">{viewingProfile.restaurant_name}</p>
                            </div>
                            <div className="flex gap-2">
                                {!isEditingRegistry ? (
                                    <button onClick={() => setIsEditingRegistry(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center gap-2 transition-colors text-xs"><Edit2 size={14}/> MODIFICA DATI</button>
                                ) : (
                                    <button onClick={saveRegistryChanges} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl flex items-center gap-2 transition-colors text-xs"><Save size={14}/> SALVA</button>
                                )}
                                <button onClick={() => setViewingProfile(null)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
                            </div>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-6 bg-slate-900">
                            {/* Account Info (Read Only) */}
                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2"><User size={14}/> Account ID (Non modificabile)</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-[10px] text-slate-500 uppercase block mb-1">ID Tenant</label><p className="text-xs font-mono text-slate-300 break-all">{viewingProfile.id}</p></div>
                                    <div><label className="text-[10px] text-slate-500 uppercase block mb-1">Email Login</label><p className="text-xs font-mono text-slate-300 break-all">{viewingProfile.email}</p></div>
                                </div>
                            </div>

                            {/* EDIT FORM */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                                        <div className="flex items-center gap-2 mb-2 text-slate-400 text-xs font-bold uppercase"><CreditCard size={14}/> P.IVA / C.F.</div>
                                        {isEditingRegistry ? (
                                            <input type="text" value={registryForm.vatNumber} onChange={e => handleRegistryChange('vatNumber', e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1 text-white font-mono" placeholder="IT..." />
                                        ) : ( <p className="text-white font-mono font-bold text-lg">{viewingProfile.settings?.restaurantProfile?.vatNumber || '-'}</p> )}
                                    </div>
                                    <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                                        <div className="flex items-center gap-2 mb-2 text-slate-400 text-xs font-bold uppercase"><Smartphone size={14}/> Cellulare</div>
                                        {isEditingRegistry ? (
                                            <input type="text" value={registryForm.phoneNumber} onChange={e => handleRegistryChange('phoneNumber', e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1 text-white" placeholder="333..." />
                                        ) : ( <p className="text-white font-bold">{viewingProfile.settings?.restaurantProfile?.phoneNumber || '-'}</p> )}
                                    </div>
                                </div>

                                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                    <div className="flex items-center gap-2 mb-3 text-slate-400 text-xs font-bold uppercase"><MapPin size={14}/> Sede Legale & Operativa</div>
                                    {isEditingRegistry ? (
                                        <input type="text" value={registryForm.address} onChange={e => handleRegistryChange('address', e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1 text-white mb-2" placeholder="Via Roma 1..." />
                                    ) : ( <p className="text-white font-medium mb-2">{viewingProfile.settings?.restaurantProfile?.address || 'Nessun indirizzo specificato'}</p> )}
                                    
                                    <div className="mt-3 pt-3 border-t border-slate-700">
                                        <span className="text-[10px] text-slate-500 uppercase block mb-1">Fatturazione</span>
                                        {isEditingRegistry ? (
                                            <input type="text" value={registryForm.billingAddress} onChange={e => handleRegistryChange('billingAddress', e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1 text-white text-sm" placeholder="Se diverso..." />
                                        ) : ( <p className="text-slate-300 text-sm">{viewingProfile.settings?.restaurantProfile?.billingAddress || '-'}</p> )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                     <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                                        <div className="flex items-center gap-2 mb-2 text-green-500 text-xs font-bold uppercase"><MessageCircle size={14}/> WhatsApp</div>
                                        {isEditingRegistry ? (
                                            <input type="text" value={registryForm.whatsappNumber} onChange={e => handleRegistryChange('whatsappNumber', e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1 text-white" />
                                        ) : ( <p className="text-white font-mono">{viewingProfile.settings?.restaurantProfile?.whatsappNumber || '-'}</p> )}
                                    </div>
                                    <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                                        <div className="flex items-center gap-2 mb-2 text-blue-400 text-xs font-bold uppercase"><Mail size={14}/> Email Pubblica</div>
                                        {isEditingRegistry ? (
                                            <input type="text" value={registryForm.email} onChange={e => handleRegistryChange('email', e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1 text-white text-xs" />
                                        ) : ( <p className="text-white text-xs truncate" title={viewingProfile.settings?.restaurantProfile?.email}>{viewingProfile.settings?.restaurantProfile?.email || '-'}</p> )}
                                    </div>
                                    <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                                        <div className="flex items-center gap-2 mb-2 text-slate-400 text-xs font-bold uppercase"><PhoneCall size={14}/> Fisso</div>
                                        {isEditingRegistry ? (
                                            <input type="text" value={registryForm.landlineNumber} onChange={e => handleRegistryChange('landlineNumber', e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1 text-white" />
                                        ) : ( <p className="text-white font-bold">{viewingProfile.settings?.restaurantProfile?.landlineNumber || '-'}</p> )}
                                    </div>
                                </div>
                                
                                <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase mb-2"><Globe size={14}/> Sito Web</div>
                                    {isEditingRegistry ? (
                                        <input type="text" value={registryForm.website} onChange={e => handleRegistryChange('website', e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1 text-blue-400 text-sm" placeholder="https://..." />
                                    ) : ( <a href={viewingProfile.settings?.restaurantProfile?.website} target="_blank" rel="noreferrer" className="text-blue-400 text-sm hover:underline truncate block">{viewingProfile.settings?.restaurantProfile?.website || '-'}</a> )}
                                </div>

                                {/* Socials Editing */}
                                {isEditingRegistry && (
                                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                        <span className="text-[10px] text-slate-500 uppercase block mb-3 font-bold flex items-center gap-2"><Share2 size={12}/> Modifica Social Links</span>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="relative"><Facebook size={14} className="absolute left-2 top-2 text-blue-500"/><input type="text" value={registryForm.socials?.facebook || ''} onChange={e => handleSocialChange('facebook', e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded pl-7 py-1 text-xs text-white" placeholder="Facebook"/></div>
                                            <div className="relative"><Instagram size={14} className="absolute left-2 top-2 text-pink-500"/><input type="text" value={registryForm.socials?.instagram || ''} onChange={e => handleSocialChange('instagram', e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded pl-7 py-1 text-xs text-white" placeholder="Instagram"/></div>
                                            <div className="relative"><Store size={14} className="absolute left-2 top-2 text-blue-400"/><input type="text" value={registryForm.socials?.google || ''} onChange={e => handleSocialChange('google', e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded pl-7 py-1 text-xs text-white" placeholder="Google"/></div>
                                            <div className="relative"><Compass size={14} className="absolute left-2 top-2 text-green-500"/><input type="text" value={registryForm.socials?.tripadvisor || ''} onChange={e => handleSocialChange('tripadvisor', e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded pl-7 py-1 text-xs text-white" placeholder="TripAdvisor"/></div>
                                        </div>
                                    </div>
                                )}

                                {/* Socials Display */}
                                {!isEditingRegistry && viewingProfile.settings?.restaurantProfile?.socials && Object.keys(viewingProfile.settings.restaurantProfile.socials).some(k => !!viewingProfile.settings.restaurantProfile.socials[k]) && (
                                    <div className="col-span-full mt-4 pt-4 border-t border-slate-800">
                                         <span className="text-[10px] text-slate-500 uppercase block mb-2 font-bold flex items-center gap-2"><Share2 size={12}/> Social Networks</span>
                                         <div className="flex flex-wrap gap-2">
                                             {Object.entries(viewingProfile.settings.restaurantProfile.socials).map(([key, val]) => (
                                                 val ? <a key={key} href={val as string} target="_blank" rel="noreferrer" className="px-3 py-1 bg-slate-800 rounded-lg text-xs text-blue-400 hover:bg-slate-700 hover:text-white border border-slate-700 font-bold capitalize">{key}</a> : null
                                             ))}
                                         </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 bg-slate-900 border-t border-slate-800 rounded-b-3xl flex justify-end gap-3">
                            {isEditingRegistry && <button onClick={() => setIsEditingRegistry(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors">Annulla</button>}
                            <button onClick={isEditingRegistry ? saveRegistryChanges : () => setViewingProfile(null)} className={`px-6 py-2 font-bold rounded-xl transition-colors ${isEditingRegistry ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
                                {isEditingRegistry ? 'Salva Modifiche' : 'Chiudi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FIX STRUCTURE MODAL */}
            {showFixModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-6 w-full max-w-2xl shadow-2xl animate-slide-up relative">
                        <button onClick={() => setShowFixModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X /></button>
                        
                        <div className="flex items-center gap-3 mb-4 text-red-400">
                             <div className="p-2 bg-red-500/10 rounded-lg"><Wrench size={24} /></div>
                             <h2 className="text-xl font-bold text-white">Riparazione Database & Permessi</h2>
                        </div>
                        
                        <p className="text-slate-400 text-sm mb-4">
                            Se i dati "Anagrafica" spariscono o ottieni errori nel salvarli, esegui questo comando.
                            <br/><strong>1. Crea la colonna 'settings'</strong> se mancante.
                            <br/><strong>2. Abilita i permessi Super Admin</strong> per modificare i dati degli altri.
                        </p>

                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative group text-left mb-6">
                            <pre className="text-left text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto h-48 custom-scroll p-2">
{getFixStructureSQL()}
                            </pre>
                            <button 
                                onClick={() => copySQL(getFixStructureSQL(), 'fix')}
                                className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
                            >
                                {copiedFix ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}
                                {copiedFix ? 'COPIATO!' : 'COPIA SQL'}
                            </button>
                        </div>
                        
                        <div className="mt-6 flex justify-end">
                            <button onClick={() => setShowFixModal(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold">Chiudi</button>
                        </div>
                    </div>
                </div>
            )}

            {/* PUBLIC ACCESS MODAL */}
            {showPublicModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-pink-500/30 rounded-3xl p-6 w-full max-w-2xl shadow-2xl animate-slide-up relative">
                        <button onClick={() => setShowPublicModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X /></button>
                        
                        <div className="flex items-center gap-3 mb-4 text-pink-400">
                             <div className="p-2 bg-pink-500/10 rounded-lg"><Globe size={24} /></div>
                             <h2 className="text-xl font-bold text-white">Abilita Menu Digitale</h2>
                        </div>
                        
                        <p className="text-slate-400 text-sm mb-4">
                            Per permettere ai clienti di visualizzare il menu tramite QR Code senza fare login, devi eseguire questo comando SQL <strong>una sola volta</strong>.
                        </p>

                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative group text-left mb-6">
                            <pre className="text-left text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto h-40 custom-scroll p-2">
{getPublicAccessSQL()}
                            </pre>
                            <button 
                                onClick={() => copySQL(getPublicAccessSQL(), 'public')}
                                className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
                            >
                                {copiedPublic ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}
                                {copiedPublic ? 'COPIATO!' : 'COPIA SQL'}
                            </button>
                        </div>
                        
                        <div className="mt-6 flex justify-end">
                            <button onClick={() => setShowPublicModal(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold">Chiudi</button>
                        </div>
                    </div>
                </div>
            )}

            {/* IMAGE ENABLE MODAL */}
            {showImageModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 w-full max-w-2xl shadow-2xl animate-slide-up relative">
                        <button onClick={() => setShowImageModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X /></button>
                        
                        <div className="flex items-center gap-3 mb-4 text-indigo-400">
                             <div className="p-2 bg-indigo-500/10 rounded-lg"><ImageIcon size={24} /></div>
                             <h2 className="text-xl font-bold text-white">Abilita Foto nel Database</h2>
                        </div>
                        
                        <p className="text-slate-400 text-sm mb-4">
                            Se le immagini dei piatti non appaiono sugli altri dispositivi (es. telefono del cliente), è perché manca la colonna nel database. <br/>
                            Esegui questo SQL per aggiungerla.
                        </p>

                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative group text-left mb-6">
                            <pre className="text-left text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto h-40 custom-scroll p-2">
{getImageUpdateSQL()}
                            </pre>
                            <button 
                                onClick={() => copySQL(getImageUpdateSQL(), 'image')}
                                className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
                            >
                                {copiedImage ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}
                                {copiedImage ? 'COPIATO!' : 'COPIA SQL'}
                            </button>
                        </div>
                        
                        <div className="mt-6 flex justify-end">
                            <button onClick={() => setShowImageModal(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold">Chiudi</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuperAdminDashboard;