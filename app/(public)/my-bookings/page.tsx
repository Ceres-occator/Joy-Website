'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CreditCard,
  Search,
  Key,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
  Smartphone,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { formatCurrency, formatStatusLabel, formatPackageLabel } from '@/utils/formatters';
import type { PaymentSetting, SystemSettings } from '@/types';
import FloatingInput from '@/components/ui/FloatingInput';
import PhoneInput from '@/components/ui/PhoneInput';
import { SkeletonBox } from '@/components/ui/Skeleton';

interface ClientBooking {
  id: string;
  guest_id: string;
  customer_name: string;
  customer_phone: string;
  email?: string | null;
  event_date: string;
  end_date?: string | null;
  total_price: number;
  amount_paid: number;
  remaining_balance: number;
  status: string;
  package_option: string;
  pax_count: number;
  slot_assignment: string;
  payment_gateway?: string;
  payment_channel?: string | null;
  catering_status?: string;
  catering_required_amount?: number;
  catering_deadline_date?: string | null;
  is_forfeited?: boolean;
  forfeiture_reason?: string | null;
  refund_status?: string;
  refund_amount?: number;
  villas?: { name: string };
  villa_id?: string;
}

const DEFAULT_MANUAL_CHANNELS: PaymentSetting[] = [
  {
    id: 'gcash',
    provider_name: 'GCash',
    account_name: "Joy's Events & Party Place",
    account_number: '0917-000-0000',
    qr_file_path: null,
    qrUrl: null,
  },
  {
    id: 'visa',
    provider_name: 'Visa / Bank Transfer',
    account_name: "Joy's Events & Party Place",
    account_number: '0000-0000-0000',
    qr_file_path: null,
    qrUrl: null,
  },
];

function mergeManualGateways(dbRows: PaymentSetting[]): PaymentSetting[] {
  const result: PaymentSetting[] = [];
  const usedIds = new Set<string>();

  const gcashMatch = dbRows.find(
    (r) =>
      r.id?.toLowerCase().includes('gcash') ||
      r.provider_name?.toLowerCase().includes('gcash')
  );
  if (gcashMatch) {
    result.push({
      ...gcashMatch,
      provider_name: gcashMatch.provider_name || 'GCash',
    });
    usedIds.add(gcashMatch.id);
  } else {
    result.push(DEFAULT_MANUAL_CHANNELS[0]);
    usedIds.add('gcash');
  }

  const visaOrBankMatch = dbRows.find(
    (r) =>
      !usedIds.has(r.id) &&
      (r.id?.toLowerCase().includes('visa') ||
        r.id?.toLowerCase().includes('bank') ||
        r.id?.toLowerCase().includes('bdo') ||
        r.provider_name?.toLowerCase().includes('visa') ||
        r.provider_name?.toLowerCase().includes('bank') ||
        r.provider_name?.toLowerCase().includes('bdo'))
  );
  if (visaOrBankMatch) {
    const label = visaOrBankMatch.provider_name?.toLowerCase().includes('visa')
      ? visaOrBankMatch.provider_name
      : `Visa / ${visaOrBankMatch.provider_name || 'Bank Transfer'}`;
    result.push({
      ...visaOrBankMatch,
      provider_name: label,
    });
    usedIds.add(visaOrBankMatch.id);
  } else {
    result.push(DEFAULT_MANUAL_CHANNELS[1]);
    usedIds.add('visa');
  }

  for (const row of dbRows) {
    if (!usedIds.has(row.id)) {
      result.push(row);
      usedIds.add(row.id);
    }
  }

  return result;
}

function GuestPortalContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [inputToken, setInputToken] = useState('');
  const [booking, setBooking] = useState<ClientBooking | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [portalNotice, setPortalNotice] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPax, setFormPax] = useState<number>(10);
  const [formPkg, setFormPkg] = useState('with_catering');
  const [formSlot, setFormSlot] = useState('day');
  const [formDate, setFormDate] = useState('');

  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [refNum, setRefNum] = useState('');
  const [accName, setAccName] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('gcash');

  const [liveGateways, setLiveGateways] = useState<PaymentSetting[]>(DEFAULT_MANUAL_CHANNELS);
  const [fetchingGateways, setFetchingGateways] = useState(true);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    id: 'default',
    min_deposit_percent: 50,
    forfeiture_days: 7,
    catering_required_amount: 10000,
    catering_deadline_days: 7,
    catering_auto_action: 'flagged_unpaid',
    admin_alert_phone: null,
    admin_alert_email: null,
  });

  async function lookupByGuestToken(token: string) {
    setLoading(true);
    setIsLocked(false);
    try {
      const cleanToken = token.trim().replace(/^#/, '').toUpperCase();
      const res = await fetch('/api/booking/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lookup',
          guestId: cleanToken,
        }),
      });

      const payload = await res.json().catch(() => null);

      if (res.ok && payload?.booking) {
        const record = payload.booking as ClientBooking;
        setBooking(record);
        setFormName(record.customer_name);
        setFormPhone(record.customer_phone);
        setFormEmail(record.email || '');
        setFormPax(record.pax_count);
        setFormPkg(record.package_option);
        setFormSlot(record.slot_assignment);
        setFormDate(record.event_date);
        setPaymentAmount(String(record.remaining_balance || 0));

        if (
          ['completed', 'archived', 'cancelled', 'rejected'].includes(
            record.status.toLowerCase()
          )
        ) {
          setIsLocked(true);
        }
      } else {
        alert(
          payload?.error ||
            'No booking found with that Booking Code. Please double-check your code.'
        );
      }
    } catch (err) {
      console.error(err);
      alert('Could not look up your booking right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function initPortal() {
      try {
        const [{ data: gates }, settingsRes] = await Promise.all([
          supabase.from('payment_settings').select('*').order('id'),
          fetch('/api/system-settings'),
        ]);

        const mapped = (gates || []).map((gate) => {
          let fullUrl: string | null = null;
          if (gate.qr_file_path) {
            const { data: res } = supabase.storage
              .from('booking-attachments')
              .getPublicUrl(gate.qr_file_path);
            fullUrl = res?.publicUrl || null;
          }
          return { ...gate, qrUrl: fullUrl };
        });

        const merged = mergeManualGateways(mapped);
        setLiveGateways(merged);
        if (merged.length > 0) {
          setSelectedChannel(merged[0].id);
        }

        if (settingsRes.ok) {
          const sJson = await settingsRes.json();
          if (sJson?.settings) setSystemSettings(sJson.settings);
        }

        const initialGuestId = searchParams.get('guest_id');
        if (initialGuestId) {
          setInputToken(initialGuestId);
          await lookupByGuestToken(initialGuestId);
        }
      } catch (err) {
        console.error('Failed to initialize guest portal:', err);
      } finally {
        setFetchingGateways(false);
      }
    }
    initPortal();
  }, []);

  const activeGateway = useMemo(
    () => liveGateways.find((gate) => gate.id === selectedChannel) || liveGateways[0],
    [liveGateways, selectedChannel]
  );

  const handleVerifyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) return;
    await lookupByGuestToken(inputToken);
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || isLocked) return;
    setLoading(true);
    setPortalNotice(null);

    try {
      const res = await fetch('/api/booking/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_request',
          bookingId: booking.id,
          guestId: booking.guest_id,
          villaId: booking.villa_id,
          customerName: formName.trim(),
          customerPhone: formPhone.trim(),
          email: formEmail.trim() || null,
          eventDate: formDate,
          slotAssignment: formSlot === 'day' ? 'day' : 'evening',
          paxCount: Number(formPax),
          packageOption: formPkg,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || 'Could not submit your changes right now.');
      }

      setPortalNotice(
        'Your change request has been sent for Admin approval! Your booking details will update once approved by our team.'
      );
      alert(
        'Your change request has been sent! Our team will review and approve your changes in the Booking History before they take effect.'
      );
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Could not submit your changes right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInstallmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(paymentAmount || 0);
    if (!booking || isLocked || amt <= 0 || !refNum.trim() || !accName.trim()) {
      alert('Please fill in the payment amount, reference number, and sender name.');
      return;
    }

    const fileInput = document.getElementById('receipt-file-picker') as HTMLInputElement;
    if (!fileInput?.files || fileInput.files.length === 0) {
      alert('Please attach a screenshot of your payment receipt.');
      return;
    }

    setUploading(true);
    setPortalNotice(null);
    const file = fileInput.files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `receipts/installment-${booking.id}-${Date.now().toString().slice(-4)}.${fileExt}`;

    const resolvedChannelLabel = activeGateway?.provider_name?.toLowerCase().includes('gcash')
      ? 'gcash'
      : activeGateway?.provider_name?.toLowerCase().includes('visa')
      ? 'visa'
      : selectedChannel;

    try {
      const { error: uploadError } = await supabase.storage
        .from('booking-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const res = await fetch('/api/booking/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manual_installment',
          bookingId: booking.id,
          guestId: booking.guest_id,
          channel: resolvedChannelLabel,
          amount: amt,
          accountName: accName.trim(),
          referenceNumber: refNum.trim(),
          receiptFilePath: filePath,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to submit your payment.');
      }

      setRefNum('');
      fileInput.value = '';
      setPortalNotice(
        `Your follow-up payment of ${formatCurrency(amt)} via ${
          activeGateway?.provider_name || resolvedChannelLabel.toUpperCase()
        } has been submitted! It will reflect on your balance once approved by the Admin.`
      );
      alert(
        'Follow-up payment submitted! Your balance will be updated once our team verifies and approves your receipt.'
      );
      await lookupByGuestToken(booking.guest_id);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to submit your payment. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleInitiateCancellation = async () => {
    if (!booking || isLocked) return;

    const forfeitureDays = Number(systemSettings.forfeiture_days || 7);
    const stayDate = new Date(`${booking.event_date}T00:00:00Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const differenceInDays = Math.ceil(
      (stayDate.getTime() - today.getTime()) / (1000 * 3600 * 24)
    );

    const isForfeitedNow = differenceInDays <= forfeitureDays;
    const policyNote = isForfeitedNow
      ? `FORFEITURE WARNING: Your booking is in ${differenceInDays} day(s), which is within our ${forfeitureDays}-day forfeiture window. Cancelling now will FORFEIT your payment (${formatCurrency(
          booking.amount_paid
        )}) with NO refund allowed.\n\n`
      : `Your stay is in ${differenceInDays} days (outside the ${forfeitureDays}-day forfeiture window).\n\n`;

    if (
      !confirm(`${policyNote}Are you sure you want to request a cancellation for this booking?`)
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/booking/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancellation_request',
          bookingId: booking.id,
          guestId: booking.guest_id,
          summary: `Requested booking cancellation (${differenceInDays} days before stay; forfeiture threshold: ${forfeitureDays} days)`,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || 'Could not submit your cancellation request.');
      }

      alert('Your cancellation request has been sent to our team for review.');
      await lookupByGuestToken(booking.guest_id);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Could not submit your cancellation request.');
    } finally {
      setLoading(false);
    }
  };

  if (booking && isLocked) {
    return (
      <main className="max-w-md mx-auto px-0 py-12 font-sans space-y-6 text-center animate-fadeIn">
        <div className="neu-card p-8 space-y-5">
          <div className="h-14 w-14 rounded-full bg-red-600/10 text-red-600 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-black text-gray-900 dark:text-gray-100">Booking Closed</h2>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed max-w-xs mx-auto">
              Booking{' '}
              <span className="font-mono font-bold text-gray-900 dark:text-gray-100">
                #{booking.guest_id}
              </span>{' '}
              is marked as{' '}
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {formatStatusLabel(booking.status)}
              </span>
              .
            </p>
          </div>
          <div className="p-4 neu-inset text-xs text-gray-600 dark:text-gray-300 text-left space-y-1.5">
            <p>
              <strong>Guest:</strong> {booking.customer_name}
            </p>
            <p>
              <strong>Date:</strong> {booking.event_date}
            </p>
            <p>
              <strong>Status:</strong> {formatStatusLabel(booking.status)}
            </p>
            {booking.refund_status && booking.refund_status !== 'none' && (
              <p>
                <strong>Refund Status:</strong>{' '}
                <span className="uppercase font-bold text-emerald-700">
                  {booking.refund_status} ({formatCurrency(booking.refund_amount || 0)})
                </span>
              </p>
            )}
            {booking.is_forfeited && booking.forfeiture_reason && (
              <p className="text-red-600 font-semibold pt-1">{booking.forfeiture_reason}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setBooking(null);
              setIsLocked(false);
              setInputToken('');
            }}
            className="neu-btn-primary w-full font-bold py-3 text-xs"
          >
            Check Another Booking
          </button>
        </div>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="max-w-md mx-auto px-0 py-12 font-sans space-y-6 animate-fadeIn">
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-full bg-emerald-600/10 flex items-center justify-center text-emerald-600 mx-auto">
            <Key className="w-6 h-6" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 pt-2">
            Manage your booking
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 max-w-sm mx-auto leading-relaxed">
            Enter your Booking Reference Code (e.g. <strong>JOY-XXXXXX</strong>) from your SMS or
            email receipt.
          </p>
        </div>

        <form onSubmit={handleVerifyToken} className="neu-card p-6 sm:p-8 space-y-5">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              required
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              placeholder="e.g. JOY-738912"
              className="neu-input w-full pl-10 pr-4 py-3.5 text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-wider uppercase placeholder:normal-case placeholder:font-normal placeholder:tracking-normal"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="neu-btn-primary w-full font-bold py-3.5 text-xs"
          >
            {loading ? 'Looking Up Booking...' : 'Find My Booking'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-2 sm:px-4 py-8 font-sans space-y-6 animate-fadeIn">
      {portalNotice && (
        <div className="neu-card-sm p-4 text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-between gap-3">
          <span>{portalNotice}</span>
          <button
            type="button"
            onClick={() => setPortalNotice(null)}
            className="neu-btn px-2.5 py-1 text-gray-600 dark:text-gray-300 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="neu-card-sm p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 neu-inset-sm px-3 py-1 font-mono inline-block mb-1">
            Reference Code: #{booking.guest_id}
          </span>
          <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100">
            {booking.villas?.name || 'Your Reservation'}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setBooking(null)}
          className="neu-btn text-xs font-bold px-4 py-2.5 self-start sm:self-center"
        >
          Switch Booking
        </button>
      </div>

      {/* Catering Deadline Rule Status Banner */}
      {booking.package_option === 'with_catering' && (
        <div
          className={`neu-card-sm p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            booking.catering_status === 'confirmed'
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-amber-700 dark:text-amber-400'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-extrabold">
                All-In Catering Status:{' '}
                <span className="uppercase">{booking.catering_status || 'pending_payment'}</span>
              </p>
              <p className="text-gray-600 dark:text-gray-300 mt-0.5">
                Required Catering Payment:{' '}
                <strong>
                  {formatCurrency(
                    booking.catering_required_amount || systemSettings.catering_required_amount
                  )}
                </strong>{' '}
                due by <strong>{booking.catering_deadline_date || '1 week before event'}</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
        {/* Left: Edit Details & Cancel */}
        <div className="space-y-6">
          <div className="neu-card p-6 sm:p-7 space-y-5">
            <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-3">
              <FileText className="w-4 h-4 text-emerald-600" /> Request Booking Changes
            </h3>

            <form onSubmit={handleSaveChanges} className="grid gap-4 sm:grid-cols-2 text-xs">
              <div className="sm:col-span-2 p-3.5 neu-inset-sm text-gray-600 dark:text-gray-300 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Any detail, schedule, or guest changes you request here will be reviewed and
                  approved by the Admin before reflecting on your booking.
                </span>
              </div>

              <FloatingInput
                label="Guest Full Name"
                value={formName}
                onChange={setFormName}
                required
              />

              <FloatingInput
                label="Email Address (Optional)"
                type="email"
                value={formEmail}
                onChange={setFormEmail}
              />

              <div className="sm:col-span-2">
                <PhoneInput label="Mobile Phone" value={formPhone} onChange={setFormPhone} required />
              </div>

              <div>
                <label className="block text-gray-900 dark:text-gray-100 font-bold mb-1.5">
                  Reservation Date
                </label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="neu-input w-full px-3.5 py-2.5 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-gray-900 dark:text-gray-100 font-bold mb-1.5">
                  Time Slot
                </label>
                <select
                  value={formSlot}
                  onChange={(e) => setFormSlot(e.target.value)}
                  className="neu-input w-full px-3.5 py-2.5 text-sm font-semibold"
                >
                  <option value="day">Daytime (8:00 AM – 5:00 PM)</option>
                  <option value="evening">Evening (6:00 PM – 7:00 AM)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-900 dark:text-gray-100 font-bold mb-1.5">
                  Package
                </label>
                <select
                  value={formPkg}
                  onChange={(e) => setFormPkg(e.target.value)}
                  className="neu-input w-full px-3.5 py-2.5 text-sm font-semibold"
                >
                  <option value="with_catering">With Catering</option>
                  <option value="venue_only">Venue Only</option>
                  <option value="accommodation_only">Overnight Stay</option>
                </select>
              </div>

              <FloatingInput
                label="Total Guests (Pax)"
                value={formPax}
                numericOnly
                onChange={(val) => setFormPax(Math.max(1, Number(val || 1)))}
                required
              />

              <div className="sm:col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="neu-btn-primary font-bold px-6 py-3 text-xs"
                >
                  {loading ? 'Sending Request...' : 'Submit Change Request'}
                </button>
              </div>
            </form>
          </div>

          <div className="neu-card p-6 sm:p-7 space-y-4">
            <h3 className="text-base font-extrabold text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" /> Cancel Reservation
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              <strong>{systemSettings.forfeiture_days}-Day Forfeiture Policy:</strong> If you cancel
              within <strong>{systemSettings.forfeiture_days} days</strong> of your scheduled event
              date, your payment is forfeited and no refund is allowed.
            </p>
            <button
              type="button"
              onClick={handleInitiateCancellation}
              className="neu-btn text-red-600 font-extrabold px-5 py-2.5 text-xs"
            >
              Request Cancellation
            </button>
          </div>
        </div>

        {/* Right: Payment Summary & Follow-Up / Balance Payment */}
        <div className="space-y-6">
          <div className="neu-card p-6 sm:p-8 space-y-5">
            <div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                Invoice &amp; Payment Status
              </span>
              <h4 className="text-lg font-extrabold text-gray-900 dark:text-gray-100 mt-0.5">
                {formatPackageLabel(booking.package_option)}
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                Status:{' '}
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatStatusLabel(booking.status)}
                </span>{' '}
                • Method:{' '}
                <span className="uppercase font-bold">
                  {booking.payment_channel || booking.payment_gateway || 'manual'}
                </span>
              </p>
            </div>

            <div className="neu-inset p-4 space-y-2.5 font-mono text-xs">
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>Total Price:</span>
                <span className="font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(booking.total_price, true)}
                </span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>Amount Paid:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(booking.amount_paid, true)}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-2.5 text-sm">
                <span className="font-bold text-gray-900 dark:text-gray-100">
                  Remaining Balance:
                </span>
                <span className="font-black text-amber-600 dark:text-amber-400">
                  {formatCurrency(booking.remaining_balance, true)}
                </span>
              </div>
            </div>
          </div>

          {booking.remaining_balance > 0 ? (
            <div className="neu-card p-6 space-y-5">
              <div>
                <h4 className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                  Submit Follow-Up / Balance Payment
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                  Choose GCash or Visa / Bank Transfer and upload your payment receipt for Admin
                  approval:
                </p>
              </div>

              {/* Payment Method Selector: GCash & Visa / Bank Transfer */}
              <div className="grid grid-cols-2 gap-2 p-1.5 neu-inset text-xs font-bold">
                {liveGateways.map((g) => {
                  const isGcash = g.provider_name?.toLowerCase().includes('gcash');
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedChannel(g.id)}
                      className={`py-2 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        selectedChannel === g.id
                          ? 'neu-btn-primary'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {isGcash ? (
                        <Smartphone className="w-3.5 h-3.5" />
                      ) : (
                        <CreditCard className="w-3.5 h-3.5" />
                      )}
                      <span>{g.provider_name}</span>
                    </button>
                  );
                })}
              </div>

              <FloatingInput
                label={`Amount to Pay Now (Max ${formatCurrency(booking.remaining_balance)})`}
                value={paymentAmount}
                numericOnly
                allowDecimal
                zeroAsEmpty
                onChange={setPaymentAmount}
              />

              <form onSubmit={handleInstallmentSubmit} className="space-y-3.5 text-xs">
                {!fetchingGateways && activeGateway && (
                  <div className="neu-inset p-4 text-center space-y-2">
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 uppercase text-xs">
                      {activeGateway.provider_name}
                    </p>
                    {activeGateway.qrUrl && (
                      <div className="w-36 h-36 mx-auto bg-white rounded-md p-2 border border-gray-200">
                        <img
                          src={activeGateway.qrUrl}
                          alt={activeGateway.provider_name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    <p className="text-gray-900 dark:text-gray-100 font-bold">
                      {activeGateway.account_name}
                    </p>
                    <p className="text-gray-600 dark:text-gray-300 font-mono font-bold select-all">
                      {activeGateway.account_number}
                    </p>
                  </div>
                )}

                <FloatingInput
                  label="Sender Account Name"
                  value={accName}
                  onChange={setAccName}
                  required
                />

                <FloatingInput
                  label="Receipt Reference Number"
                  value={refNum}
                  onChange={(v) => setRefNum(v.replace(/\s+/g, ''))}
                  required
                />

                <div>
                  <label className="block mb-1.5 text-gray-900 dark:text-gray-100 font-bold">
                    Upload Receipt Screenshot *
                  </label>
                  <input
                    id="receipt-file-picker"
                    type="file"
                    required
                    accept="image/*"
                    className="w-full text-xs text-gray-600 dark:text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  disabled={uploading || Number(paymentAmount || 0) <= 0}
                  className="neu-btn-primary w-full font-bold py-3 text-xs"
                >
                  {uploading ? 'Uploading Receipt...' : 'Submit Follow-Up Payment for Approval'}
                </button>
              </form>
            </div>
          ) : (
            <div className="neu-card p-6 text-center space-y-2 animate-fadeIn">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-wide text-xs">
                Fully Paid
              </p>
              <p className="text-gray-600 dark:text-gray-300 text-xs leading-normal max-w-xs mx-auto">
                Your booking is completely paid. We look forward to hosting you!
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function GuestPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto px-4 py-16 space-y-4">
          <SkeletonBox className="h-14 w-14 mx-auto rounded-md" />
          <SkeletonBox className="h-8 w-56 mx-auto" />
          <SkeletonBox className="h-36 w-full rounded-lg" />
        </div>
      }
    >
      <GuestPortalContent />
    </Suspense>
  );
}