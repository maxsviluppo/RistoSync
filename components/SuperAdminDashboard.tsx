import React, { useEffect, useState } from 'react';
import { supabase, signOut } from '../services/supabase';
import { ShieldCheck, Users, Database, LogOut, Activity, RefreshCw, Smartphone, PlayCircle, PauseCircle, AlertTriangle, Copy, Check, User } from 'lucide-react';

interface SuperAdminDashboardProps {
    onEnterApp: () => void;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onEnterApp }) => {
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [currentEmail, setCurrentEmail] = useState<string>('');
    
    useEffect(() => {
        // Recupera l'email attuale per mostrarla (Debug)
        supabase?.auth.getUser().then(({ data }) => {
            if (data.user?.email) setCurrentEmail(data.user.email);
        });

        fetchProfiles();
        
        // Auto-refresh ogni 30 secondi
        const interval = setInterval(fetchProfiles, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchProfiles = async () => {
        if (!supabase) return;
        setLoading(true);
        // This query works because of the "Super Admin View All" policy
        const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (data) setProfiles(data);
        if (error) console.error("Errore recupero profili:", error);
        setLoading(false);
    };

    const toggleStatus = async (id: string, currentStatus: string) => {
        if (!supabase) return;
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        
        const { error } = await supabase
            .from('profiles')
            .update({ subscription_status: newStatus })
            .eq('id', id);
            
        if (!error) {
            fetchProfiles(); // Aggiorna la lista
        } else {
            alert("Errore modifica stato: " + error.message);
        }
    };
    
    const copySQL = () => {
        const sql = `-- 1. RESET (CANCELLA REGOLE VECCHIE)
drop policy if exists "Super Admin View All" on public.profiles;
drop policy if exists "Super Admin Update All" on public.profiles;

-- 2. CREA REGOLE NUOVE
create policy "Super Admin View All" on public.profiles for select using ( email ilike 'castro.massimo@yahoo.com' );
create policy "Super Admin Update All" on public.profiles for update using ( email ilike 'castro.massimo@yahoo.com' );`;
        navigator.clipboard.writeText(sql);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
                                {currentEmail ? <span>Loggato come: <strong className="text-white">{currentEmail}</strong></span> : 'Verifica utente...'}
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
                    
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-green-500/10 rounded-xl text-green-400"><Database /></div>
                            <span className="text-xs font-mono bg-green-900/30 text-green-400 px-2 py-1 rounded">ONLINE</span>
                        </div>
                        <h3 className="text-slate-400 font-bold uppercase text-xs tracking-wider">Stato Database</h3>
                    </div>

                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-orange-500/10 rounded-xl text-orange-400"><Activity /></div>
                        </div>
                        <h3 className="text-slate-400 font-bold uppercase text-xs tracking-wider">Attività Recente</h3>
                    </div>
                </div>

                <div className="bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                         <h2 className="font-bold text-xl">Lista Ristoranti (Tenants)</h2>
                         <button onClick={fetchProfiles} className="flex items-center gap-2 text-sm font-bold bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-slate-300 transition-colors">
                             <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Aggiorna Lista
                         </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-bold">
                                <tr>
                                    <th className="p-6">Nome Ristorante</th>
                                    <th className="p-6">Email Admin</th>
                                    <th className="p-6">Stato</th>
                                    <th className="p-6">Data Iscrizione</th>
                                    <th className="p-6 text-right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {profiles.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="p-6">
                                            <div className="font-bold text-white text-lg">{p.restaurant_name || 'N/A'}</div>
                                            <div className="text-xs font-mono text-slate-500 mt-1">{p.id}</div>
                                        </td>
                                        <td className="p-6 text-slate-300 font-medium">{p.email}</td>
                                        <td className="p-6">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${p.subscription_status === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                                {p.subscription_status}
                                            </span>
                                        </td>
                                        <td className="p-6 text-slate-500 text-sm">
                                            {new Date(p.created_at).toLocaleDateString('it-IT')}
                                        </td>
                                        <td className="p-6 text-right">
                                            <button 
                                                onClick={() => toggleStatus(p.id, p.subscription_status)}
                                                className={`inline-flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors
                                                    ${p.subscription_status === 'active' 
                                                        ? 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20' 
                                                        : 'bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white border border-green-500/20'}
                                                `}
                                            >
                                                {p.subscription_status === 'active' ? <PauseCircle size={14}/> : <PlayCircle size={14}/>}
                                                {p.subscription_status === 'active' ? 'Sospendi' : 'Attiva'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {profiles.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={5} className="p-10 text-center">
                                            <div className="flex flex-col items-center gap-3 text-slate-500 max-w-lg mx-auto">
                                                <AlertTriangle size={40} className="text-orange-500 mb-2"/>
                                                <p className="font-bold text-white text-lg">Permessi Database Mancanti</p>
                                                <p className="text-sm">
                                                    Non vedo nessun ristorante. Significa che il database sta bloccando il tuo accesso. 
                                                    Per risolvere, devi incollare questo codice nell'<strong>SQL Editor</strong> di Supabase:
                                                </p>
                                                
                                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-700 w-full mt-4 relative group">
                                                    <pre className="text-left text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto">
{`drop policy if exists "Super Admin View All" on public.profiles;
drop policy if exists "Super Admin Update All" on public.profiles;

create policy "Super Admin View All"
on public.profiles for select
using ( email ilike 'castro.massimo@yahoo.com' );

create policy "Super Admin Update All"
on public.profiles for update
using ( email ilike 'castro.massimo@yahoo.com' );`}
                                                    </pre>
                                                    <button 
                                                        onClick={copySQL}
                                                        className="absolute top-2 right-2 p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                                                        title="Copia SQL"
                                                    >
                                                        {copied ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}
                                                    </button>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-2">Dopo aver cliccato "RUN" su Supabase, clicca "Aggiorna Lista".</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SuperAdminDashboard;