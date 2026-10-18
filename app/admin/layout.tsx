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
    <div className="min-h-screen neu-bg text-slate-800 flex flex-col lg:grid lg:grid-cols-[250px_1fr] font-sans antialiased">
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-[#0a0e15]/90 backdrop-blur-md">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="leading-tight">
            <p className="text-xs text-gray-600 dark:text-gray-300">Joy&apos;s Events Place</p>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Admin Panel</h1>
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full text-rose-600 dark:text-rose-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Sidebar: flat, separated by a single divider */}
      <aside className="hidden lg:flex flex-col justify-between h-screen sticky top-0 select-none border-r border-gray-200 dark:border-gray-800 px-5 py-8">
        <div className="space-y-10">
          <div className="flex items-start justify-between gap-2 px-2">
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-300">Joy&apos;s Events Place</p>
              <h1 className="mt-0.5 text-xl font-semibold text-gray-900 dark:text-gray-100">
                Admin Panel
              </h1>
            </div>
            <ThemeToggle />
          </div>

          <nav className="space-y-1 text-sm font-medium" aria-label="Admin">
            {ADMIN_NAV_LINKS.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center px-3 py-2.5 rounded-md transition-colors ${
                    active
                      ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  <Icon className="mr-3 w-4 h-4 shrink-0" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-10 overflow-y-auto max-w-full pb-28 lg:pb-10">
        {children}
      </main>

      {/* Mobile Bottom Bar */}
      <nav
        aria-label="Admin"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-[#0a0e15]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-stretch justify-around h-16">
          {ADMIN_NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center flex-1 gap-1 transition-colors ${
                  active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={active ? 2.25 : 1.75} />
                <span className="text-xs font-medium">{link.label.split(' ')[0]}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}