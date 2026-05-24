'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900">
      
      {/* 💻 PUBLIC DESKTOP TOP HEADER (Fixed Navigation Distribution Layout) */}
      <header className="bg-emerald-600 border-b border-emerald-700 text-white sticky top-0 h-16 z-40 shadow-sm flex items-center">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 flex items-center justify-between">
          
          {/* 🏷️ LOGO IDENTITY AREA (Pinned to the far left) */}
          <div className="flex flex-col justify-center">
            <p className="text-[9px] uppercase tracking-[0.2em] text-emerald-100 font-bold leading-none">
              Maro Airbnb
            </p>
            <h1 className="text-sm font-black tracking-tight text-white mt-0.5 leading-none">
              Find your next stay
            </h1>
          </div>
          
          {/* 🗺️ NAVIGATION LINKS CONTAINER (Pinned cleanly to the far right) */}
          <nav className="hidden items-center gap-1.5 md:flex h-full">
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
          </nav>
          
        </div>
      </header>

      {/* 📦 CORE CONTENT CONTEXT */}
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 pb-24 lg:pb-8">{children}</main>

      {/* 📱 PUBLIC MOBILE FLOATING DOCK BAR */}
      <div className="md:hidden fixed bottom-4 inset-x-4 z-40 animate-slideUp">
        <nav className="bg-emerald-600 border border-emerald-500/30 rounded-2xl p-1.5 h-16 shadow-2xl flex items-center justify-around text-white">
          
          {/* HOME BUTTON */}
          <Link 
            href="/" 
            className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition-all ${
              isActive('/') 
                ? 'bg-zinc-950 text-white font-black scale-102 shadow-md shadow-emerald-950/40' 
                : 'text-emerald-100 active:text-white'
            }`}
          >
            <span className="text-base mb-0.5">🏠</span>
            <span className="text-[9px] font-black tracking-wide uppercase">Home</span>
          </Link>
          
          {/* ABOUT BUTTON */}
          <Link 
            href="/about" 
            className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition-all ${
              isActive('/about') 
                ? 'bg-zinc-950 text-white font-black scale-102 shadow-md shadow-emerald-950/40' 
                : 'text-emerald-100 active:text-white'
            }`}
          >
            <span className="text-lg mb-0.5">ℹ️</span>
            <span className="text-[9px] font-black tracking-wide uppercase">About</span>
          </Link>
          
        </nav>
      </div>

    </div>
  );
}