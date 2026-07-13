// app/admin/layout.tsx
'use client'

import { useState, useEffect } from 'react';
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { 
  LayoutDashboard, 
  CheckSquare, 
  Home, 
  Calendar, 
  Sliders, 
  HelpCircle, // 🚀 Added HelpCircle icon
  LogOut 
} from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    const confirmSignout = confirm("Are you sure you want to terminate your current administration session?");
    if (!confirmSignout) return;

    await supabase.auth.signOut();
    router.push('/admin-auth');
    router.refresh();
  };

  const isActive = (path: string) => pathname === path;

  // 🚀 FIXED: Added the FAQs route as a primary sidebar/dock tab
  const navLinks = [
    { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/bookings", label: "Verify Bookings", icon: CheckSquare },
    { href: "/admin/manage-rooms", label: "Manage Rooms", icon: Home },
    { href: "/admin/calendar", label: "Calendar", icon: Calendar },
    { href: "/admin/payment-settings", label: "Payment Gateways", icon: Sliders },
    { href: "/admin/faqs", label: "Manage FAQs", icon: HelpCircle },
  ];

  if (!mounted) {
    return (
      <div className="min-h-screen bg-zinc-100 flex flex-col items-center justify-center font-sans">
        <div className="text-center space-y-3 animate-pulse">
          <div className="h-7 w-7 bg-emerald-600 rounded-xl mx-auto rotate-12 shadow-md shadow-emerald-600/20" />
          <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.25em]">
            Syncing Console Clusters...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 flex flex-col lg:grid lg:grid-cols-[280px_1fr] font-sans antialiased">
      
      {/* 📱 MOBILE HEADER BAR */}
      <header className="bg-emerald-600 text-white h-16 px-4 flex items-center justify-between shadow-md lg:hidden sticky top-0 z-40 border-b border-emerald-700">
        <div className="flex flex-col justify-center">
          <p className="text-[9px] uppercase tracking-[0.2em] text-emerald-100 font-bold leading-none">Joy's Events and Party Place - Admin</p>
          <h1 className="text-sm font-black text-white mt-0.5 leading-none">Operational Hub</h1>
        </div>
        
        <button 
          type="button" 
          onClick={handleLogout}
          className="text-[10px] font-bold bg-zinc-950 text-emerald-100 border border-zinc-900 px-2.5 py-1.5 rounded-xl active:bg-red-500/20 cursor-pointer transition flex items-center gap-1.5"
        >
          <LogOut className="w-3 h-3" /> Log out
        </button>
      </header>

      {/* 💻 DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex flex-col justify-between rounded-br-[3rem] bg-zinc-950 px-6 py-8 text-white shadow-2xl h-screen sticky top-0 select-none">
        <div className="space-y-10">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-400 font-bold">Admin Console</p>
            <h1 className="mt-4 text-2xl font-black tracking-tight">Operational Hub</h1>
          </div>
          
          <nav className="space-y-2 text-sm font-medium">
            {navLinks.map((link) => {
              const IconComponent = link.icon;
              return (
                <Link 
                  key={link.href}
                  href={link.href} 
                  className={`flex items-center rounded-2xl px-4 py-3 transition-all ${
                    isActive(link.href) 
                      ? 'bg-emerald-600 text-white font-bold shadow-md scale-[1.02]' 
                      : 'text-zinc-400 hover:bg-white/5 hover:text-emerald-400'
                  }`}
                >
                  <IconComponent className="mr-3 w-4 h-4 shrink-0" /> {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-zinc-900">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left rounded-2xl px-4 py-2.5 text-xs font-bold text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-all uppercase tracking-wider flex items-center gap-2 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Terminal Sign Out
          </button>
        </div>
      </aside>

      {/* WORKSPACE AREA CONTAINER */}
      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 overflow-y-auto max-w-full pb-24 lg:pb-8">
        {children}
      </main>

      {/* 📱 MOBILE FLOATING DOCK BAR */}
      <div className="lg:hidden fixed bottom-4 inset-x-4 z-40 animate-slideUp">
        <nav className="bg-emerald-600 border border-emerald-500/30 rounded-2xl p-1.5 h-16 shadow-2xl flex items-center justify-around text-white select-none">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            const IconComponent = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition-all ${
                  active 
                    ? 'bg-zinc-950 text-white font-black scale-102 shadow-md shadow-emerald-950/40' 
                    : 'text-emerald-100 active:text-white'
                }`}
              >
                <IconComponent className="w-4 h-4 mb-1" />
                <span className="text-[9px] font-black tracking-wide uppercase">{link.label.split(' ')[0]}</span>
              </Link>
            );
          })}
        </nav>
      </div>

    </div>
  );
}