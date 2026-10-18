'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { formatCurrency } from '@/utils/formatters';
import type { PaymentSetting, SystemSettings } from '@/types';
import { AdminTableSkeleton } from '@/components/ui/Skeleton';
import {
  Sliders,
  CreditCard,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Pencil,
  Image as ImageIcon,
  X,
} from 'lucide-react';

export default function AdminPaymentSettingsPage() {
  const supabase = createClient();
  const [activeSubTab, setActiveSubTab] = useState<'transactions' | 'rules' | 'manual_qr'>(
    'transactions'
  );

  const [settings, setSettings] = useState<PaymentSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [names, setNames] = useState<Record<string, string>>({});
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [qrPreviews, setQrPreviews] = useState<Record<string, string>>({});

  // Dynamic Business Rules (system_settings)
  const [sysSettings, setSysSettings] = useState<SystemSettings>({
    id: 'default',
    min_deposit_percent: 50,
    forfeiture_days: 7,
    catering_required_amount: 5000,
    catering_deadline_days: 7,
    catering_auto_action: 'flagged',
    admin_alert_phone: '',
    admin_alert_email: '',
  });
  const [savingRules, setSavingRules] = useState(false);

  // PayMongo & Manual Payment Transactions Ledger
  const [transactions, setTransactions] = useState<any[]>([]);
  const [gatewayFilter, setGatewayFilter] = useState<'all' | 'paymongo' | 'manual' | 'cash'>(
    'all'
  );
  const [editingTx, setEditingTx] = useState<any | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/paymongo/webhook`
      : 'https://your-domain.com/api/paymongo/webhook';

  async function loadAllPaymentData() {
    setLoading(true);
    try {
      const [qrRes, sysRes, txRes] = await Promise.all([
        supabase.from('payment_settings').select('*').order('id'),
        fetch('/api/system-settings').then((r) => r.json()),
        fetch('/api/admin/bookings/transactions').then((r) => r.json()),
      ]);

      if (qrRes.data) {
        setSettings(qrRes.data);
        const initialNames: Record<string, string> = {};
        const initialNumbers: Record<string, string> = {};
        const initialPreviews: Record<string, string> = {};

        for (const item of qrRes.data) {
          initialNames[item.id] = item.account_name;
          initialNumbers[item.id] = item.account_number;
          if (item.qr_file_path) {
            const { data: urlData } = supabase.storage
              .from('booking-attachments')
              .getPublicUrl(item.qr_file_path);
            if (urlData?.publicUrl) initialPreviews[item.id] = urlData.publicUrl;
          }
        }
        setNames(initialNames);
        setNumbers(initialNumbers);
        setQrPreviews(initialPreviews);
      }

      if (sysRes?.settings) {
        setSysSettings(sysRes.settings);
      }

      if (txRes?.transactions) {
        setTransactions(txRes.transactions);
      }
    } catch (err) {
      console.error('Failed to load payment settings:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllPaymentData();
  }, []);

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRules(true);
    try {
      const res = await fetch('/api/system-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sysSettings),
      });
      if (res.ok) {
        alert('Forfeiture, catering, and notification rules saved!');
      } else {
        const err = await res.json();
        alert(`Failed to save rules: ${err.error}`);
      }
    } catch (err: any) {
      alert(`Error saving rules: ${err.message}`);
    } finally {
      setSavingRules(false);
    }
  };

  const handleVerifyOrUpdateTx = async (
    tx: any,
    nextStatus: 'paid' | 'failed' | 'refunded' | 'forfeited'
  ) => {
    setSavingId(tx.id);
    try {
      const res = await fetch('/api/admin/bookings/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: tx.id,
          bookingId: tx.booking_id,
          amount: tx.amount,
          paymentPhase: tx.payment_phase || tx.phase,
          paymentGateway: tx.payment_gateway,
          paymentChannel: tx.payment_channel,
          referenceNumber: tx.reference_number,
          accountName: tx.account_name,
          status: nextStatus,
          notes: tx.notes,
        }),
      });
      if (res.ok) {
        setEditingTx(null);
        await loadAllPaymentData();
      } else {
        const data = await res.json();
        alert(data.error || 'Could not update transaction.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveEditedTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    await handleVerifyOrUpdateTx(editingTx, editingTx.status);
  };

  const handleQrUpload = async (id: string, file: File) => {
    setSavingId(id);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `qr_codes/qr_${id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('booking-attachments')
        .upload(filePath, file, { upsert: false, cacheControl: '3600' });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('payment_settings')
        .update({ qr_file_path: filePath, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (dbError) throw dbError;

      alert('QR code updated!');
      loadAllPaymentData();
    } catch (err: any) {
      alert(`Could not upload QR code: ${err.message}`);
    } finally {
      setSavingId(null);
    }
  };

  const handleTextUpdate = async (id: string) => {
    setSavingId(id);
    try {
      const { error } = await supabase
        .from('payment_settings')
        .update({
          account_name: names[id],
          account_number: numbers[id],
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      alert('Payment account details saved!');
      loadAllPaymentData();
    } catch (err: any) {
      alert(`Could not save changes: ${err.message}`);
    } finally {
      setSavingId(null);
    }
  };

  const filteredTransactions = transactions.filter((tx) =>
    gatewayFilter === 'all' ? true : tx.payment_gateway === gatewayFilter
  );

  if (loading) {
    return (
      <section className="space-y-6 max-w-6xl mx-auto pb-12">
        <AdminTableSkeleton rows={5} />
      </section>
    );
  }

  return (
    <section className="space-y-6 max-w-6xl mx-auto pb-12 font-sans animate-fadeIn">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-bold">
            Payments &amp; Business Rules
          </p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
            Payment Gateway &amp; Rules Manager
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
            Verify PayMongo (Chinabank, QR Ph, Cards, GCash, Maya) and Manual transfers, configure
            forfeiture and catering rules, and manage manual QR accounts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 p-1.5 neu-inset w-fit text-xs">
          <button
            type="button"
            onClick={() => setActiveSubTab('transactions')}
            className={`px-4 py-2 font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'transactions'
                ? 'neu-btn-primary'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" /> PayMongo &amp; Manual Ledger
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('rules')}
            className={`px-4 py-2 font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'rules'
                ? 'neu-btn-primary'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> Forfeiture &amp; Catering Rules
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('manual_qr')}
            className={`px-4 py-2 font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'manual_qr'
                ? 'neu-btn-primary'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" /> Manual QR Accounts
          </button>
        </div>
      </div>

      {/* PayMongo Webhook Helper Banner */}
      <div className="neu-card-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-l-4 border-l-indigo-500">
        <div className="space-y-0.5 text-xs">
          <p className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            PayMongo Webhook Endpoint URL (Chinabank, QR Ph, Cards, GCash &amp; Maya)
          </p>
          <p className="text-gray-600 dark:text-gray-300">
            Use this exact endpoint path in your PayMongo Dashboard Webhooks:
          </p>
        </div>
        <div className="flex items-center gap-2 neu-inset px-3 py-2 text-xs font-mono font-semibold text-gray-900 dark:text-gray-100">
          <span className="truncate max-w-[320px] sm:max-w-md">{webhookUrl}</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(webhookUrl);
              setCopiedWebhook(true);
              setTimeout(() => setCopiedWebhook(false), 2000);
            }}
            className="neu-btn px-2.5 py-1 text-xs font-semibold flex items-center gap-1 shrink-0 text-gray-900 dark:text-gray-100"
          >
            {copiedWebhook ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy URL
              </>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: PAYMONGO & MANUAL TRANSACTIONS LEDGER */}
      {activeSubTab === 'transactions' && (
        <div className="space-y-4">
          <div className="neu-card-sm p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="text-gray-600 dark:text-gray-300 uppercase tracking-wider mr-1">
                Filter Gateway:
              </span>
              {(['all', 'paymongo', 'manual', 'cash'] as const).map((gw) => (
                <button
                  key={gw}
                  type="button"
                  onClick={() => setGatewayFilter(gw)}
                  className={`px-3.5 py-1.5 rounded-lg transition-all uppercase text-xs ${
                    gatewayFilter === gw
                      ? 'neu-btn-primary'
                      : 'neu-btn text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {gw === 'all'
                    ? 'All Transactions'
                    : gw === 'paymongo'
                      ? 'PayMongo Online'
                      : gw === 'manual'
                        ? 'Manual Upload'
                        : 'Walk-In Cash'}
                </button>
              ))}
            </div>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Showing {filteredTransactions.length} payment record(s)
            </span>
          </div>

          <div className="neu-card p-2 overflow-hidden">
            <div className="overflow-x-auto max-h-[68vh]">
              <table className="w-full text-left text-xs text-gray-900 dark:text-gray-100 min-w-[1000px] border-collapse">
                <thead className="font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800 text-xs">
                  <tr>
                    <th className="p-4">Guest &amp; Booking</th>
                    <th className="p-4">Gateway &amp; Channel</th>
                    <th className="p-4">Payment Phase</th>
                    <th className="p-4">Reference #</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Verify / Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800 font-medium">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-gray-600 dark:text-gray-300">
                        No transactions found for the selected gateway filter.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                      >
                        <td className="p-4">
                          <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                            {tx.bookings?.customer_name || tx.account_name || 'Guest'}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 font-mono">
                            #{tx.bookings?.guest_id || 'BOOKING'} •{' '}
                            {tx.bookings?.event_date || ''}
                          </div>
                        </td>
                        <td className="p-4">
                          <span
                            className={`text-xs font-semibold uppercase px-2.5 py-0.5 rounded border inline-block ${
                              tx.payment_gateway === 'paymongo'
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-800/60'
                                : tx.payment_gateway === 'cash'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800/60'
                                  : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800/60'
                            }`}
                          >
                            {tx.payment_gateway === 'paymongo'
                              ? 'PayMongo'
                              : tx.payment_gateway === 'cash'
                                ? 'Cash'
                                : 'Manual'}
                          </span>
                          <span className="ml-2 text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">
                            {tx.payment_channel || 'N/A'}
                          </span>
                        </td>
                        <td className="p-4 uppercase text-xs font-semibold text-gray-600 dark:text-gray-300">
                          {(tx.payment_phase || tx.phase || 'downpayment').replace(/_/g, ' ')}
                        </td>
                        <td className="p-4 font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                          #{tx.reference_number || 'N/A'}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-gray-900 dark:text-gray-100 text-sm">
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={`text-xs font-semibold uppercase px-2.5 py-1 rounded border ${
                              tx.status === 'paid' || tx.status === 'verified'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800/60'
                                : tx.status === 'failed' ||
                                    tx.status === 'forfeited' ||
                                    tx.status === 'rejected'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800/60'
                                  : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800/60'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {(tx.status === 'pending_verification' || tx.status === 'pending') && (
                              <>
                                <button
                                  type="button"
                                  disabled={savingId === tx.id}
                                  onClick={() => handleVerifyOrUpdateTx(tx, 'paid')}
                                  className="neu-btn-primary px-3 py-1.5 text-xs font-semibold flex items-center gap-1"
                                  title="Verify & Mark Paid"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Verify
                                </button>
                                <button
                                  type="button"
                                  disabled={savingId === tx.id}
                                  onClick={() => handleVerifyOrUpdateTx(tx, 'failed')}
                                  className="neu-btn px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400"
                                  title="Decline Payment"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingTx({ ...tx })}
                              className="neu-btn px-3 py-1.5 text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DYNAMIC FORFEITURE & CATERING DEADLINE RULES (Uniform Header Typography + Subtle Accents) */}
      {activeSubTab === 'rules' && (
        <form onSubmit={handleSaveRules} className="neu-card p-6 sm:p-8 space-y-6">
          <div className="border-b border-gray-200 dark:border-gray-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Dynamic Forfeiture, Catering &amp; Alert Rules
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                Configure cancellation forfeiture windows, catering payment deadlines, and admin
                notification recipients. (Minimum deposit rates are configured per villa in{' '}
                <strong>Villas &amp; Rates</strong>.)
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* 1. Dynamic Cancellation Policy (Forfeiture Days) */}
            <div className="neu-card-sm border-l-4 border-l-rose-500 p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
                    Cancellation Window
                  </h4>
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                  {sysSettings.forfeiture_days} Days
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                If a guest cancels within <strong>{sysSettings.forfeiture_days} days</strong> of
                their event date, their payment is forfeited with no refund allowed.
              </p>
              <input
                type="number"
                min={0}
                max={90}
                required
                value={sysSettings.forfeiture_days}
                onChange={(e) =>
                  setSysSettings((prev) => ({
                    ...prev,
                    forfeiture_days: Number(e.target.value) || 0,
                  }))
                }
                className="neu-input w-full px-3.5 py-2 text-sm font-mono font-semibold text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* 2. Catering Required Amount */}
            <div className="neu-card-sm border-l-4 border-l-amber-500 p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
                    Required Catering Fee
                  </h4>
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                  {formatCurrency(sysSettings.catering_required_amount)}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Minimum catering payment required from guests who select the &ldquo;With
                Catering&rdquo; package.
              </p>
              <input
                type="number"
                min={0}
                required
                value={sysSettings.catering_required_amount}
                onChange={(e) =>
                  setSysSettings((prev) => ({
                    ...prev,
                    catering_required_amount: Number(e.target.value) || 0,
                  }))
                }
                className="neu-input w-full px-3.5 py-2 text-sm font-mono font-semibold text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* 3. Catering Deadline Days & Auto Action */}
            <div className="neu-card-sm border-l-4 border-l-emerald-500 p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
                    Catering Deadline Rule
                  </h4>
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                  {sysSettings.catering_deadline_days}d Prior
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Days before the appointment (default 7 days / 1 week) by which the catering fee must
                be paid.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <span className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-300 mb-1">
                    Days Before
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    required
                    value={sysSettings.catering_deadline_days}
                    onChange={(e) =>
                      setSysSettings((prev) => ({
                        ...prev,
                        catering_deadline_days: Number(e.target.value) || 7,
                      }))
                    }
                    className="neu-input w-full px-3 py-2 text-xs font-mono font-semibold text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-300 mb-1">
                    If Unpaid
                  </span>
                  <select
                    value={sysSettings.catering_auto_action}
                    onChange={(e) =>
                      setSysSettings((prev) => ({
                        ...prev,
                        catering_auto_action: e.target.value as 'flagged' | 'cancelled',
                      }))
                    }
                    className="neu-input w-full px-2.5 py-2 text-xs font-semibold text-gray-900 dark:text-gray-100"
                  >
                    <option value="flagged">Flag Arrangement</option>
                    <option value="cancelled">Cancel Catering</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Notification Contact Settings */}
          <div className="neu-card-sm border-l-4 border-l-indigo-500 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
                  Admin SMS (Textbee) &amp; Email (Resend) Alert Recipients
                </h4>
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                Alerts
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 text-xs">
              <div>
                <label className="block font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                  Admin Mobile Number for Instant SMS Alerts
                </label>
                <input
                  type="text"
                  value={sysSettings.admin_alert_phone || ''}
                  onChange={(e) =>
                    setSysSettings((prev) => ({ ...prev, admin_alert_phone: e.target.value }))
                  }
                  placeholder="+639171234567 (Overrides ADMIN_ALERT_PHONE if set)"
                  className="neu-input w-full px-3.5 py-2.5 font-mono font-semibold text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                  Admin Email for Booking Notifications
                </label>
                <input
                  type="email"
                  value={sysSettings.admin_alert_email || ''}
                  onChange={(e) =>
                    setSysSettings((prev) => ({ ...prev, admin_alert_email: e.target.value }))
                  }
                  placeholder="admin@joysevents.com"
                  className="neu-input w-full px-3.5 py-2.5 font-medium text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingRules}
            className="neu-btn-primary w-full py-3.5 text-sm font-semibold"
          >
            {savingRules ? 'Saving Rules...' : 'Save Business & Payment Rules'}
          </button>
        </form>
      )}

      {/* TAB 3: MANUAL PAYMENT ACCOUNTS & QR CODES */}
      {activeSubTab === 'manual_qr' && (
        <div className="grid gap-6 md:grid-cols-2">
          {settings.map((gate) => (
            <div
              key={gate.id}
              className="neu-card p-6 space-y-5 flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base">
                    {gate.provider_name}
                  </h3>
                  <span className="neu-inset-sm text-xs uppercase font-mono text-gray-600 dark:text-gray-300 px-2.5 py-1">
                    {gate.id}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={names[gate.id] || ''}
                      onChange={(e) =>
                        setNames((prev) => ({ ...prev, [gate.id]: e.target.value }))
                      }
                      className="neu-input w-full px-3.5 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                      Account or Mobile Number
                    </label>
                    <input
                      type="text"
                      value={numbers[gate.id] || ''}
                      onChange={(e) =>
                        setNumbers((prev) => ({ ...prev, [gate.id]: e.target.value }))
                      }
                      className="neu-input w-full px-3.5 py-2.5 text-sm font-mono font-semibold text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                    QR Code Image
                  </label>
                  <div className="neu-inset p-3.5 flex items-center gap-4">
                    <div className="neu-card-sm h-20 w-20 overflow-hidden relative flex items-center justify-center shrink-0 p-1">
                      {qrPreviews[gate.id] ? (
                        <img
                          src={qrPreviews[gate.id]}
                          alt={`${gate.provider_name} QR Code`}
                          className="h-full w-full object-contain rounded"
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                        Upload a clear image of your QR code so guests using Manual Payment can scan
                        and pay easily.
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        id={`file-${gate.id}`}
                        disabled={savingId !== null}
                        onChange={(e) =>
                          e.target.files?.[0] && handleQrUpload(gate.id, e.target.files[0])
                        }
                        className="hidden"
                      />
                      <label
                        htmlFor={`file-${gate.id}`}
                        className="neu-btn inline-block text-emerald-700 dark:text-emerald-400 px-3.5 py-1.5 text-xs font-semibold cursor-pointer"
                      >
                        Upload QR Image
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={savingId !== null}
                onClick={() => handleTextUpdate(gate.id)}
                className="neu-btn-primary w-full text-xs font-bold py-3 mt-4"
              >
                {savingId === gate.id ? 'Saving...' : 'Save Account Details'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* EDIT PAYMENT TRANSACTION MODAL */}
      {editingTx && (
        <div
          className="fixed inset-0 bg-gray-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setEditingTx(null)}
        >
          <div
            className="neu-card p-6 max-w-md w-full space-y-4 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base">
                Edit Payment Transaction
              </h3>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="neu-btn h-8 w-8 flex items-center justify-center text-gray-600 dark:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedTx} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-gray-600 dark:text-gray-300">
                    Gateway
                  </label>
                  <select
                    value={editingTx.payment_gateway || 'manual'}
                    onChange={(e) =>
                      setEditingTx({ ...editingTx, payment_gateway: e.target.value })
                    }
                    className="neu-input w-full px-3 py-2 text-xs font-semibold text-gray-900 dark:text-gray-100"
                  >
                    <option value="paymongo">PayMongo</option>
                    <option value="manual">Manual</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-gray-600 dark:text-gray-300">
                    Channel / Bank
                  </label>
                  <input
                    type="text"
                    value={editingTx.payment_channel || ''}
                    onChange={(e) =>
                      setEditingTx({ ...editingTx, payment_channel: e.target.value })
                    }
                    className="neu-input w-full px-3 py-2 text-xs font-medium text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-gray-600 dark:text-gray-300">
                    Payment Phase
                  </label>
                  <select
                    value={editingTx.payment_phase || editingTx.phase || 'downpayment'}
                    onChange={(e) =>
                      setEditingTx({ ...editingTx, payment_phase: e.target.value })
                    }
                    className="neu-input w-full px-3 py-2 text-xs font-semibold text-gray-900 dark:text-gray-100"
                  >
                    <option value="downpayment">Downpayment</option>
                    <option value="full_payment">Full Payment</option>
                    <option value="balance_settlement">Follow-Up / Balance</option>
                    <option value="catering_payment">Catering Fee</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-gray-600 dark:text-gray-300">
                    Amount (₱)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editingTx.amount}
                    onChange={(e) =>
                      setEditingTx({ ...editingTx, amount: Number(e.target.value) || 0 })
                    }
                    className="neu-input w-full px-3 py-2 text-xs font-mono font-semibold text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-gray-600 dark:text-gray-300">
                    Sender Name
                  </label>
                  <input
                    type="text"
                    value={editingTx.account_name || ''}
                    onChange={(e) =>
                      setEditingTx({ ...editingTx, account_name: e.target.value })
                    }
                    className="neu-input w-full px-3 py-2 text-xs font-medium text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-gray-600 dark:text-gray-300">
                    Reference #
                  </label>
                  <input
                    type="text"
                    value={editingTx.reference_number || ''}
                    onChange={(e) =>
                      setEditingTx({ ...editingTx, reference_number: e.target.value })
                    }
                    className="neu-input w-full px-3 py-2 text-xs font-mono font-semibold text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-600 dark:text-gray-300">
                  Transaction Status
                </label>
                <select
                  value={editingTx.status || 'pending_verification'}
                  onChange={(e) => setEditingTx({ ...editingTx, status: e.target.value })}
                  className="neu-input w-full px-3 py-2 text-xs font-semibold text-gray-900 dark:text-gray-100"
                >
                  <option value="pending_verification">Pending Verification</option>
                  <option value="paid">Paid &amp; Verified</option>
                  <option value="failed">Failed / Declined</option>
                  <option value="refunded">Refunded</option>
                  <option value="forfeited">Forfeited</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={savingId === editingTx.id}
                className="neu-btn-primary w-full py-3 text-sm font-semibold"
              >
                {savingId === editingTx.id ? 'Saving...' : 'Save Transaction Record'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}