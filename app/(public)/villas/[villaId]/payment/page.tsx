'use client';

import { Suspense, useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import {
  Key,
  AlertTriangle,
  CreditCard,
  QrCode,
  ShieldCheck,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { formatCurrency } from '@/utils/formatters';
import type { PaymentSetting, SystemSettings } from '@/types';
import FloatingInput from '@/components/ui/FloatingInput';
import { PaymentPageSkeleton, SkeletonBox } from '@/components/ui/Skeleton';

function PaymentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();

  const villaId = params.villaId as string;

  const villaTitle = searchParams.get('villaTitle') || 'Selected Villa';
  const fullName = searchParams.get('fullName') || '';
  const phone = searchParams.get('phone') || '';
  const email = searchParams.get('email') || '';
  const eventDate = searchParams.get('eventDate') || '';
  const timeSlot = searchParams.get('timeSlot') || 'day';
  const totalPrice = Number(searchParams.get('price') || 0);

  const paxCount = searchParams.get('paxCount') || '1';
  const packageOption = searchParams.get('packageOption') || 'accommodation_only';
  const includeOvernight = searchParams.get('includeOvernight') === 'true';
  const overnightPaxCount = Number(searchParams.get('overnightPaxCount') || '0');

  const publicPaymongoKey = process.env.NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY || '';

  const [paymentGateway, setPaymentGateway] = useState<'paymongo' | 'manual'>('paymongo');
  const [paymongoChannel, setPaymongoChannel] = useState<
    'chinabank' | 'qrph' | 'gcash' | 'paymaya' | 'card'
  >('chinabank');

  const [accountName, setAccountName] = useState(fullName);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [paymentMode, setPaymentMode] = useState<'half' | 'full'>('half');
  const [selectedChannel, setSelectedChannel] = useState<string>('gcash');

  const [liveGateways, setLiveGateways] = useState<PaymentSetting[]>([]);
  const [fetchingGateways, setFetchingGateways] = useState(true);
  const [villaMinDepositPercent, setVillaMinDepositPercent] = useState<number>(
    Number(searchParams.get('minDepositPercent') || 50)
  );
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

  const receiptInputRef = useRef<HTMLInputElement>(null);
  const idInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [returnedGuestId, setReturnedGuestId] = useState<string>('');

  const minDepositPercent = Number(villaMinDepositPercent || 50);
  const minDepositAmount = Math.round(totalPrice * (minDepositPercent / 100));
  const computedAmountPaid = paymentMode === 'full' ? totalPrice : minDepositAmount;
  const computedRemainingBalance = Math.max(0, totalPrice - computedAmountPaid);

  const isReferenceValid = useMemo(
    () => referenceNumber.trim().length >= 6,
    [referenceNumber]
  );

  const canSubmitManual =
    accountName.trim().length > 0 &&
    isReferenceValid &&
    receiptFile !== null &&
    idFile !== null &&
    !submitting;

  useEffect(() => {
    async function fetchGatewaysAndSettings() {
      try {
        const supabase = createClient();
        const [{ data: gates }, { data: villaRow }, settingsRes] = await Promise.all([
          supabase.from('payment_settings').select('*').order('id'),
          supabase.from('villas').select('*').eq('id', villaId).maybeSingle(),
          fetch('/api/system-settings'),
        ]);

        if (villaRow && villaRow.min_deposit_percent != null) {
          setVillaMinDepositPercent(Number(villaRow.min_deposit_percent));
        }

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
      } catch (err) {
        console.error(err);
      } finally {
        setFetchingGateways(false);
      }
    }
    fetchGatewaysAndSettings();
  }, [villaId]);

  const activeGateway = useMemo(
    () => liveGateways.find((gate) => gate.id === selectedChannel) || liveGateways[0],
    [liveGateways, selectedChannel]
  );

  const handlePaymongoCheckout = async () => {
    setSubmitting(true);
    setApiError(null);

    try {
      // 1. Create booking record in pending_verification state
      const confirmRes = await fetch('/api/booking/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          villaId,
          fullName,
          phone,
          email: email || null,
          eventDate,
          timeSlot,
          paxCount,
          packageOption,
          totalPrice,
          paymentMode,
          paymentGateway: 'paymongo',
          paymentChannel: paymongoChannel,
          amountPaid: computedAmountPaid,
          remainingBalance: computedRemainingBalance,
          accountName: fullName,
          referenceNumber: `PAYMONGO-${paymongoChannel.toUpperCase()}`,
          includeOvernight,
          overnightPaxCount,
        }),
      });

      const confirmData = await confirmRes.json();
      if (!confirmRes.ok || !confirmData?.booking?.id) {
        throw new Error(confirmData?.error || 'Could not create reservation record.');
      }

      // 2. Create PayMongo Checkout Session
      const pmRes = await fetch('/api/paymongo/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: confirmData.booking.id,
          amount: computedAmountPaid,
          phase: paymentMode === 'full' ? 'full_payment' : 'downpayment',
          preferredChannel: paymongoChannel,
        }),
      });

      const pmData = await pmRes.json();
      if (!pmRes.ok || !pmData?.checkoutUrl) {
        throw new Error(
          pmData?.error ||
            'Could not connect to PayMongo right now. You may use Manual Transfer & Receipt Upload instead.'
        );
      }

      // Redirect customer to PayMongo hosted checkout
      window.location.href = pmData.checkoutUrl;
    } catch (err: any) {
      setApiError(err.message || 'Could not start PayMongo checkout.');
      setSubmitting(false);
    }
  };

  const handleManualVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitManual || !receiptFile || !idFile) return;
    setSubmitting(true);
    setApiError(null);

    try {
      const supabase = createClient();

      const receiptExt = receiptFile.name.split('.').pop();
      const receiptPath = `receipts/receipt_${villaId}_${Date.now()}.${receiptExt}`;
      const { error: rxErr } = await supabase.storage
        .from('booking-attachments')
        .upload(receiptPath, receiptFile);
      if (rxErr) throw new Error(`Could not upload receipt: ${rxErr.message}`);

      const idExt = idFile.name.split('.').pop();
      const idPath = `ids/id_${villaId}_${Date.now()}.${idExt}`;
      const { error: idErr } = await supabase.storage
        .from('booking-attachments')
        .upload(idPath, idFile);
      if (idErr) throw new Error(`Could not upload ID photo: ${idErr.message}`);

      const response = await fetch('/api/booking/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          villaId,
          fullName,
          phone,
          email: email || null,
          eventDate,
          timeSlot,
          paxCount,
          packageOption,
          totalPrice,
          paymentMode,
          paymentGateway: 'manual',
          paymentChannel: selectedChannel,
          amountPaid: computedAmountPaid,
          remainingBalance: computedRemainingBalance,
          referenceNumber,
          accountName,
          receiptFilePath: receiptPath,
          idFilePath: idPath,
          includeOvernight,
          overnightPaxCount,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || `Request failed (${response.status})`);
      }

      if (data?.booking?.guest_id) {
        setReturnedGuestId(data.booking.guest_id);
      }

      setIsSuccess(true);
    } catch (err: any) {
      setApiError(err.message || 'Something went wrong while submitting your booking.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="mx-auto max-w-2xl p-4 mt-6 animate-fadeIn font-sans">
        <div className="neu-card p-8 text-center space-y-6">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full neu-inset text-emerald-600">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-800">Booking Submitted!</h2>
            <p className="text-xs text-slate-500">
              We have sent your complete booking receipt via SMS
              {email ? ` and Email (${email})` : ''}. Our team will verify your payment shortly.
            </p>
          </div>

          <div className="neu-inset p-5 text-left flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider block">
                Your Booking Reference Code (Save This!)
              </span>
              <p className="font-mono text-xl font-black text-emerald-600 tracking-wider select-all">
                {returnedGuestId || 'GENERATING...'}
              </p>
              <p className="text-xs text-slate-600 leading-normal">
                Use this code anytime on the <strong>My Bookings</strong> page to check your
                status, pay your remaining balance via PayMongo or Manual Transfer, or request changes.
              </p>
            </div>
            <div className="h-11 w-11 shrink-0 neu-card-sm flex items-center justify-center text-emerald-600">
              <Key className="w-5 h-5" />
            </div>
          </div>

          <div className="neu-inset p-6 text-left space-y-2.5 text-xs sm:text-sm font-medium">
            <div className="flex justify-between">
              <span className="text-slate-500">Guest Name:</span>
              <span className="text-slate-800 font-bold">{fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Contact:</span>
              <span className="text-slate-800 font-bold">
                {phone}
                {email ? ` • ${email}` : ''}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Venue:</span>
              <span className="text-slate-800 font-bold">{villaTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date &amp; Slot:</span>
              <span className="text-slate-800 font-bold">
                {eventDate} ({timeSlot})
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-300/60 pt-3">
              <span className="text-slate-500">Total Cost:</span>
              <span className="text-slate-800 font-mono font-bold">
                {formatCurrency(totalPrice)}
              </span>
            </div>
            <div className="flex justify-between text-emerald-700 font-bold">
              <span>Amount Submitted:</span>
              <span className="font-mono">{formatCurrency(computedAmountPaid)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-300/60 text-amber-700 font-bold">
              <span>Remaining Balance:</span>
              <span className="font-mono">{formatCurrency(computedRemainingBalance)}</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => router.push('/my-bookings')}
              className="neu-btn py-3.5 text-xs font-bold uppercase tracking-wider"
            >
              Go to My Bookings
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="neu-btn-primary py-3.5 text-xs font-bold uppercase tracking-wider"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl w-full p-2 sm:p-6 mt-2 animate-fadeIn font-sans">
      <div className="neu-card p-6 md:p-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-300/60 pb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-emerald-700 font-bold">
              Step 3 • Checkout &amp; Payment
            </p>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800">
              Complete Your Reservation
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {villaTitle} • {eventDate} • {paxCount} Guests
            </p>
          </div>

          <div className="neu-inset px-5 py-3 text-right">
            <span className="text-[11px] font-bold uppercase text-slate-500 block">
              Amount Due Now
            </span>
            <span className="text-emerald-700 text-2xl font-black font-mono">
              {formatCurrency(computedAmountPaid)}
            </span>
          </div>
        </div>

        {/* Payment Plan & Gateway Mode Selector */}
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-600">
              1. Choose Payment Amount
            </label>
            <div className="grid grid-cols-2 gap-2 p-1.5 neu-inset">
              <button
                type="button"
                onClick={() => setPaymentMode('half')}
                className={`py-2.5 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  paymentMode === 'half' ? 'neu-btn-primary' : 'text-slate-600'
                }`}
              >
                {minDepositPercent}% Deposit ({formatCurrency(minDepositAmount)})
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode('full')}
                className={`py-2.5 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  paymentMode === 'full' ? 'neu-btn-primary' : 'text-slate-600'
                }`}
              >
                100% Full ({formatCurrency(totalPrice)})
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-600">
              2. Choose Checkout Gateway
            </label>
            <div className="grid grid-cols-2 gap-2 p-1.5 neu-inset">
              <button
                type="button"
                onClick={() => setPaymentGateway('paymongo')}
                className={`py-2.5 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  paymentGateway === 'paymongo' ? 'neu-btn-primary' : 'text-slate-600'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" /> PayMongo (Chinabank / QR)
              </button>
              <button
                type="button"
                onClick={() => setPaymentGateway('manual')}
                className={`py-2.5 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  paymentGateway === 'manual' ? 'neu-btn-primary' : 'text-slate-600'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" /> Manual Receipt Upload
              </button>
            </div>
          </div>
        </div>

        {/* Catering & Forfeiture Policy Banner */}
        <div className="neu-inset-sm p-4 text-xs text-slate-600 grid sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800 block">
                {systemSettings.forfeiture_days}-Day Cancellation Forfeiture Policy
              </strong>
              <span>
                Cancelling within {systemSettings.forfeiture_days} days of your scheduled date
                forfeits your payment with no refund.
              </span>
            </div>
          </div>
          {packageOption === 'with_catering' && (
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-800 block">Catering Payment Rule</strong>
                <span>
                  At least {formatCurrency(systemSettings.catering_required_amount)} must be settled
                  1 week ({systemSettings.catering_deadline_days} days) before your event.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================
            OPTION A: PAYMONGO ONLINE CHECKOUT (CHINABANK, QR PH, E-WALLETS)
           ============================================================ */}
        {paymentGateway === 'paymongo' ? (
          <div className="neu-inset p-6 sm:p-8 space-y-6 animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300/60 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Instant Online Payment via PayMongo
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automatic verification &amp; instant SMS/Email receipt—supports Chinabank, QR Ph,
                  GCash, Maya, and Cards.
                </p>
              </div>
              {publicPaymongoKey && (
                <span className="neu-card-sm px-3 py-1 text-[10px] font-mono font-bold text-emerald-700">
                  PayMongo Active ({publicPaymongoKey.slice(0, 10)}...)
                </span>
              )}
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Select Your Preferred Bank or E-Wallet Channel:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  {
                    id: 'chinabank',
                    title: 'Chinabank',
                    sub: 'Online / QR Ph / Card',
                    badge: 'Chinabank',
                  },
                  {
                    id: 'qrph',
                    title: 'QR Ph',
                    sub: 'All PH Banks & InstaPay',
                    badge: 'QR Ph',
                  },
                  {
                    id: 'gcash',
                    title: 'GCash',
                    sub: 'Instant E-Wallet',
                    badge: 'GCash',
                  },
                  {
                    id: 'paymaya',
                    title: 'Maya',
                    sub: 'Maya Wallet',
                    badge: 'Maya',
                  },
                  {
                    id: 'card',
                    title: 'Debit / Credit',
                    sub: 'Visa & Mastercard',
                    badge: 'Card',
                  },
                ].map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setPaymongoChannel(ch.id as any)}
                    className={`p-3.5 rounded-2xl text-left transition-all flex flex-col justify-between ${
                      paymongoChannel === ch.id
                        ? 'neu-btn-primary'
                        : 'neu-card-sm hover:-translate-y-0.5'
                    }`}
                  >
                    <span className="text-xs font-extrabold block">{ch.badge}</span>
                    <span
                      className={`text-[10px] mt-1 block ${
                        paymongoChannel === ch.id ? 'text-emerald-50' : 'text-slate-500'
                      }`}
                    >
                      {ch.sub}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="neu-card-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  Paying with Chinabank?
                </p>
                <p className="text-slate-500">
                  On the PayMongo checkout screen, you can scan the{' '}
                  <strong>QR Ph code using your Chinabank Mobile App</strong>, use your{' '}
                  <strong>Chinabank Debit/Credit Card</strong>, or select Direct Online Banking.
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Remaining Balance After Payment
                </span>
                <span className="font-mono font-extrabold text-sm text-slate-800">
                  {formatCurrency(computedRemainingBalance)}
                </span>
              </div>
            </div>

            {apiError && (
              <div className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 p-3.5 rounded-xl">
                {apiError}
              </div>
            )}

            <button
              type="button"
              disabled={submitting}
              onClick={handlePaymongoCheckout}
              className="neu-btn-primary w-full py-4 text-xs sm:text-sm font-extrabold uppercase tracking-wider"
            >
              {submitting
                ? 'Redirecting to Secure PayMongo Checkout...'
                : `Pay ${formatCurrency(computedAmountPaid)} via PayMongo (${paymongoChannel.toUpperCase()})`}
            </button>
          </div>
        ) : (
          /* ============================================================
             OPTION B: MANUAL TRANSFER FALLBACK (QR + RECEIPT & ID UPLOAD)
            ============================================================ */
          <div className="grid gap-8 lg:grid-cols-2 pt-2 items-start animate-fadeIn">
            {/* Left: Payment Account Details */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-extrabold text-slate-800">
                  Manual Transfer Accounts
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scan the QR code or transfer the exact amount, then upload your receipt on the
                  right:
                </p>
              </div>

              {liveGateways.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {liveGateways.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedChannel(g.id)}
                      className={`px-4 py-2 text-xs font-bold rounded-xl ${
                        selectedChannel === g.id ? 'neu-btn-primary' : 'neu-btn'
                      }`}
                    >
                      {g.provider_name}
                    </button>
                  ))}
                </div>
              )}

              {fetchingGateways ? (
                <div className="neu-inset p-6 space-y-4">
                  <SkeletonBox className="h-48 w-48 mx-auto" />
                  <SkeletonBox className="h-5 w-40 mx-auto" />
                  <SkeletonBox className="h-8 w-48 mx-auto" />
                </div>
              ) : !activeGateway ? (
                <p className="text-xs text-slate-500 italic py-6">
                  Payment account details are not yet configured.
                </p>
              ) : (
                <div className="neu-inset p-5 sm:p-6 flex flex-col items-center gap-4 text-center">
                  <div className="w-full flex justify-start">
                    <span className="font-bold uppercase text-[10px] px-3 py-1 neu-card-sm text-emerald-700">
                      {activeGateway.provider_name}
                    </span>
                  </div>

                  {activeGateway.qrUrl && (
                    <div className="w-full max-w-[220px] aspect-square bg-white rounded-2xl p-3 overflow-hidden shadow-sm">
                      <a
                        href={activeGateway.qrUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-full h-full"
                      >
                        <img
                          src={activeGateway.qrUrl}
                          alt="Scan to pay"
                          className="h-full w-full object-contain cursor-zoom-in"
                        />
                      </a>
                    </div>
                  )}

                  <div className="w-full space-y-1.5 text-xs pt-1">
                    <p className="text-slate-500 text-[11px] font-semibold">Account Name</p>
                    <p className="font-black text-slate-800 uppercase text-sm">
                      {activeGateway.account_name}
                    </p>
                    <p className="text-slate-500 text-[11px] font-semibold pt-1">
                      Account / Mobile Number (Tap to copy)
                    </p>
                    <p className="font-mono font-black text-sm text-slate-800 neu-card-sm px-4 py-2 mt-1 mx-auto w-fit select-all tracking-wider">
                      {activeGateway.account_number}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Upload Proof Form */}
            <form
              onSubmit={handleManualVerificationSubmit}
              className="neu-inset p-5 sm:p-6 space-y-4"
            >
              <h4 className="text-sm font-extrabold text-slate-800">
                Submit Manual Transfer Proof
              </h4>

              <FloatingInput
                label="Sender Account Name"
                value={accountName}
                onChange={setAccountName}
                required
              />

              <FloatingInput
                label="Transaction Reference Number (Min 6 chars)"
                value={referenceNumber}
                onChange={(val) => setReferenceNumber(val.replace(/\s+/g, ''))}
                required
                error={
                  referenceNumber && !isReferenceValid
                    ? 'Please enter at least 6 characters from your payment receipt.'
                    : null
                }
              />

              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Payment Receipt *
                  </label>
                  <input
                    type="file"
                    ref={receiptInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  />
                  <button
                    type="button"
                    onClick={() => receiptInputRef.current?.click()}
                    className={`w-full p-3 text-center text-xs font-bold rounded-xl transition cursor-pointer ${
                      receiptFile ? 'neu-btn-primary' : 'neu-btn text-slate-600'
                    }`}
                  >
                    {receiptFile ? 'Receipt Attached' : 'Upload Receipt'}
                  </button>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Valid ID Photo *
                  </label>
                  <input
                    type="file"
                    ref={idInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setIdFile(e.target.files?.[0] || null)}
                  />
                  <button
                    type="button"
                    onClick={() => idInputRef.current?.click()}
                    className={`w-full p-3 text-center text-xs font-bold rounded-xl transition cursor-pointer ${
                      idFile ? 'neu-btn-primary' : 'neu-btn text-slate-600'
                    }`}
                  >
                    {idFile ? 'ID Attached' : 'Upload Valid ID'}
                  </button>
                </div>
              </div>

              {apiError && (
                <div className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 p-3.5 rounded-xl">
                  {apiError}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmitManual}
                className="neu-btn-primary w-full py-3.5 text-xs font-bold uppercase tracking-wider"
              >
                {submitting ? 'Submitting Booking...' : 'Submit Manual Payment & Confirm'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<PaymentPageSkeleton />}>
      <PaymentPageContent />
    </Suspense>
  );
}