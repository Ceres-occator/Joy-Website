'use client';

import { useState, useEffect } from 'react';
import { HelpCircle, ChevronDown, MessageSquare } from 'lucide-react';
import type { FAQItem } from '@/types';

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
        console.error('Failed to load FAQs:', err);
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
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3 font-sans">
        <div className="h-8 w-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500">Loading questions...</p>
      </div>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-2 sm:px-4 py-10 font-sans space-y-8 animate-fadeIn">
      <div className="text-center space-y-3">
        <div className="h-14 w-14 neu-card-sm flex items-center justify-center text-emerald-600 mx-auto">
          <MessageSquare className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            Help Center
          </p>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900">
            Frequently Asked Questions
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            Find quick answers about check-in times, deposits, extra guests, and house rules.
          </p>
        </div>
      </div>

      {faqs.length === 0 ? (
        <div className="neu-card p-10 text-center space-y-2">
          <p className="text-sm font-bold text-slate-700">No FAQs posted yet.</p>
          <p className="text-xs text-slate-500">
            Please check back soon or message us directly on our Contact page.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {faqs.map((faq) => {
            const isOpen = openId === faq.id;

            return (
              <div key={faq.id} className="neu-card overflow-hidden transition-all">
                <button
                  type="button"
                  onClick={() => toggleAccordion(faq.id)}
                  className="w-full flex items-center justify-between p-5 text-left font-bold text-slate-900 gap-4 cursor-pointer select-none text-sm sm:text-base"
                >
                  <span className="flex items-start gap-3">
                    <HelpCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{faq.question}</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-300 ${
                      isOpen ? 'rotate-180 text-emerald-600' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 animate-fadeIn">
                    <div className="neu-inset p-4 text-slate-700 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                      {faq.answer}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}