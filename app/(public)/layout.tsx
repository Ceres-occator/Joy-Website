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
      {/* Top Header: flat bar with a hairline, no boxes */}
      <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 bg-white/85 dark:bg-[#0a0e15]/85 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex flex-col justify-center leading-tight min-w-0">
            <span className="text-sm sm:text-base font-bold tracking-tight text-gray-900 dark:text-gray-100 truncate">
              Joy&apos;s Events and Party Place
            </span>
            <span className="hidden sm:block text-xs text-gray-600 dark:text-gray-300">
              Find your next stay
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <nav className="hidden md:flex items-center gap-1" aria-label="Main">
              {PUBLIC_NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`relative text-sm font-medium px-3 py-2 transition-colors ${
                      active
                        ? 'text-gray-900 dark:text-gray-100 after:absolute after:inset-x-3 after:-bottom-[15px] after:h-0.5 after:bg-emerald-600'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 md:px-8 py-8 md:py-12 pb-28 md:pb-16">{children}</main>

      {/* Mobile Bottom Tab Bar: full width, flat */}
      <nav
        aria-label="Main"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-[#0a0e15]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-stretch justify-around h-16 max-w-md mx-auto">
          {PUBLIC_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center flex-1 gap-1 transition-colors ${
                  active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={active ? 2.25 : 1.75} />
                <span className="text-xs font-medium">
                  {item.label === 'My Bookings' ? 'Bookings' : item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}