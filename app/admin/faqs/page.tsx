'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, HelpCircle } from 'lucide-react';
import type { FAQItem } from '@/types';
import { AdminTableSkeleton } from '@/components/ui/Skeleton';

export default function AdminFAQPage() {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      console.error('Failed to load FAQs:', err);
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
    setOrder(faqs.length + 1);
    setShowModal(true);
  };

  const openEditModal = (faq: FAQItem) => {
    setEditId(faq.id);
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setOrder(faq.display_order || 1);
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
        alert('Could not save this question. Please try again.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question from the FAQs page?')) return;
    try {
      const res = await fetch(`/api/admin/faqs?id=${id}`, { method: 'DELETE' });
      if (res.ok) setFaqs((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <section className="max-w-5xl mx-auto space-y-6 pb-12">
        <AdminTableSkeleton rows={5} />
      </section>
    );
  }

  return (
    <section className="max-w-5xl mx-auto space-y-6 pb-12 text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Help Center</p>
          <h2 className="text-2xl font-extrabold text-slate-800 sm:text-3xl">Manage FAQs</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Add or edit common questions and answers shown to guests on the website.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="neu-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold"
        >
          <Plus className="w-4 h-4" /> Add Question
        </button>
      </div>

      {/* FAQ List */}
      <div className="neu-card overflow-hidden p-2">
        {faqs.length === 0 ? (
          <div className="p-16 text-center text-slate-500 text-sm">
            No questions added yet. Click &ldquo;Add Question&rdquo; to create your first FAQ.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-300/60">
                <tr>
                  <th className="p-4 w-16 text-center">Order</th>
                  <th className="p-4">Question & Answer</th>
                  <th className="p-4 text-right w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300/50 font-medium">
                {faqs.map((faq) => (
                  <tr key={faq.id} className="hover:bg-white/30 transition-colors">
                    <td className="p-4 font-mono font-bold text-center text-slate-500">
                      {faq.display_order}
                    </td>
                    <td className="p-4 space-y-1.5">
                      <div className="font-extrabold text-slate-800 text-sm flex items-start gap-2">
                        <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        {faq.question}
                      </div>
                      <div className="text-slate-600 text-xs pl-6 leading-relaxed max-w-3xl">
                        {faq.answer}
                      </div>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => openEditModal(faq)}
                          className="neu-btn p-2 text-slate-600"
                          title="Edit Question"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(faq.id)}
                          className="neu-btn p-2 text-red-600"
                          title="Delete Question"
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

      {/* Add / Edit FAQ Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="neu-card p-6 max-w-lg w-full space-y-5 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-300/60 pb-3">
              <h3 className="font-extrabold text-slate-800 text-base">
                {editId ? 'Edit Question' : 'Add New Question'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="neu-btn px-2.5 py-1 text-slate-500 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 font-semibold text-slate-700">
              <div>
                <label className="block mb-1.5 text-slate-600 text-xs font-bold">Question</label>
                <input
                  type="text"
                  required
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g., What are the check-in and check-out times?"
                  className="neu-input w-full px-3.5 py-2.5 text-sm font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block mb-1.5 text-slate-600 text-xs font-bold">Answer</label>
                <textarea
                  required
                  rows={4}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Write a clear, helpful answer for your guests..."
                  className="neu-input w-full px-3.5 py-2.5 text-sm font-medium text-slate-800 resize-none"
                />
              </div>

              <div>
                <label className="block mb-1.5 text-slate-600 text-xs font-bold">
                  Display Order (1 shows first)
                </label>
                <input
                  type="number"
                  required
                  value={order}
                  onChange={(e) => setOrder(Number(e.target.value))}
                  className="neu-input w-full px-3.5 py-2.5 text-sm font-mono font-bold text-slate-800"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="neu-btn-primary w-full font-bold py-3 text-xs mt-2"
              >
                {submitting ? 'Saving...' : 'Save Question'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}