'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import ThemeToggle from '@/components/ui/ThemeToggle';
import {
  LayoutDashboard,
  CheckSquare,
  Home,
  Calendar,
  Sliders,
  HelpCircle,
  LogOut,
} from 'lucide-react';

const ADMIN_NAV_LINKS = [
  { href: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/bookings', label: 'Bookings', icon: CheckSquare },
  { href: '/admin/manage-rooms', label: 'Villas & Rates', icon: Home },
  { href: '/admin/calendar', label: 'Calendar', icon: Calendar },
  { href: '/admin/payment-settings', label: 'Payments & Rules', icon: Sliders },
  { href: '/admin/faqs', label: 'FAQs', icon: HelpCircle },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to log out?')) return;
    await supabase.auth.signOut();
    router.push('/admin-auth');
    router.refresh();
  };

  const isActive = (path: string) => pathname === path;

  return (
    <div className="min-h-screen neu-bg text-slate-800 flex flex-col lg:grid lg:grid-cols-[270px_1fr] font-sans antialiased">
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 px-4 pt-3 pb-2 neu-bg/90 backdrop-blur-md">
        <div className="neu-card-sm px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold">
              Joy&apos;s Events Place
            </p>
            <h1 className="text-sm font-black text-slate-900">Admin Panel</h1>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLogout}
              className="neu-btn text-xs font-bold px-3 py-1.5 flex items-center gap-1.5 text-rose-600"
            >
              <LogOut className="w-3.5 h-3.5" /> Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col justify-between p-5 h-screen sticky top-0 select-none">
        <div className="neu-card h-full p-6 flex flex-col justify-between">
          <div className="space-y-8">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-emerald-600 font-bold">
                  Joy&apos;s Events Place
                </p>
                <h1 className="mt-1 text-2xl font-black text-slate-900">Admin Panel</h1>
              </div>
              <ThemeToggle />
            </div>

            <nav className="space-y-2.5 text-xs font-bold">
              {ADMIN_NAV_LINKS.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center px-4 py-3 rounded-xl transition-all ${
                      active ? 'neu-btn-primary' : 'neu-btn text-slate-700'
                    }`}
                  >
                    <Icon className="mr-3 w-4 h-4 shrink-0" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="pt-4 border-t border-slate-300/60">
            <button
              type="button"
              onClick={handleLogout}
              className="neu-btn w-full px-4 py-3 text-xs font-bold text-rose-600 flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Log Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 overflow-y-auto max-w-full pb-24 lg:pb-8">
        {children}
      </main>

      {/* Mobile Bottom Dock */}
      <div className="lg:hidden fixed bottom-4 inset-x-4 z-40">
        <nav className="neu-card p-1.5 h-16 flex items-center justify-around select-none">
          {ADMIN_NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition-all ${
                  active ? 'neu-btn-primary font-bold' : 'text-slate-600'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span className="text-[9px] font-bold tracking-wide">
                  {link.label.split(' ')[0]}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}