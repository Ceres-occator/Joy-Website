'use client'

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

interface DashboardMetrics {
  totalRevenue: number;
  totalBookingsCount: number;
  eventBookingsCount: number;
  accommodationBookingsCount: number;
}

interface HistoricalRecord {
  id: string;
  customer_name: string;
  total_price: number;
  status: string;
  package_option: string;
  event_date: string;
  created_at: string;
}

interface VillaLookup {
  id: string;
  name: string;
}

export default function AdminDashboardPage() {
  const supabase = createClient();

  // Core Datasets States
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [history, setHistory] = useState<HistoricalRecord[]>([]);
  const [villas, setVillas] = useState<VillaLookup[]>([]);
  
  // UI Controls
  const [loading, setLoading] = useState(true);
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Manual Cash Field States
  const [selectedVillaId, setSelectedVillaId] = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [evtDate, setEvtDate] = useState('');
  const [tSlot, setTSlot] = useState<'day' | 'evening'>('day');
  const [pkgOpt, setPkgOpt] = useState('with_catering');
  const [cashAmount, setCashAmount] = useState<number>(0);

  async function loadDashboardData() {
    try {
      const res = await fetch('/api/admin/dashboard');
      const data = await res.json();
      if (data.metrics) setMetrics(data.metrics);
      if (data.history) setHistory(data.history);
    } catch (err) {
      console.error("Failed to sync structural dashboard values:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
    
    async function loadVillas() {
      const { data } = await supabase.from('villas').select('id, name').order('name');
      if (data && data.length > 0) {
        setVillas(data);
        setSelectedVillaId(data[0].id);
      }
    }
    loadVillas();
  }, []);

  const handleCashWalkinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          villaId: selectedVillaId,
          customerName: custName,
          customerPhone: custPhone,
          eventDate: evtDate,
          timeSlot: tSlot,
          packageOption: pkgOpt,
          totalPrice: cashAmount
        })
      });

      if (res.ok) {
        alert("In-Person Cash booking successfully generated and confirmed!");
        setShowWalkinModal(false);
        setCustName(''); setCustPhone(''); setEvtDate(''); setCashAmount(0);
        loadDashboardData();
      } else {
        const data = await res.json();
        alert(`Failed to save walk-in: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="p-12 text-zinc-400 text-center text-xs italic animate-pulse">Computing system financial records...</p>;

  return (
    <section className="space-y-6 max-w-6xl mx-auto animate-fadeIn pb-12">
      
      {/* Upper Control Row Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-4">
        <div className="space-y-0.5">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 font-extrabold sm:text-sm">Overview</p>
          <h2 className="text-2xl font-black text-zinc-900 sm:text-3xl tracking-tight">Revenue and Occupancy Hub</h2>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowSummaryModal(true)}
            className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition shadow-sm"
          >
            📋 View Business Summary
          </button>
          <button 
            onClick={() => setShowWalkinModal(true)}
            className="rounded-xl bg-emerald-600 text-white px-3.5 py-2 text-xs font-bold hover:bg-emerald-700 transition shadow-sm"
          >
            ➕ Log Cash Walk-in
          </button>
        </div>
      </div>

      {/* 📊 Metrics Scorecards */}
      <div className="grid gap-4 sm:gap-6 sm:grid-cols-4">
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm relative overflow-hidden group">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Revenue</p>
          <p className="mt-2 text-3xl font-black text-emerald-600 tracking-tight">
            ₱{metrics?.totalRevenue.toLocaleString() || "0"}
          </p>
          <div className="absolute right-4 bottom-4 text-xs font-black px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100">Live Earnings</div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Confirmed Bookings</p>
          <p className="mt-2 text-3xl font-black text-zinc-900 tracking-tight">{metrics?.totalBookingsCount || 0}</p>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm border-l-amber-400 border-l-4">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">☀️ Event Venue Stays</p>
          <p className="mt-2 text-2xl font-bold text-zinc-800 tracking-tight">{metrics?.eventBookingsCount || 0} Blocks</p>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm border-l-purple-500 border-l-4">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">🏡 Full Accommodation stays</p>
          <p className="mt-2 text-2xl font-bold text-zinc-800 tracking-tight">{metrics?.accommodationBookingsCount || 0} Stays</p>
        </div>
      </div>

      {/* 📜 CONTAINED SCROLLABLE TABLE AREA */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">🧾 Transaction History Ledger Ticker</h3>
          <p className="text-xs text-zinc-500">Live audit log stream capturing incoming deposit receipts and cash receipts.</p>
        </div>

        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
          {/* Height bounded view frame box */}
          <div className="max-h-[80vh] overflow-y-auto overflow-x-auto relative">
            <table className="w-full text-left text-xs text-zinc-600 border-collapse">
              {/* Sticky Table Header Column Row */}
              <thead className="bg-zinc-50 font-bold text-zinc-400 uppercase tracking-wider border-b text-[10px] sticky top-0 z-10 shadow-[0_1px_0_0_rgba(228,228,231,1)]">
                <tr>
                  <th className="p-3.5 bg-zinc-50">Customer / Target</th>
                  <th className="p-3.5 bg-zinc-50">Package Config Group</th>
                  <th className="p-3.5 bg-zinc-50">Event Execution Date</th>
                  <th className="p-3.5 bg-zinc-50">System Verification Status</th>
                  <th className="p-3.5 bg-zinc-50 text-right">Total Invoice Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {history.length === 0 ? (
                  <tr><td colSpan={5} className="p-12 text-center text-zinc-400 italic">No historical activities found in database registries.</td></tr>
                ) : (
                  history.map((tx) => (
                    <tr key={tx.id} className="hover:bg-zinc-50/40 transition-colors">
                      <td className="p-3.5 font-bold text-zinc-900">{tx.customer_name}</td>
                      <td className="p-3.5">
                        <span className="font-mono text-[10px] uppercase bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded border">
                          {tx.package_option.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3.5 text-zinc-500 font-semibold">{tx.event_date}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded font-black uppercase text-[9px] border ${
                          tx.status === 'confirmed' || tx.status === 'completed'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : tx.status === 'pending_verification'
                            ? 'bg-amber-50 border-amber-200 text-amber-700 animate-pulse'
                            : 'bg-red-50 border-red-200 text-red-600'
                        }`}>
                          {tx.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-zinc-900 text-xs">
                        ₱{Number(tx.total_price).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cash Walk-in Input Modal */}
      {showWalkinModal && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowWalkinModal(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border text-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-zinc-900 text-base">💰 Log In-Person Cash Payment</h3>
              <button onClick={() => setShowWalkinModal(false)} className="text-zinc-400 text-sm font-bold hover:text-zinc-600">✕</button>
            </div>

            <form onSubmit={handleCashWalkinSubmit} className="space-y-3.5">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Target Villa Property</label>
                <select value={selectedVillaId} onChange={e => setSelectedVillaId(e.target.value)} className="w-full border rounded-xl bg-zinc-50 px-3 py-2 text-sm font-semibold">
                  {villas.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Customer Name</label>
                  <input type="text" required value={custName} onChange={e => setCustName(e.target.value)} placeholder="Full Name" className="w-full border rounded-xl bg-zinc-50 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Contact Number</label>
                  <input type="tel" value={custPhone} onChange={e => setCustPhone(e.target.value)} placeholder="Optional cellphone" className="w-full border rounded-xl bg-zinc-50 px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Stay Date</label>
                  <input type="date" required value={evtDate} onChange={e => setEvtDate(e.target.value)} className="w-full border rounded-xl bg-zinc-50 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Schedule Slot</label>
                  <select value={tSlot} onChange={e => setTSlot(e.target.value as any)} className="w-full border rounded-xl bg-zinc-50 px-3 py-2 text-sm font-bold">
                    <option value="day">Day Timeframe</option>
                    <option value="evening">Evening Timeframe</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Package Core Option</label>
                <select value={pkgOpt} onChange={e => setPkgOpt(e.target.value)} className="w-full border rounded-xl bg-zinc-50 px-3 py-2 text-sm font-bold">
                  <option value="with_catering">With Catering Support</option>
                  <option value="venue_only">Venue Only (No Catering)</option>
                  <option value="accommodation_only">Accommodation Only</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Cash Payment Received (PHP ₱)</label>
                <input type="number" required value={cashAmount} onChange={e => setCashAmount(Number(e.target.value))} placeholder="Amount collected in person" className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 font-mono font-bold text-emerald-600 text-base" />
              </div>

              <button type="submit" disabled={submitting} className="w-full bg-zinc-950 text-white font-bold py-3 rounded-xl hover:bg-zinc-800 transition mt-2 shadow-sm text-xs uppercase tracking-wider">
                {submitting ? 'Processing Ledger...' : 'Confirm Cash Stay'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Summary Analytics Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSummaryModal(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border text-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-zinc-900 text-base">📋 Executive Business Summary</h3>
              <button onClick={() => setShowSummaryModal(false)} className="text-zinc-400 text-sm font-bold hover:text-zinc-600">✕</button>
            </div>

            <div className="space-y-3 font-medium text-zinc-700">
              <div className="border rounded-2xl bg-zinc-50 p-4 space-y-2.5 font-mono text-xs">
                <div className="flex justify-between border-b pb-1.5"><span className="text-zinc-400">Total Operational Value:</span><span className="font-bold text-zinc-900">₱{(metrics?.totalRevenue || 0).toLocaleString()}</span></div>
                <div className="flex justify-between border-b pb-1.5"><span className="text-zinc-400">Venue Share Ratio:</span><span className="font-bold text-amber-600">{(((metrics?.eventBookingsCount || 0) / (metrics?.totalBookingsCount || 1)) * 100).toFixed(1)}%</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Accommodation Share:</span><span className="font-bold text-purple-600">{(((metrics?.accommodationBookingsCount || 0) / (metrics?.totalBookingsCount || 1)) * 100).toFixed(1)}%</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}