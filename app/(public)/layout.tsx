// app/(public)/layout.tsx
'use client'

import { useState, useEffect } from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Home, Info, Phone, CalendarDays, HelpCircle } from "lucide-react"; 

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const supabase = createClient();
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Evaluate if a public customer account authentication session is active
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setIsLoggedIn(true);
    });
  }, [supabase]);

  const isActive = (path: string) => pathname === path;

  if (!mounted) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center font-sans">
        <div className="text-center space-y-2 animate-pulse">
          <div className="h-6 w-6 bg-emerald-600 rounded-lg mx-auto" />
          <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">
            Synchronizing Viewport...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900 font-sans antialiased">
      
      {/* 💻 PUBLIC DESKTOP HEADER */}
      <header className="bg-emerald-600 border-b border-emerald-700 text-white sticky top-0 h-16 z-40 shadow-sm flex items-center select-none w-full">
        <div className="w-full max-w-full px-4 md:px-12 lg:px-24 flex items-center justify-between">
          
          {/* 🏷️ LOGO IDENTITY AREA */}
          <Link href="/" className="flex flex-col justify-center cursor-pointer group">
            <p className="text-[9px] uppercase tracking-[0.2em] text-emerald-100 font-bold leading-none">
              Joy's Events and Party Place
            </p>
            <h1 className="text-sm font-black tracking-tight text-white mt-0.5 leading-none">
              Find your next stay
            </h1>
          </Link>
          
          {/* 🗺️ NAVIGATION LINKS CONTAINER */}
          <nav className="hidden items-center gap-[30px] md:flex h-full">
            <Link 
              href="/" 
              className={`text-xs uppercase tracking-wider font-extrabold px-4 py-2 rounded-xl transition-all ${
                isActive('/') 
                  ? 'bg-zinc-950 text-white shadow-sm' 
                  : 'text-emerald-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              Home
            </Link>
            <Link 
              href="/about" 
              className={`text-xs uppercase tracking-wider font-extrabold px-4 py-2 rounded-xl transition-all ${
                isActive('/about') 
                  ? 'bg-zinc-950 text-white shadow-sm' 
                  : 'text-emerald-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              About
            </Link>
            <Link 
              href="/contact" 
              className={`text-xs uppercase tracking-wider font-extrabold px-4 py-2 rounded-xl transition-all ${
                isActive('/contact') 
                  ? 'bg-zinc-950 text-white shadow-sm' 
                  : 'text-emerald-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              Contact
            </Link>
            <Link 
              href="/faqs" 
              className={`text-xs uppercase tracking-wider font-extrabold px-4 py-2 rounded-xl transition-all ${
                isActive('/faqs') 
                  ? 'bg-zinc-950 text-white shadow-sm' 
                  : 'text-emerald-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              FAQs
            </Link>

            {/* DESKTOP LOGGED IN PORTAL LINK BUTTON */}
            {isLoggedIn && (
              <Link 
                href="/my-bookings" 
                className={`text-xs uppercase tracking-wider font-extrabold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                  isActive('/my-bookings') 
                    ? 'bg-zinc-950 text-white shadow-sm' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                My Bookings
              </Link>
            )}
          </nav>
          
        </div>
      </header>

      {/* 📦 CORE CONTENT CONTEXT */}
      <main className="flex-1 px-4 md:px-12 lg:px-24 py-6 pb-28 lg:pb-8">{children}</main>

      {/* 📱 FLOATING MOBILE DOCK BAR */}
      <div className="md:hidden fixed bottom-5 inset-x-4 z-40 animate-slideUp">
        <nav className="bg-emerald-600 border border-emerald-500/30 rounded-2xl p-1 h-16 shadow-2xl flex items-center justify-around text-white select-none">
          
          {/* HOME BUTTON */}
          <Link 
            href="/" 
            className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition-all duration-300 ${
              isActive('/') 
                ? 'bg-zinc-950 text-white font-black scale-102 shadow-md shadow-emerald-950/40' 
                : 'text-emerald-100 active:text-white'
            }`}
          >
            <Home className="w-4 h-4 mb-0.5" />
            <span className="text-[8px] font-black tracking-wide uppercase">Home</span>
          </Link>
          
          {/* ABOUT BUTTON */}
          <Link 
            href="/about" 
            className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition-all duration-300 ${
              isActive('/about') 
                ? 'bg-zinc-950 text-white font-black scale-102 shadow-md shadow-emerald-950/40' 
                : 'text-emerald-100 active:text-white'
            }`}
          >
            <Info className="w-4 h-4 mb-0.5" />
            <span className="text-[8px] font-black tracking-wide uppercase">About</span>
          </Link>

          {/* CONTACT BUTTON - RESTORED: Visible across all active navigation lifecycles */}
          <Link 
            href="/contact" 
            className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition-all duration-300 ${
              isActive('/contact') 
                ? 'bg-zinc-950 text-white font-black scale-102 shadow-md shadow-emerald-950/40' 
                : 'text-emerald-100 active:text-white'
            }`}
          >
            <Phone className="w-4 h-4 mb-0.5" />
            <span className="text-[8px] font-black tracking-wide uppercase">Contact</span>
          </Link>

          {/* FAQS BUTTON */}
          <Link 
            href="/faqs" 
            className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition-all duration-300 ${
              isActive('/faqs') 
                ? 'bg-zinc-950 text-white font-black scale-102 shadow-md shadow-emerald-950/40' 
                : 'text-emerald-100 active:text-white'
            }`}
          >
            <HelpCircle className="w-4 h-4 mb-0.5" />
            <span className="text-[8px] font-black tracking-wide uppercase">FAQs</span>
          </Link>

          {/* DYNAMIC INTEGRATION: Appends smoothly at the trailing end if user state matches */}
          {isLoggedIn && (
            <Link 
              href="/my-bookings" 
              className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition-all duration-300 ${
                isActive('/my-bookings') 
                  ? 'bg-zinc-950 text-white font-black scale-102 shadow-md shadow-emerald-950/40' 
                  : 'text-emerald-100 active:text-white font-bold'
              }`}
            >
              <CalendarDays className="w-4 h-4 mb-0.5 text-amber-300" />
              <span className="text-[8px] font-black tracking-wide uppercase text-amber-300">Bookings</span>
            </Link>
          )}
          
        </nav>
      </div>

    </div>
  );
}