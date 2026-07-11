'use client'

import { useState, useEffect } from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Info, Phone } from "lucide-react"; 

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        {/* 🛠️ FIXED: Replaced px-12 with responsive px-4 md:px-12 lg:px-24 */}
        <div className="w-full max-w-full px-4 md:px-12 lg:px-24 flex items-center justify-between">
          
          {/* 🏷️ LOGO IDENTITY AREA */}
          <div className="flex flex-col justify-center">
            <p className="text-[9px] uppercase tracking-[0.2em] text-emerald-100 font-bold leading-none">
              Joy's Events and Party Place
            </p>
            <h1 className="text-sm font-black tracking-tight text-white mt-0.5 leading-none">
              Find your next stay
            </h1>
          </div>
          
          {/* 🗺️ NAVIGATION LINKS CONTAINER */}
          <nav className="hidden items-center gap-[50px] md:flex h-full">
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
          </nav>
          
        </div>
      </header>

      {/* 📦 CORE CONTENT CONTEXT — 🛠️ FIXED: Changed px-12 to responsive px-4 md:px-12 lg:px-24 */}
      <main className="flex-1 px-4 md:px-12 lg:px-24 py-6 pb-24 lg:pb-8">{children}</main>

      {/* 📱 FLOATING MOBILE DOCK BAR */}
      <div className="md:hidden fixed bottom-5 inset-x-4 z-40 animate-slideUp">
        <nav className="bg-emerald-600 border border-emerald-500/30 rounded-2xl p-1.5 h-16 shadow-2xl flex items-center justify-around text-white select-none">
          
          {/* HOME BUTTON */}
          <Link 
            href="/" 
            className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition-all duration-300 ${
              isActive('/') 
                ? 'bg-zinc-950 text-white font-black scale-102 shadow-md shadow-emerald-950/40' 
                : 'text-emerald-100 active:text-white'
            }`}
          >
            <Home className="w-4 h-4 mb-1" />
            <span className="text-[9px] font-black tracking-wide uppercase">Home</span>
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
            <Info className="w-4 h-4 mb-1" />
            <span className="text-[9px] font-black tracking-wide uppercase">About</span>
          </Link>

          {/* CONTACT BUTTON */}
          <Link 
            href="/contact" 
            className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition-all duration-300 ${
              isActive('/contact') 
                ? 'bg-zinc-950 text-white font-black scale-102 shadow-md shadow-emerald-950/40' 
                : 'text-emerald-100 active:text-white'
            }`}
          >
            <Phone className="w-4 h-4 mb-1" />
            <span className="text-[9px] font-black tracking-wide uppercase">Contact</span>
          </Link>
          
        </nav>
      </div>

    </div>
  );
}