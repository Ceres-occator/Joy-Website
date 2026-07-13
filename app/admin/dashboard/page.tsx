'use client'

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Calendar, Home, DollarSign, PieChart, Layers, Download } from 'lucide-react';

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
  amount_paid: number;
  remaining_balance: number;
  payment_mode: string;
  status: string;
  package_option: string;
  event_date: string;
  slot_assignment: string; 
  pax_count: number;        
  created_at: string;
  villas?: { name: string } | null; 
  villa_id?: string;
}

interface VillaLookup {
  id: string;
  name: string;
}

export default function AdminDashboardPage() {
  const supabase = createClient();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [history, setHistory] = useState<HistoricalRecord[]>([]);
  const [villas, setVillas] = useState<VillaLookup[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [mounted, setMounted] = useState(false);

  // Dropdown States for Walk-in Modal Form
  const [selectedVillaId, setSelectedVillaId] = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [evtDate, setEvtDate] = useState('');
  const [tSlot, setTSlot] = useState<'day' | 'evening'>('day');
  const [pkgOpt, setPkgOpt] = useState('with_catering');
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [walkinPaymentMode, setWalkinPaymentMode] = useState<'half' | 'full'>('full');

  // Interactive Filter Selector States for Dashboard Views
  const [filterVilla, setFilterVilla] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');

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
    setMounted(true);
    loadDashboardData();
    
    async function loadVillas() {
      const { data } = await supabase.from('villas').select('id, name').order('name');
      if (data && data.length > 0) {
        setVillas(data);
        setSelectedVillaId(data[0].id);
      }
    }
    loadVillas();
  }, [supabase]);

  const handleCashWalkinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const walkinAmountPaid = walkinPaymentMode === 'full' ? cashAmount : cashAmount * 0.5;
    const walkinRemainingBalance = cashAmount - walkinAmountPaid;

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
          totalPrice: cashAmount,
          paymentMode: walkinPaymentMode,
          amountPaid: walkinAmountPaid,
          remainingBalance: walkinRemainingBalance
        })
      });

      if (res.ok) {
        alert("In-Person Cash booking successfully generated and confirmed!");
        setShowWalkinModal(false);
        setCustName(''); setCustPhone(''); setEvtDate(''); setCashAmount(0); setWalkinPaymentMode('full');
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

  // Dynamic Client-Side Filter Calculations
  const filteredHistory = history.filter((record) => {
    const matchesVilla = filterVilla === 'all' || 
      record.villas?.name === filterVilla || 
      record.villa_id === filterVilla;

    let matchesMonth = true;
    if (filterMonth !== 'all' && record.event_date) {
      const parts = record.event_date.split('-');
      if (parts.length >= 2) {
        matchesMonth = parts[1] === filterMonth;
      }
    }

    return matchesVilla && matchesMonth;
  });

  // Dynamically Re-compute Display Cards based on Selected Filters
  const totalGrossContractCost = filteredHistory.reduce((sum, item) => sum + (item.total_price || 0), 0);
  
  const displayedRevenueCollected = filteredHistory.reduce((sum, item) => {
    let collected = 0;
    if (item.payment_mode === 'full') {
      collected = item.total_price;
    } else {
      collected = item.amount_paid && item.amount_paid > 0 ? item.amount_paid : item.total_price * 0.5;
    }
    return sum + collected;
  }, 0);

  const displayedUnpaidReceivables = filteredHistory.reduce((sum, item) => {
    let outstanding = 0;
    if (item.payment_mode !== 'full') {
      outstanding = item.remaining_balance !== undefined && item.remaining_balance !== null ? item.remaining_balance : item.total_price * 0.5;
    }
    return sum + outstanding;
  }, 0);

  const displayedTotalCount = filteredHistory.length;
  const displayedVenueOnlyCount = filteredHistory.filter(item => item.package_option === 'venue_only').length;
  const displayedWithCateringCount = filteredHistory.filter(item => item.package_option === 'with_catering').length;
  const displayedAccommodationCount = filteredHistory.filter(item => item.package_option === 'accommodation_only').length;
  const displayedEventCount = displayedVenueOnlyCount + displayedWithCateringCount;

  // REPORT GENERATION ENGINE (CSV EXPORTER)
  const handleDownloadReport = () => {
    if (filteredHistory.length === 0) {
      alert("No transaction entries found inside the current filter scope to generate an audit spreadsheet.");
      return;
    }

    const headers = [
      "Customer Name",
      "Villa Property",
      "Stay Date",
      "Schedule Slot",
      "Package Option",
      "Payment Mode",
      "Status",
      "Pax Count",
      "Amount Paid (PHP)",
      "Remaining Balance (PHP)",
      "Total Gross Price (PHP)"
    ];

    const csvRows = filteredHistory.map((tx) => {
      const displayPaid = tx.payment_mode === 'full' 
        ? tx.total_price 
        : (tx.amount_paid || tx.total_price * 0.5);

      const displayRemaining = tx.payment_mode === 'full'
        ? 0
        : (tx.remaining_balance !== undefined && tx.remaining_balance !== null ? tx.remaining_balance : tx.total_price * 0.5);

      const rowValues = [
        `"${tx.customer_name.replace(/"/g, '""')}"`,
        `"${(tx.villas?.name || "Resort Villa Unit").replace(/"/g, '""')}"`,
        tx.event_date || "",
        tx.slot_assignment || "",
        tx.package_option || "",
        tx.payment_mode || "",
        tx.status || "",
        tx.pax_count || 0,
        Number(displayPaid).toFixed(2),
        Number(displayRemaining).toFixed(2),
        Number(tx.total_price).toFixed(2)
      ];
      
      return rowValues.join(",");
    });

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    const villaNameClean = filterVilla === 'all' ? 'All-Villas' : filterVilla.replace(/\s+/g, '-');
    const monthNameClean = filterMonth === 'all' ? 'Full-History' : `Month-${filterMonth}`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Joy_Resort_Report_${villaNameClean}_${monthNameClean}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Hydration Guard Render Fallback
  if (!mounted || loading) {
    return (
      <section className="space-y-4 max-w-6xl mx-auto opacity-50 select-none font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-4">
          <div className="space-y-0.5">
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 font-extrabold sm:text-sm">Overview</p>
            <h2 className="text-2xl font-black text-zinc-900 sm:text-3xl tracking-tight">Revenue and Occupancy Hub</h2>
          </div>
        </div>
        <div className="p-24 text-center text-zinc-400 text-xs italic animate-pulse bg-white border rounded-[2rem] shadow-sm">
          Computing and compiling financial ecosystem ledger metrics...
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 max-w-6xl mx-auto animate-fadeIn pb-12 font-sans">
      
      {/* HEADER BAR AND MODAL CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-4">
        <div className="space-y-0.5">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 font-extrabold sm:text-sm">Overview</p>
          <h2 className="text-2xl font-black text-zinc-900 sm:text-3xl tracking-tight">Revenue and Occupancy Hub</h2>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowSummaryModal(true)} className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-3.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition shadow-sm">📋 View Business Summary</button>
          <button onClick={() => setShowWalkinModal(true)} className="rounded-xl bg-emerald-600 text-white px-3.5 py-2 text-xs font-bold hover:bg-emerald-700 transition shadow-sm">➕ Log Cash Walk-in</button>
        </div>
      </div>

      {/* DRILLDOWN FILTERS BAR TOOLBAR */}
      <div className="flex flex-wrap items-center gap-3 bg-zinc-50 border border-zinc-200/80 p-3 rounded-2xl">
        <span className="text-xs font-black uppercase text-zinc-400 tracking-wider px-2">Filter Scope:</span>
        
        {/* Villa Selector */}
        <div className="flex items-center bg-white border border-zinc-200 rounded-xl px-3 py-1.5 shadow-sm focus-within:border-emerald-500 transition-all">
          <Home className="w-3.5 h-3.5 text-zinc-400 mr-2" />
          <select
            value={filterVilla}
            onChange={(e) => setFilterVilla(e.target.value)}
            className="text-xs font-bold text-zinc-700 bg-transparent outline-none cursor-pointer pr-2"
          >
            <option value="all">All Villas</option>
            {villas.map((v) => (
              <option key={v.id} value={v.name}>{v.name}</option>
            ))}
          </select>
        </div>

        {/* Month Selector */}
        <div className="flex items-center bg-white border border-zinc-200 rounded-xl px-3 py-1.5 shadow-sm focus-within:border-emerald-500 transition-all">
          <Calendar className="w-3.5 h-3.5 text-zinc-400 mr-2" />
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="text-xs font-bold text-zinc-700 bg-transparent outline-none cursor-pointer pr-2"
          >
            <option value="all">All Months</option>
            <option value="01">January</option>
            <option value="02">February</option>
            <option value="03">March</option>
            <option value="04">April</option>
            <option value="05">May</option>
            <option value="06">June</option>
            <option value="07">July</option>
            <option value="08">August</option>
            <option value="09">September</option>
            <option value="10">October</option>
            <option value="11">November</option>
            <option value="12">December</option>
          </select>
        </div>

        {/* Reset Indicator helper */}
        {(filterVilla !== 'all' || filterMonth !== 'all') && (
          <button 
            onClick={() => { setFilterVilla('all'); setFilterMonth('all'); }} 
            className="text-[10px] uppercase font-black tracking-wide text-zinc-400 hover:text-red-500 transition px-2"
          >
            Reset Filters
          </button>
        )}

        {/* Export Data Spreadsheet Action */}
        <button
          onClick={handleDownloadReport}
          className="ml-auto flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 px-3.5 py-1.5 text-xs font-bold text-zinc-700 shadow-sm transition active:scale-95"
        >
          <Download className="w-3.5 h-3.5 text-zinc-500" />
          Export Spreadsheet
        </button>
      </div>

      {/* DYNAMIC METRICS CARDS DISPLAY PANEL */}
      <div className="grid gap-4 sm:gap-6 sm:grid-cols-4">
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm relative overflow-hidden group">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Collected Revenue</p>
          <p className="mt-2 text-3xl font-black text-emerald-600 tracking-tight">
            ₱{displayedRevenueCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="absolute right-4 bottom-4 text-xs font-black px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100">
            {filterVilla !== 'all' || filterMonth !== 'all' ? 'Filtered View' : 'Live Total'}
          </div>
        </div>
        
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Confirmed Bookings</p>
          <p className="mt-2 text-3xl font-black text-zinc-900 tracking-tight">{displayedTotalCount}</p>
        </div>
        
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm border-l-amber-400 border-l-4">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">☀️ Event Venue Stays</p>
          <p className="mt-2 text-2xl font-bold text-zinc-800 tracking-tight">{displayedEventCount} Blocks</p>
        </div>
        
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm border-l-purple-500 border-l-4">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">🏡 Full Accommodation stays</p>
          <p className="mt-2 text-2xl font-bold text-zinc-800 tracking-tight">{displayedAccommodationCount} Stays</p>
        </div>
      </div>

      {/* FILTERED TRANSACTIONAL HISTORY STREAM TABLE */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">🧾 Transaction History Ledger Ticker</h3>
          <p className="text-xs text-zinc-500">Live audit stream tracking absolute contract metrics across your resort portfolio.</p>
        </div>

        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="max-h-[80vh] overflow-y-auto overflow-x-auto relative">
            <table className="w-full text-left text-xs text-zinc-600 border-collapse">
              <thead className="bg-zinc-50 font-bold text-zinc-400 uppercase tracking-wider border-b text-[10px] sticky top-0 z-10 shadow-[0_1px_0_0_rgba(228,228,231,1)]">
                <tr>
                  <th className="p-3.5 bg-zinc-50">Customer & Stay Details</th>
                  <th className="p-3.5 bg-zinc-50">Event Execution Date</th>
                  <th className="p-3.5 bg-zinc-50 text-right">Amount Paid Now</th>
                  <th className="p-3.5 bg-zinc-50 text-right">Remaining Bill Due</th>
                  <th className="p-3.5 bg-zinc-50 text-right">Total Gross Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {filteredHistory.length === 0 ? (
                  <tr><td colSpan={5} className="p-12 text-center text-zinc-400 italic">No historical activities found for the selected filter scope.</td></tr>
                ) : (
                  filteredHistory.map((tx) => {
                    const displayPaid = tx.payment_mode === 'full' 
                      ? tx.total_price 
                      : (tx.amount_paid !== undefined && tx.amount_paid !== null && tx.amount_paid > 0 ? tx.amount_paid : tx.total_price * 0.5);

                    const displayRemaining = tx.payment_mode === 'full'
                      ? 0
                      : (tx.remaining_balance !== undefined && tx.remaining_balance !== null ? tx.remaining_balance : tx.total_price * 0.5);

                    return (
                      <tr key={tx.id} className="hover:bg-zinc-50/40 transition-colors">
                        <td className="p-3.5 space-y-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="font-bold text-zinc-900 text-sm block">{tx.customer_name}</span>
                              <span className="text-zinc-400 font-bold text-[11px] block mt-0.5">{tx.villas?.name || "Resort Villa Unit"}</span>
                            </div>
                            <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border tracking-wide ${
                              tx.payment_mode === 'full' 
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                                : 'bg-amber-50 border-amber-100 text-amber-700'
                            }`}>
                              {tx.payment_mode === 'full' ? '💰 Fully Paid' : '🌓 50% Deposit'}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap gap-1 items-center font-bold text-[8px] uppercase tracking-wider pt-1">
                            <span className="bg-zinc-100 text-zinc-500 border rounded px-1.5 py-0.2">{tx.status}</span>
                            <span className="bg-blue-50 text-blue-600 border border-blue-100 rounded px-1.5 py-0.2">{tx.package_option.replace('_', ' ')}</span>
                            {tx.slot_assignment && <span className="bg-amber-50 text-amber-700 border border-amber-100 rounded px-1.5 py-0.2">⏳ {tx.slot_assignment}</span>}
                            {tx.pax_count > 0 && <span className="bg-purple-50 text-purple-700 border border-purple-100 rounded px-1.5 py-0.2">👥 {tx.pax_count} Pax</span>}
                          </div>
                        </td>
                        <td className="p-3.5 text-zinc-500 font-semibold text-xs whitespace-nowrap">{tx.event_date}</td>
                        <td className="p-3.5 text-right font-mono font-black text-emerald-600 text-xs">
                          ₱{Number(displayPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-amber-600 text-xs">
                          ₱{Number(displayRemaining).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3.5 text-right font-mono font-black text-zinc-950 text-xs bg-zinc-50/30">
                          ₱{Number(tx.total_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Walk-in Modal Form */}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Package Option</label>
                  <select value={pkgOpt} onChange={e => setPkgOpt(e.target.value)} className="w-full border rounded-xl bg-zinc-50 px-3 py-2 text-sm font-bold">
                    <option value="with_catering">With Catering</option>
                    <option value="venue_only">Venue Only</option>
                    <option value="accommodation_only">Accommodation</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Payment Type</label>
                  <select value={walkinPaymentMode} onChange={e => setWalkinPaymentMode(e.target.value as any)} className="w-full border rounded-xl bg-zinc-50 px-3 py-2 text-sm font-bold">
                    <option value="full">Full 100% Cash</option>
                    <option value="half">Half 50% Deposit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Total Package Price (PHP ₱)</label>
                <input type="number" required value={cashAmount} onChange={e => setCashAmount(Number(e.target.value))} placeholder="Total package contract cost" className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 font-mono font-bold text-emerald-600 text-base" />
              </div>

              <button type="submit" disabled={submitting} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition mt-2 shadow-sm text-xs uppercase tracking-wider">
                {submitting ? 'Processing Ledger...' : 'Confirm Cash Stay'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic Executive Business Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSummaryModal(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border text-xs" onClick={(e) => e.stopPropagation()}>
            
            <div className="flex items-center justify-between border-b pb-3">
              <div className="space-y-0.5">
                <h3 className="font-black text-zinc-900 text-base uppercase tracking-tight">📋 Executive Business Summary</h3>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                  Scope: {filterVilla === 'all' ? 'All Accommodations' : filterVilla} • {filterMonth === 'all' ? 'All Time' : `Month Code: ${filterMonth}`}
                </p>
              </div>
              <button onClick={() => setShowSummaryModal(false)} className="text-zinc-400 text-sm font-bold hover:text-zinc-600">✕</button>
            </div>

            <div className="space-y-4 font-medium text-zinc-700">
              
              {/* Financial Breakdown Section */}
              <div className="space-y-2">
                <p className="font-black uppercase tracking-wider text-zinc-400 text-[10px] flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Cash Flow Matrix
                </p>
                <div className="border rounded-2xl bg-zinc-50 p-4 space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-zinc-500">Gross Booked Value:</span>
                    <span className="font-black text-zinc-950">₱{totalGrossContractCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-zinc-400">↳ Liquid Funds Collected:</span>
                    <span className="font-bold text-emerald-600">₱{displayedRevenueCollected.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">↳ Outstanding Receivables:</span>
                    <span className="font-bold text-amber-600">₱{displayedUnpaidReceivables.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </div>
              </div>

              {/* Share Distribution Section */}
              <div className="space-y-2">
                <p className="font-black uppercase tracking-wider text-zinc-400 text-[10px] flex items-center gap-1">
                  <PieChart className="w-3.5 h-3.5 text-blue-600" /> Operational Volume Allocations
                </p>
                <div className="border rounded-2xl bg-zinc-50 p-4 space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-zinc-500">Total Pipeline Stays:</span>
                    <span className="font-black text-zinc-950">{displayedTotalCount} Units</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-zinc-400">Event Volume Ratio:</span>
                    <span className="font-bold text-amber-600">
                      {displayedTotalCount > 0 ? ((displayedEventCount / displayedTotalCount) * 100).toFixed(1) : "0.0"}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Accommodation Ratio:</span>
                    <span className="font-bold text-purple-600">
                      {displayedTotalCount > 0 ? ((displayedAccommodationCount / displayedTotalCount) * 100).toFixed(1) : "0.0"}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Detailed Package Variant Demands */}
              <div className="space-y-2">
                <p className="font-black uppercase tracking-wider text-zinc-400 text-[10px] flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-purple-600" /> Package Distribution Details
                </p>
                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="bg-zinc-50 border p-2.5 rounded-xl">
                    <span className="block text-[9px] uppercase tracking-wide font-bold text-zinc-400">Catering</span>
                    <span className="block text-base font-black text-zinc-900 mt-1">{displayedWithCateringCount}</span>
                  </div>
                  <div className="bg-zinc-50 border p-2.5 rounded-xl">
                    <span className="block text-[9px] uppercase tracking-wide font-bold text-zinc-400">Venue Only</span>
                    <span className="block text-base font-black text-zinc-900 mt-1">{displayedVenueOnlyCount}</span>
                  </div>
                  <div className="bg-zinc-50 border p-2.5 rounded-xl">
                    <span className="block text-[9px] uppercase tracking-wide font-bold text-zinc-400">Lodging Only</span>
                    <span className="block text-base font-black text-zinc-900 mt-1">{displayedAccommodationCount}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </section>
  );
}