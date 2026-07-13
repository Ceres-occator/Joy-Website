// app/faqs/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { HelpCircle, ChevronDown, MessageSquare } from 'lucide-react';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  display_order: number;
}

export default function PublicFAQsPage() {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPublicFAQs() {
      try {
        const res = await fetch('/api/admin/faqs');
        const data = await res.json();
        if (data.faqs) {
          setFaqs(data.faqs);
        }
      } catch (err) {
        console.error("Failed to load public portal FAQs:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPublicFAQs();
  }, []);

  const toggleAccordion = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3 font-sans opacity-60">
        <div className="h-7 w-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Syncing Knowledge Base...</p>
      </div>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-20 font-sans antialiased text-zinc-800 space-y-10 animate-fadeIn">
      
      {/* Dynamic Header Box */}
      <div className="text-center space-y-3 border-b pb-8 border-zinc-200/60">
        <div className="h-12 w-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto border border-emerald-100">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-600">Guest Information Hub</p>
          <h1 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight uppercase">Frequently Asked Questions</h1>
        </div>
        <p className="text-zinc-500 max-w-lg mx-auto text-xs sm:text-sm font-medium leading-relaxed">
          Review our live policies regarding reservations, check-in sequences, amenities, and security frameworks compiled by our management team.
        </p>
      </div>

      {/* Accordion List Output */}
      {faqs.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-3xl bg-zinc-50/50">
          <p className="text-zinc-400 italic text-xs font-medium">
            The database FAQ table is currently empty. Add entries via the admin console to update this screen.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {faqs.map((faq) => {
            const isOpen = openId === faq.id;
            
            return (
              <div 
                key={faq.id} 
                className="group border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-sm transition-all duration-300 hover:border-zinc-300/80"
              >
                <button
                  type="button"
                  onClick={() => toggleAccordion(faq.id)}
                  className="w-full flex items-center justify-between p-5 text-left font-bold text-zinc-900 gap-4 cursor-pointer focus:outline-none select-none text-sm sm:text-base"
                >
                  <span className="flex items-start gap-3 tracking-tight font-black text-zinc-950">
                    <HelpCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 transition-transform group-hover:scale-105" />
                    {faq.question}
                  </span>
                  <ChevronDown 
                    className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-300 ${
                      isOpen ? 'transform rotate-180 text-emerald-600' : ''
                    }`} 
                  />
                </button>

                <div 
                  className={`transition-all duration-300 ease-in-out border-zinc-100 ${
                    isOpen ? 'max-h-[500px] opacity-100 border-t p-5 bg-zinc-50/40' : 'max-h-0 opacity-0 pointer-events-none'
                  }`}
                >
                  <p className="text-zinc-600 text-xs sm:text-sm leading-relaxed font-medium whitespace-pre-line pl-8">
                    {faq.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </main>
  );
}