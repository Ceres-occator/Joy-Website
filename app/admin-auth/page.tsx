'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function AdminAuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | null }>({ text: '', type: null });

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: null });

    try {
      // 🌟 FORCE REDIRECT MATCHES ACTIVE TAILSCALE RECIPIENT WINDOW DOMAIN
      const { error } = await supabase.auth.signInWithPassword({ 
        email, 
        password
      });
            
      if (error) throw error;
      
      router.push('/admin/dashboard');
      router.refresh();
    } catch (err: any) {
      setMessage({ 
        text: err.message || "Invalid credentials or unauthorized terminal token access request.", 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-zinc-200 p-6 sm:p-8 max-w-sm w-full space-y-6 shadow-xl text-xs">
        
        <div className="text-center space-y-1">
          <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-600 font-extrabold">Secure Gateway</p>
          <h2 className="text-xl font-black text-zinc-950 tracking-tight">
            Administration Sign-In
          </h2>
          <p className="text-zinc-400 text-[11px]">Authorized management personnel only.</p>
        </div>

        {message.text && (
          <div className="p-3 rounded-xl border font-semibold bg-red-50 border-red-200 text-red-700">
            ⚠️ {message.text}
          </div>
        )}

        <form onSubmit={handleSignIn} className="space-y-4 font-medium text-zinc-700">
          <div>
            <label className="block font-bold mb-1 text-zinc-800">Given Email</label>
            <input 
              type="email" 
              required 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="admin@gmail.com" 
              className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500" 
            />
          </div>

          <div>
            <label className="block font-bold mb-1 text-zinc-800">Security Password</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••" 
              className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500" 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition tracking-wider uppercase text-[10px] shadow-md cursor-pointer shadow-emerald-600/10 active:scale-[0.99]"
          >
            {loading ? 'Verifying Terminal Access...' : 'Sign In to Terminal'}
          </button>
        </form>

        <div className="text-center pt-3 border-t border-zinc-100 text-[10px] text-zinc-400 font-medium">
          🔒 Public self-registration is closed. Contact the system administrator to provision access keys.
        </div>

      </div>
    </div>
  );
}