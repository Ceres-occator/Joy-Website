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
  ShieldCheck,
  QrCode,
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

function GuestPortalContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [inputToken, setInputToken] = useState('');
  const [booking, setBooking] = useState<ClientBooking | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [paymongoBanner, setPaymongoBanner] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPax, setFormPax] = useState<number>(10);
  const [formPkg, setFormPkg] = useState('with_catering');
  const [formSlot, setFormSlot] = useState('day');
  const [formDate, setFormDate] = useState('');

  const [balanceGateway, setBalanceGateway] = useState<'paymongo' | 'manual'>('paymongo');
  const [paymongoChannel, setPaymongoChannel] = useState<
    'chinabank' | 'qrph' | 'gcash' | 'paymaya' | 'card'
  >('chinabank');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [refNum, setRefNum] = useState('');
  const [accName, setAccName] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('gcash');

  const [liveGateways, setLiveGateways] = useState<PaymentSetting[]>([]);
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
      const { data, error } = await supabase
        .from('bookings')
        .select(
          'id, guest_id, customer_name, customer_phone, email, event_date, end_date, total_price, amount_paid, remaining_balance, status, package_option, pax_count, slot_assignment, payment_gateway, payment_channel, catering_status, catering_required_amount, catering_deadline_date, is_forfeited, forfeiture_reason, refund_status, refund_amount, villas(name), villa_id'
        )
        .eq('guest_id', cleanToken)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const record = data as unknown as ClientBooking;
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
        alert('No booking found with that Booking Code. Please double-check your code.');
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

        if (gates && gates.length > 0) {
          const mapped = gates.map((gate) => {
            let fullUrl: string | null = null;
            if (gate.qr_file_path) {
              const { data: res } = supabase.storage
                .from('booking-attachments')
                .getPublicUrl(gate.qr_file_path);
              fullUrl = res?.publicUrl || null;
            }
            return { ...gate, qrUrl: fullUrl };
          });
          setLiveGateways(mapped);
          setSelectedChannel(mapped[0].id);
        }

        if (settingsRes.ok) {
          const sJson = await settingsRes.json();
          if (sJson?.settings) setSystemSettings(sJson.settings);
        }

        // Check if returning from PayMongo checkout redirect
        const pmStatus = searchParams.get('paymongo_status');
        const pmBookingId = searchParams.get('booking_id');
        const pmGuestId = searchParams.get('guest_id');

        if (pmBookingId && pmStatus === 'success') {
          await fetch('/api/paymongo/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: pmBookingId }),
          });
          setPaymongoBanner(
            'Your PayMongo online payment was received! We also sent your official receipt via SMS and Email.'
          );
        } else if (pmStatus === 'cancelled') {
          setPaymongoBanner(
            'Your PayMongo checkout was cancelled. You can complete your payment below anytime.'
          );
        }

        if (pmGuestId) {
          setInputToken(pmGuestId);
          await lookupByGuestToken(pmGuestId);
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

    try {
      if (formDate !== booking.event_date || formSlot !== booking.slot_assignment) {
        const { data: conflicts, error: checkError } = await supabase
          .from('bookings')
          .select('id, slot_assignment, package_option')
          .eq('villa_id', booking.villa_id)
          .eq('event_date', formDate)
          .neq('id', booking.id)
          .in('status', ['pending_verification', 'confirmed']);

        if (checkError) throw checkError;

        if (conflicts && conflicts.length > 0) {
          const isTargetAccommodation = formPkg === 'accommodation_only';
          const hitOverlapConflict = conflicts.some(
            (c) =>
              isTargetAccommodation ||
              c.package_option === 'accommodation_only' ||
              c.slot_assignment === formSlot
          );

          if (hitOverlapConflict) {
            alert(
              'Sorry, that date and time slot is already booked. Please pick another date or time slot.'
            );
            setLoading(false);
            return;
          }
        }
      }

      const { error: approvalError } = await supabase.from('booking_changes_approval').insert([
        {
          booking_id: booking.id,
          proposed_changes: {
            after: {
              customer_name: formName,
              customer_phone: formPhone,
              email: formEmail.trim() || null,
              event_date: formDate,
              slot_assignment: formSlot,
              pax_count: Number(formPax),
              package_option: formPkg,
            },
          },
          status: 'pending',
        },
      ]);

      if (approvalError) throw approvalError;

      await supabase.from('booking_audit_history').insert([
        {
          booking_id: booking.id,
          type: 'data_edit',
          status: 'pending_approval',
          summary: `Requested changes: Name (${formName}), Date (${formDate}), Slot (${formSlot}), Guests (${formPax})`,
        },
      ]);

      alert(
        'Your change request has been sent! Our team will review and update your booking shortly.'
      );
    } catch (err) {
      console.error(err);
      alert('Could not submit your changes right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymongoFollowUp = async () => {
    const amt = Number(paymentAmount || 0);
    if (!booking || amt <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    setUploading(true);
    try {
      const isCateringPhase =
        booking.package_option === 'with_catering' &&
        booking.catering_status !== 'confirmed';

      const res = await fetch('/api/paymongo/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          amount: amt,
          phase: isCateringPhase ? 'catering_payment' : 'balance_settlement',
          preferredChannel: paymongoChannel,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.checkoutUrl) {
        throw new Error(data?.error || 'Could not start PayMongo checkout.');
      }
      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      alert(err.message);
      setUploading(false);
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
    const file = fileInput.files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `receipts/installment-${booking.id}-${Date.now().toString().slice(-4)}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('booking-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'pending_verification', updated_at: new Date().toISOString() })
        .eq('id', booking.id);

      if (updateError) throw updateError;

      await supabase.from('payment_transactions').insert([
        {
          booking_id: booking.id,
          phase: 'follow_up',
          payment_gateway: 'manual',
          payment_channel: selectedChannel,
          amount: amt,
          account_name: accName.trim(),
          reference_number: refNum.trim(),
          receipt_file_path: filePath,
          status: 'pending',
          notes: 'Follow-up / balance payment submitted by guest',
        },
      ]);

      await supabase.from('booking_audit_history').insert([
        {
          booking_id: booking.id,
          type: 'payment_installment',
          amount_paid: amt,
          reference_number: refNum.trim(),
          account_name: accName.trim(),
          receipt_file_path: filePath,
          status: 'pending_approval',
          summary: `Submitted a follow-up payment of ${formatCurrency(amt)}`,
        },
      ]);

      alert(
        'Payment submitted! Your balance will be updated once our team verifies your receipt.'
      );
      await lookupByGuestToken(booking.guest_id);
    } catch (err) {
      console.error(err);
      alert('Failed to submit your payment. Please try again.');
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
      const { error: approvalError } = await supabase.from('booking_changes_approval').insert([
        {
          booking_id: booking.id,
          proposed_changes: {
            after: {
              status: 'cancelled_request_pending',
            },
          },
          status: 'pending',
        },
      ]);

      if (approvalError) throw approvalError;

      await supabase.from('booking_audit_history').insert([
        {
          booking_id: booking.id,
          type: 'cancellation_request',
          status: 'pending_approval',
          summary: `Requested booking cancellation (${differenceInDays} days before stay; forfeiture threshold: ${forfeitureDays} days)`,
        },
      ]);

      alert('Your cancellation request has been sent to our team for review.');
      await lookupByGuestToken(booking.guest_id);
    } catch (err) {
      console.error(err);
      alert('Could not submit your cancellation request.');
    } finally {
      setLoading(false);
    }
  };

  if (booking && isLocked) {
    return (
      <main className="max-w-md mx-auto px-4 py-16 font-sans space-y-6 text-center animate-fadeIn">
        <div className="neu-card p-8 space-y-5">
          <div className="h-16 w-16 neu-inset text-red-600 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-black text-slate-800">Booking Closed</h2>
            <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
              Booking <span className="font-mono font-bold text-slate-800">#{booking.guest_id}</span>{' '}
              is marked as{' '}
              <span className="font-bold text-slate-800">
                {formatStatusLabel(booking.status)}
              </span>
              .
            </p>
          </div>
          <div className="p-4 neu-inset text-xs text-slate-600 text-left space-y-1.5">
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
            className="neu-btn-primary w-full font-bold py-3 text-xs uppercase tracking-wider"
          >
            Check Another Booking
          </button>
        </div>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="max-w-md mx-auto px-4 py-16 font-sans space-y-6 animate-fadeIn">
        <div className="text-center space-y-2">
          <div className="h-14 w-14 neu-card-sm flex items-center justify-center text-emerald-600 mx-auto">
            <Key className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 pt-1">Manage Your Booking</h2>
          <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
            Enter your Booking Reference Code (e.g. <strong>GUEST-XXXXXX</strong>) from your SMS or
            email receipt.
          </p>
        </div>

        <form onSubmit={handleVerifyToken} className="neu-card p-6 space-y-4">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              required
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              placeholder="e.g. GUEST-73B91A"
              className="neu-input w-full pl-10 pr-4 py-3.5 text-sm font-black text-slate-800 tracking-wider uppercase placeholder:normal-case placeholder:font-normal"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="neu-btn-primary w-full font-bold py-3.5 text-xs uppercase tracking-wider"
          >
            {loading ? 'Looking Up Booking...' : 'Find My Booking'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-2 sm:px-4 py-8 font-sans space-y-6 animate-fadeIn">
      {paymongoBanner && (
        <div className="neu-card-sm p-4 text-xs font-bold text-emerald-800 flex items-center justify-between">
          <span>{paymongoBanner}</span>
          <button
            type="button"
            onClick={() => setPaymongoBanner(null)}
            className="neu-btn px-2.5 py-1 text-slate-500"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="neu-card-sm p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <span className="text-xs font-bold text-emerald-700 neu-inset-sm px-3 py-1 font-mono inline-block mb-1">
            Reference Code: #{booking.guest_id}
          </span>
          <h2 className="text-2xl font-black text-slate-800">
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
              ? 'text-emerald-800'
              : 'text-amber-800'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-extrabold">
                All-In Catering Status:{' '}
                <span className="uppercase">{booking.catering_status || 'pending_payment'}</span>
              </p>
              <p className="text-slate-600 mt-0.5">
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
            <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2 border-b border-slate-300/60 pb-3">
              <FileText className="w-4 h-4 text-emerald-600" /> Request Booking Changes
            </h3>

            <form onSubmit={handleSaveChanges} className="grid gap-4 sm:grid-cols-2 text-xs">
              <div className="sm:col-span-2 p-3.5 neu-inset-sm text-slate-600 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Any schedule or guest changes you request here will be reviewed by our team before
                  taking effect.
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
                <label className="block text-slate-700 font-bold mb-1.5">Reservation Date</label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="neu-input w-full px-3.5 py-2.5 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Time Slot</label>
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
                <label className="block text-slate-700 font-bold mb-1.5">Package</label>
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
                  className="neu-btn-primary font-bold px-6 py-3 text-xs uppercase tracking-wider"
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
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>{systemSettings.forfeiture_days}-Day Forfeiture Policy:</strong> If you cancel
              within <strong>{systemSettings.forfeiture_days} days</strong> of your scheduled event
              date, your payment is forfeited and no refund is allowed.
            </p>
            <button
              type="button"
              onClick={handleInitiateCancellation}
              className="neu-btn text-red-600 font-extrabold px-5 py-2.5 text-xs uppercase tracking-wider"
            >
              Request Cancellation
            </button>
          </div>
        </div>

        {/* Right: Payment Summary & Follow-Up / Balance Payment */}
        <div className="space-y-6">
          <div className="neu-card p-6 space-y-4">
            <div>
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                Invoice &amp; Payment Status
              </span>
              <h4 className="text-lg font-extrabold text-slate-800 mt-0.5">
                {formatPackageLabel(booking.package_option)}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Status:{' '}
                <span className="font-bold text-emerald-700">
                  {formatStatusLabel(booking.status)}
                </span>{' '}
                • Gateway: <span className="uppercase font-bold">{booking.payment_gateway || 'manual'}</span>
              </p>
            </div>

            <div className="neu-inset p-4 space-y-2.5 font-mono text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Total Price:</span>
                <span className="font-bold text-slate-800">
                  {formatCurrency(booking.total_price, true)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Amount Paid:</span>
                <span className="font-bold text-emerald-600">
                  {formatCurrency(booking.amount_paid, true)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-300/60 pt-2.5 text-sm">
                <span className="font-bold text-slate-800">Remaining Balance:</span>
                <span className="font-black text-amber-700">
                  {formatCurrency(booking.remaining_balance, true)}
                </span>
              </div>
            </div>
          </div>

          {booking.remaining_balance > 0 ? (
            <div className="neu-card p-6 space-y-5">
              <div>
                <h4 className="text-sm font-extrabold text-slate-800">
                  Pay Remaining Balance or Catering Deposit
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose PayMongo (Chinabank, QR Ph, GCash, Card) or Manual Receipt Upload:
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 p-1.5 neu-inset text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setBalanceGateway('paymongo')}
                  className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    balanceGateway === 'paymongo' ? 'neu-btn-primary' : 'text-slate-600'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> PayMongo
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceGateway('manual')}
                  className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    balanceGateway === 'manual' ? 'neu-btn-primary' : 'text-slate-600'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" /> Manual Upload
                </button>
              </div>

              <FloatingInput
                label={`Amount to Pay Now (Max ${formatCurrency(booking.remaining_balance)})`}
                value={paymentAmount}
                numericOnly
                allowDecimal
                zeroAsEmpty
                onChange={setPaymentAmount}
              />

              {balanceGateway === 'paymongo' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { id: 'chinabank', label: 'Chinabank' },
                      { id: 'qrph', label: 'QR Ph' },
                      { id: 'gcash', label: 'GCash' },
                      { id: 'paymaya', label: 'Maya' },
                      { id: 'card', label: 'Card' },
                    ].map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setPaymongoChannel(ch.id as any)}
                        className={`py-2 px-2 rounded-xl font-bold ${
                          paymongoChannel === ch.id ? 'neu-btn-primary' : 'neu-btn'
                        }`}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={uploading || Number(paymentAmount || 0) <= 0}
                    onClick={handlePaymongoFollowUp}
                    className="neu-btn-primary w-full py-3.5 text-xs font-bold uppercase tracking-wider"
                  >
                    {uploading
                      ? 'Redirecting to PayMongo...'
                      : `Pay ${formatCurrency(Number(paymentAmount || 0))} via PayMongo`}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleInstallmentSubmit} className="space-y-3.5 text-xs">
                  {activeGateway && (
                    <div className="neu-inset p-3.5 text-center space-y-2">
                      <p className="font-bold text-slate-800">{activeGateway.provider_name}</p>
                      <p className="text-slate-600">
                        {activeGateway.account_name} •{' '}
                        <strong className="font-mono">{activeGateway.account_number}</strong>
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
                    <label className="block mb-1.5 text-slate-700 font-bold">
                      Upload Receipt Screenshot *
                    </label>
                    <input
                      id="receipt-file-picker"
                      type="file"
                      required
                      accept="image/*"
                      className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white cursor-pointer"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={uploading || Number(paymentAmount || 0) <= 0}
                    className="neu-btn-primary w-full font-bold py-3 text-xs uppercase tracking-wider"
                  >
                    {uploading ? 'Uploading Receipt...' : 'Submit Manual Balance Payment'}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="neu-card p-6 text-center space-y-2 animate-fadeIn">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="text-emerald-700 font-black uppercase tracking-wide text-xs">
                Fully Paid
              </p>
              <p className="text-slate-600 text-xs leading-normal max-w-xs mx-auto">
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
          <SkeletonBox className="h-14 w-14 mx-auto rounded-2xl" />
          <SkeletonBox className="h-8 w-56 mx-auto" />
          <SkeletonBox className="h-36 w-full rounded-3xl" />
        </div>
      }
    >
      <GuestPortalContent />
    </Suspense>
  );
}