'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { formatCurrency, formatPackageLabel, formatStatusLabel } from '@/utils/formatters';
import type { BookingRecord, TimeSlot, VillaLookup } from '@/types';
import WalkInModal from '@/components/admin/WalkInModal';
import BusinessSummaryModal from '@/components/admin/BusinessSummaryModal';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { Calendar, Home, Download } from 'lucide-react';

export default function AdminDashboardPage() {
  const supabase = createClient();

  const [history, setHistory] = useState<BookingRecord[]>([]);
  const [villas, setVillas] = useState<VillaLookup[]>([]);

  const [loading, setLoading] = useState(true);
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedVillaId, setSelectedVillaId] = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [evtDate, setEvtDate] = useState('');
  const [tSlot, setTSlot] = useState<TimeSlot>('day');
  const [pkgOpt, setPkgOpt] = useState('with_catering');
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [walkinPaymentMode, setWalkinPaymentMode] = useState<'half' | 'full'>('full');

  const [filterVilla, setFilterVilla] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');

  async function loadDashboardData() {
    try {
      const res = await fetch('/api/admin/dashboard');
      const data = await res.json();
      if (data.history) setHistory(data.history);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
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
          remainingBalance: walkinRemainingBalance,
        }),
      });

      if (res.ok) {
        alert('Walk-in cash booking saved and confirmed!');
        setShowWalkinModal(false);
        setCustName('');
        setCustPhone('');
        setEvtDate('');
        setCashAmount(0);
        setWalkinPaymentMode('full');
        loadDashboardData();
      } else {
        const data = await res.json();
        alert(`Could not save booking: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredHistory = history.filter((record) => {
    const matchesVilla =
      filterVilla === 'all' ||
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

  const totalGrossContractCost = filteredHistory.reduce(
    (sum, item) => sum + (item.total_price || 0),
    0
  );

  const displayedRevenueCollected = filteredHistory.reduce((sum, item) => {
    const collected =
      item.payment_mode === 'full'
        ? item.total_price
        : item.amount_paid && item.amount_paid > 0
          ? item.amount_paid
          : item.total_price * 0.5;
    return sum + collected;
  }, 0);

  const displayedUnpaidReceivables = filteredHistory.reduce((sum, item) => {
    const outstanding =
      item.payment_mode !== 'full'
        ? item.remaining_balance !== undefined && item.remaining_balance !== null
          ? item.remaining_balance
          : item.total_price * 0.5
        : 0;
    return sum + outstanding;
  }, 0);

  const displayedTotalCount = filteredHistory.length;
  const displayedVenueOnlyCount = filteredHistory.filter(
    (item) => item.package_option === 'venue_only'
  ).length;
  const displayedWithCateringCount = filteredHistory.filter(
    (item) => item.package_option === 'with_catering'
  ).length;
  const displayedAccommodationCount = filteredHistory.filter(
    (item) => item.package_option === 'accommodation_only'
  ).length;
  const displayedEventCount = displayedVenueOnlyCount + displayedWithCateringCount;

  const handleDownloadReport = () => {
    if (filteredHistory.length === 0) {
      alert('No bookings found for the selected filter to export.');
      return;
    }

    const headers = [
      'Guest Name',
      'Villa',
      'Date',
      'Time Slot',
      'Package',
      'Payment Mode',
      'Status',
      'Guests',
      'Amount Paid (PHP)',
      'Remaining Balance (PHP)',
      'Total Price (PHP)',
    ];

    const csvRows = filteredHistory.map((tx) => {
      const displayPaid =
        tx.payment_mode === 'full'
          ? tx.total_price
          : tx.amount_paid || tx.total_price * 0.5;

      const displayRemaining =
        tx.payment_mode === 'full'
          ? 0
          : tx.remaining_balance !== undefined && tx.remaining_balance !== null
            ? tx.remaining_balance
            : tx.total_price * 0.5;

      return [
        `"${(tx.customer_name || '').replace(/"/g, '""')}"`,
        `"${(tx.villas?.name || 'Villa').replace(/"/g, '""')}"`,
        tx.event_date || '',
        tx.slot_assignment || '',
        tx.package_option || '',
        tx.payment_mode || '',
        tx.status || '',
        tx.pax_count || 0,
        Number(displayPaid).toFixed(2),
        Number(displayRemaining).toFixed(2),
        Number(tx.total_price).toFixed(2),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const villaNameClean =
      filterVilla === 'all' ? 'All-Villas' : filterVilla.replace(/\s+/g, '-');
    const monthNameClean = filterMonth === 'all' ? 'All-Months' : `Month-${filterMonth}`;

    link.setAttribute('href', url);
    link.setAttribute('download', `Joy_Resort_Report_${villaNameClean}_${monthNameClean}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <section className="space-y-6 max-w-6xl mx-auto font-sans">
        <DashboardSkeleton />
      </section>
    );
  }

  return (
    <section className="space-y-6 max-w-6xl mx-auto animate-fadeIn pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-600 font-bold">
            Overview
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
            Revenue &amp; Bookings
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowSummaryModal(true)}
            className="neu-btn px-4 py-2.5 text-xs font-bold text-emerald-700"
          >
            View Summary
          </button>
          <button
            type="button"
            onClick={() => setShowWalkinModal(true)}
            className="neu-btn-primary px-4 py-2.5 text-xs font-bold"
          >
            Add Walk-In Booking
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="neu-card-sm p-4 flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold uppercase text-slate-500 tracking-wider px-2">
          Filter:
        </span>

        <div className="flex items-center neu-inset px-3 py-2">
          <Home className="w-3.5 h-3.5 text-slate-500 mr-2" />
          <select
            value={filterVilla}
            onChange={(e) => setFilterVilla(e.target.value)}
            className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer pr-2"
          >
            <option value="all">All Villas</option>
            {villas.map((v) => (
              <option key={v.id} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center neu-inset px-3 py-2">
          <Calendar className="w-3.5 h-3.5 text-slate-500 mr-2" />
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer pr-2"
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

        {(filterVilla !== 'all' || filterMonth !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setFilterVilla('all');
              setFilterMonth('all');
            }}
            className="text-xs font-bold text-rose-600 hover:underline px-2 cursor-pointer"
          >
            Clear Filters
          </button>
        )}

        <button
          type="button"
          onClick={handleDownloadReport}
          className="ml-auto neu-btn flex items-center gap-1.5 px-4 py-2 text-xs font-bold"
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" />
          Download CSV
        </button>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="neu-card p-5 space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Revenue Collected
          </p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">
            {formatCurrency(displayedRevenueCollected, true)}
          </p>
        </div>

        <div className="neu-card p-5 space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Total Bookings
          </p>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{displayedTotalCount}</p>
        </div>

        <div className="neu-card p-5 space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Event Bookings
          </p>
          <p className="text-2xl font-black text-slate-800">{displayedEventCount}</p>
        </div>

        <div className="neu-card p-5 space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Overnight Stays
          </p>
          <p className="text-2xl font-black text-slate-800">{displayedAccommodationCount}</p>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-700">Recent Bookings</h3>
          <p className="text-xs text-slate-500">
            Showing all pending and confirmed bookings for your selected filter.
          </p>
        </div>

        <div className="neu-card overflow-hidden p-2">
          <div className="max-h-[75vh] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead className="font-bold text-slate-500 uppercase tracking-wider border-b border-slate-300/60 text-xs">
                <tr>
                  <th className="p-4">Guest &amp; Villa</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 text-right">Amount Paid</th>
                  <th className="p-4 text-right">Remaining Balance</th>
                  <th className="p-4 text-right">Total Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300/50 font-medium">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-500">
                      No bookings found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((tx) => {
                    const displayPaid =
                      tx.payment_mode === 'full'
                        ? tx.total_price
                        : tx.amount_paid !== undefined &&
                            tx.amount_paid !== null &&
                            tx.amount_paid > 0
                          ? tx.amount_paid
                          : tx.total_price * 0.5;

                    const displayRemaining =
                      tx.payment_mode === 'full'
                        ? 0
                        : tx.remaining_balance !== undefined && tx.remaining_balance !== null
                          ? tx.remaining_balance
                          : tx.total_price * 0.5;

                    return (
                      <tr key={tx.id} className="hover:bg-white/30 transition-colors">
                        <td className="p-4 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-bold text-slate-900 text-sm block">
                                {tx.customer_name}
                              </span>
                              <span className="text-slate-500 font-semibold text-xs block">
                                {tx.villas?.name || 'Villa'}
                              </span>
                            </div>
                            <span
                              className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-lg ${
                                tx.payment_mode === 'full'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {tx.payment_mode === 'full' ? 'Full Payment' : '50% Deposit'}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1.5 items-center font-bold text-xs uppercase pt-0.5">
                            <span className="neu-inset-sm px-2 py-0.5 text-slate-600">
                              {formatStatusLabel(tx.status)}
                            </span>
                            <span className="neu-inset-sm px-2 py-0.5 text-emerald-700">
                              {formatPackageLabel(tx.package_option)}
                            </span>
                            {tx.slot_assignment && (
                              <span className="neu-inset-sm px-2 py-0.5 text-amber-800">
                                {tx.slot_assignment}
                              </span>
                            )}
                            {tx.pax_count > 0 && (
                              <span className="neu-inset-sm px-2 py-0.5 text-purple-800">
                                {tx.pax_count} Guests
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-slate-700 font-semibold whitespace-nowrap">
                          {tx.event_date}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-emerald-700">
                          {formatCurrency(displayPaid, true)}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-amber-700">
                          {formatCurrency(displayRemaining, true)}
                        </td>
                        <td className="p-4 text-right font-mono font-black text-slate-900">
                          {formatCurrency(tx.total_price, true)}
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

      <WalkInModal
        isOpen={showWalkinModal}
        villas={villas}
        selectedVillaId={selectedVillaId}
        setSelectedVillaId={setSelectedVillaId}
        custName={custName}
        setCustName={setCustName}
        custPhone={custPhone}
        setCustPhone={setCustPhone}
        evtDate={evtDate}
        setEvtDate={setEvtDate}
        tSlot={tSlot}
        setTSlot={setTSlot}
        pkgOpt={pkgOpt}
        setPkgOpt={setPkgOpt}
        cashAmount={cashAmount}
        setCashAmount={setCashAmount}
        walkinPaymentMode={walkinPaymentMode}
        setWalkinPaymentMode={setWalkinPaymentMode}
        submitting={submitting}
        onClose={() => setShowWalkinModal(false)}
        onSubmit={handleCashWalkinSubmit}
        onSuccess={loadDashboardData}
      />

      <BusinessSummaryModal
        isOpen={showSummaryModal}
        filterVilla={filterVilla}
        filterMonth={filterMonth}
        totalGrossContractCost={totalGrossContractCost}
        displayedRevenueCollected={displayedRevenueCollected}
        displayedUnpaidReceivables={displayedUnpaidReceivables}
        displayedTotalCount={displayedTotalCount}
        displayedEventCount={displayedEventCount}
        displayedAccommodationCount={displayedAccommodationCount}
        displayedWithCateringCount={displayedWithCateringCount}
        displayedVenueOnlyCount={displayedVenueOnlyCount}
        onClose={() => setShowSummaryModal(false)}
      />
    </section>
  );
}