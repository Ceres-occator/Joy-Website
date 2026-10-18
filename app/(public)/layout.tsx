'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Info, Phone, CalendarDays, HelpCircle } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';

const PUBLIC_NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/about', label: 'About', icon: Info },
  { href: '/contact', label: 'Contact', icon: Phone },
  { href: '/faqs', label: 'FAQs', icon: HelpCircle },
  { href: '/my-bookings', label: 'My Bookings', icon: CalendarDays },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path);

  return (
    <div className="min-h-screen flex flex-col neu-bg text-slate-800 font-sans antialiased">
      {/* Desktop & Mobile Top Header */}
      <header className="sticky top-0 z-40 px-4 md:px-12 lg:px-24 pt-3 pb-2 neu-bg/90 backdrop-blur-md">
        <div className="neu-card-sm px-5 py-3 flex items-center justify-between max-w-6xl mx-auto">
          <Link href="/" className="flex flex-col justify-center cursor-pointer group">
            <span className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold">
              Joy&apos;s Events and Party Place
            </span>
            <h1 className="text-base font-black tracking-tight text-slate-800">
              Find Your Next Stay
            </h1>
          </Link>

          <div className="flex items-center gap-2.5">
            <nav className="hidden md:flex items-center gap-2.5">
              {PUBLIC_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 ${
                      active ? 'neu-btn-primary' : 'neu-btn text-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 md:px-12 lg:px-24 py-6 pb-28 md:pb-12">{children}</main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-4 inset-x-4 z-40">
        <nav className="neu-card p-1.5 h-16 flex items-center justify-around select-none">
          {PUBLIC_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition-all ${
                  active
                    ? 'neu-btn-primary font-bold'
                    : 'text-slate-600 hover:text-emerald-600'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span className="text-[9px] font-bold tracking-wide">
                  {item.label === 'My Bookings' ? 'Bookings' : item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}