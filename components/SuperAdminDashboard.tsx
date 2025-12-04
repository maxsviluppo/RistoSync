import React, { useEffect, useState } from 'react';
import { supabase, signOut } from '../services/supabase';
import { ShieldCheck, Users, Database, LogOut, Activity } from 'lucide-react';

const SuperAdminDashboard: React.FC = () => {
    const [profiles, setProfiles] = useState<any[]>([]);
    
    useEffect(() => {
        const fetchProfiles = async () => {
            if (!supabase) return;
            // Note: This query requires Super Admin policies or Service Role Key in a real backend.
            // For now, relies on standard visibility.
            const { data } = await supabase.from('profiles').select('*');
            if (data) setProfiles(data);
        };
        fetchProfiles();
    }, []);

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-10">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-red-600 rounded-2xl shadow-lg shadow-red-600/20">
                            <ShieldCheck size={32} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black">SUPER ADMIN</h1>
                            <p className="text-slate-400">Pannello di Controllo Globale</p>
                        </div>
                    </div>
                    <button onClick={signOut} className="flex items-center gap-2 text-slate-400 hover:text-white bg-slate-800 px-4 py-2 rounded-lg">
                        <LogOut size={18} /> Logout
                    </button>
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

                <div className="bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden">
                    <div className="p-6 border-b border-slate-700">
                         <h2 className="font-bold text-xl">Lista Ristoranti (Tenants)</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-bold">
                                <tr>
                                    <th className="p-6">ID</th>
                                    <th className="p-6">Nome Ristorante</th>
                                    <th className="p-6">Email Admin</th>
                                    <th className="p-6">Stato Abbonamento</th>
                                    <th className="p-6">Data Iscrizione</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {profiles.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="p-6 font-mono text-xs text-slate-500">{p.id.slice(0, 8)}...</td>
                                        <td className="p-6 font-bold text-white">{p.restaurant_name || 'N/A'}</td>
                                        <td className="p-6 text-slate-300">{p.email}</td>
                                        <td className="p-6">
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${p.subscription_status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {p.subscription_status}
                                            </span>
                                        </td>
                                        <td className="p-6 text-slate-500 text-sm">
                                            {new Date(p.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SuperAdminDashboard;
