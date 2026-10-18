'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function AdminAuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      router.push('/admin/dashboard');
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Incorrect email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen neu-bg flex items-center justify-center p-4 font-sans">
      <div className="neu-card p-6 sm:p-8 max-w-sm w-full space-y-6 text-xs">
        <div className="text-center space-y-1">
          <p className="text-[11px] uppercase tracking-widest text-emerald-600 font-bold">
            Staff Portal
          </p>
          <h2 className="text-2xl font-black text-slate-900">Admin Sign In</h2>
          <p className="text-slate-500 text-xs">Sign in to manage bookings and villas.</p>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl font-semibold bg-rose-50 border border-rose-200 text-rose-700">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSignIn} className="space-y-4 font-medium text-slate-700">
          <div>
            <label className="block font-bold mb-1.5 text-slate-700">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="neu-input w-full px-3.5 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block font-bold mb-1.5 text-slate-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="neu-input w-full px-3.5 py-2.5 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="neu-btn-primary w-full font-bold py-3.5 text-xs uppercase tracking-wider"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="text-center pt-3 border-t border-slate-300/60 text-[11px] text-slate-500">
          For authorized staff only. Contact the owner if you need an account.
        </div>
      </div>
    </div>
  );
}