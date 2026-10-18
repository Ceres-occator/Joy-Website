'use client';

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import type { FAQItem } from '@/types';
import { SkeletonBox } from '@/components/ui/Skeleton';

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
      <main className="max-w-3xl mx-auto font-sans space-y-10" aria-busy="true">
        <div className="space-y-3">
          <SkeletonBox className="h-4 w-24" />
          <SkeletonBox className="h-10 w-80 max-w-full" />
          <SkeletonBox className="h-5 w-full max-w-md" />
        </div>
        <div className="space-y-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBox key={i} className="h-12 w-full" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto font-sans space-y-12 animate-fadeIn">
      <div className="space-y-3">
        <p className="eyebrow">Help center</p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Frequently asked questions
        </h1>
        <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-xl">
          Find quick answers about check-in times, deposits, extra guests, and house rules.
        </p>
      </div>

      {faqs.length === 0 ? (
        <div className="py-12 text-center space-y-2 border-t border-gray-200 dark:border-gray-800">
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
            No FAQs posted yet.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Please check back soon or message us directly on our Contact page.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-800 border-y border-gray-200 dark:border-gray-800">
          {faqs.map((faq) => {
            const isOpen = openId === faq.id;

            return (
              <div key={faq.id}>
                <button
                  type="button"
                  onClick={() => toggleAccordion(faq.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between py-5 text-left font-semibold text-gray-900 dark:text-gray-100 gap-4 cursor-pointer select-none text-base"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-600 dark:text-gray-300 shrink-0 transition-transform duration-300 ${
                      isOpen ? 'rotate-180 text-emerald-600' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="pb-6 -mt-1 animate-fadeIn text-gray-600 dark:text-gray-300 text-base leading-relaxed whitespace-pre-line">
                    {faq.answer}
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