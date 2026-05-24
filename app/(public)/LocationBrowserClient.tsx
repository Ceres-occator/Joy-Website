'use client'

import { useState } from "react";
import Link from "next/link";

interface Location {
  id: string;
  name: string;
  address: string | null;
  categories: string[];
  image_url?: string | null;
}

export default function LocationBrowserClient({ initialLocations }: { initialLocations: Location[] }) {
  const [activeTab, setActiveTab] = useState<'All' | 'Accommodation' | 'Events'>('All');

  const filteredLocations = initialLocations.filter(loc => {
    if (activeTab === 'All') return true;
    // Checks if the array contains our tab filter selection safely
    return loc.categories.some(cat => cat?.toLowerCase() === activeTab.toLowerCase());
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

      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredLocations.map((location) => (
          <article key={location.id} className="flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="w-full aspect-[16/9] rounded-xl bg-zinc-100 overflow-hidden mb-4 relative border border-zinc-100">
                {location.image_url ? (
                <img 
                    src={location.image_url} 
                    alt={location.name} 
                    className="w-full h-full object-cover transiti  on-transform duration-300 group-hover:scale-105"
                />
                ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm">
                    📍 No Location Banner Provided
                </div>
                )}
            </div>
            <div>
              <div className="text-3xl mb-3">📍</div>
              <h3 className="text-xl font-semibold text-zinc-900">{location.name}</h3>
              {location.address && <p className="mt-2 text-sm text-zinc-500">{location.address}</p>}
              <div className="mt-3 flex flex-wrap gap-1">
                {location.categories.map(cat => (
                  <span key={cat} className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-zinc-100 rounded text-zinc-500">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
            <Link href={`/locations/${location.id}`} className="mt-6 inline-flex w-full justify-center rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 transition">
              Explore Stays
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}