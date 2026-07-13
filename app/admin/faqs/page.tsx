// app/admin/faqs/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, HelpCircle } from 'lucide-react';

interface FAQ {
  id: string;
  question: string; // 🚀 FIXED: Changed from 'text' to primitive type string
  answer: string;   // 🚀 FIXED: Changed from 'text' to primitive type string
  display_order: number;
}

export default function AdminFAQPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Editor Fields State
  const [editId, setEditId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [order, setOrder] = useState<number>(0);

  async function loadFAQs() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/faqs');
      const data = await res.json();
      if (data.faqs) setFaqs(data.faqs);
    } catch (err) {
      console.error("Failed parsing FAQ list parameters:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFAQs();
  }, []);

  const openCreateModal = () => {
    setEditId(null);
    setQuestion('');
    setAnswer('');
    setOrder(faqs.length);
    setShowModal(true);
  };

  const openEditModal = (faq: FAQ) => {
    setEditId(faq.id);
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setOrder(faq.display_order);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = { id: editId, question, answer, display_order: order };
    const method = editId ? 'PUT' : 'POST';

    try {
      const res = await fetch('/api/admin/faqs', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowModal(false);
        loadFAQs();
      } else {
        alert("Action dropped by backend structural handling nodes.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("🚨 Delete this FAQ query entry item permanently from the guest view dashboard?")) return;
    try {
      const res = await fetch(`/api/admin/faqs?id=${id}`, { method: 'DELETE' });
      if (res.ok) setFaqs(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-zinc-400 italic font-sans animate-pulse">
        Compiling active resort inquiries ledger database...
      </div>
    );
  }

  return (
    <section className="max-w-5xl mx-auto space-y-6 p-4 font-sans antialiased text-zinc-800">
      
      {/* HEADER SECTION BLOCK */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-950 tracking-tight uppercase">Knowledge Base Editor</h2>
          <p className="text-xs text-zinc-500 font-medium mt-0.5">Manage the frequently asked questions displayed on the guest booking portal.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 text-xs uppercase tracking-wider transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add FAQ Item
        </button>
      </div>

      {/* CORE DATA ENTRIES LAYOUT STREAM TABLE */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        {faqs.length === 0 ? (
          <div className="p-16 text-center text-zinc-400 font-medium italic text-xs">
            No active FAQ questions found. Click "Add FAQ Item" to initialize items.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-600 border-collapse">
              <thead className="bg-zinc-50 font-bold text-zinc-400 uppercase tracking-wider text-[10px] border-b">
                <tr>
                  <th className="p-4 w-12 text-center">Order</th>
                  <th className="p-4">FAQ Contents Brief</th>
                  <th className="p-4 text-right w-28">Management Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {faqs.map((faq) => (
                  <tr key={faq.id} className="hover:bg-zinc-50/40 transition-colors">
                    <td className="p-4 font-mono font-bold text-center text-zinc-400 bg-zinc-50/20">{faq.display_order}</td>
                    <td className="p-4 space-y-1">
                      <div className="font-black text-zinc-950 text-sm flex items-start gap-1.5">
                        <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        {faq.question}
                      </div>
                      <div className="text-zinc-500 text-xs pl-5 font-normal max-w-3xl line-clamp-2">{faq.answer}</div>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="inline-flex gap-1.5">
                        <button
                          onClick={() => openEditModal(faq)}
                          className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-600 shadow-sm"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(faq.id)}
                          className="p-2 rounded-xl border border-red-100 text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* COMPONENT CRUD FORM MODAL OVERLAY */}
      {showModal && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border text-xs" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-zinc-900 text-base">{editId ? '📝 Edit FAQ Parameters' : '➕ Construct FAQ Entry'}</h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 text-sm font-bold">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 font-semibold text-zinc-600">
              <div>
                <label className="block mb-1 text-zinc-500 uppercase text-[10px]">FAQ Question Title</label>
                <input
                  type="text"
                  required
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="e.g., What is the check-in and check-out time baseline?"
                  className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 text-sm font-bold text-zinc-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block mb-1 text-zinc-500 uppercase text-[10px]">Detailed Explanatory Answer</label>
                <textarea
                  required
                  rows={4}
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  placeholder="Provide a comprehensive clear policy response outline layout down here..."
                  className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-800 focus:outline-none focus:border-emerald-500 font-sans resize-none"
                />
              </div>

              <div>
                <label className="block mb-1 text-zinc-500 uppercase text-[10px]">Display Sequence Priority (Sorting Order Value)</label>
                <input
                  type="number"
                  required
                  value={order}
                  onChange={e => setOrder(Number(e.target.value))}
                  className="w-full border rounded-xl bg-zinc-50 px-3 py-2 text-sm font-mono font-bold text-zinc-900"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 transition mt-2 shadow-md text-xs uppercase tracking-wider"
              >
                {submitting ? 'Committing Modifications...' : 'Confirm FAQ State Sync'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}