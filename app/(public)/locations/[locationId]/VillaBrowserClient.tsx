'use client'

import { useState } from "react";
import Link from "next/link";

interface Villa {
  id: string;
  name: string;
  description: string | null;
  category_type: string[] | null; // Changed from text string to string array wrapper
  image_url?: string | null;
}

export default function VillaBrowserClient({ initialVillas }: { initialVillas: Villa[] }) {
  const [activeTab, setActiveTab] = useState<'All' | 'Accommodation' | 'Events'>('All');

  const filteredVillas = initialVillas.filter(villa => {
    if (activeTab === 'All') return true;
    return villa.category_type?.some(cat => cat?.toLowerCase() === activeTab.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-start gap-2 border-b border-zinc-200 pb-2 overflow-x-auto">
        {(['All', 'Accommodation', 'Events'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-5 py-2 text-xs font-semibold tracking-wide transition-all uppercase ${
              activeTab === tab ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredVillas.map((villa) => (
          <article key={villa.id} className="flex flex-col justify-between border border-zinc-200 bg-white p-6 rounded-2xl shadow-sm">
          <div className="w-full aspect-[4/3] rounded-xl bg-zinc-50 overflow-hidden mb-4 relative border border-zinc-100">
              {villa.image_url ? (
                <img 
                  src={villa.image_url} 
                  alt={villa.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-300 text-2xl">
                  🖼️
                </div>
              )}
            </div>
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-zinc-900">{villa.name}</h3>
                <div className="flex flex-wrap gap-1">
                  {villa.category_type?.map(cat => (
                    <span key={cat} className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-sm text-zinc-600 line-clamp-3 leading-relaxed">{villa.description}</p>
            </div>
            <Link href={`/villas/${villa.id}`} className="mt-6 inline-flex w-full justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition">
              View Details
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}