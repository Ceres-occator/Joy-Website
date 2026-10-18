'use client';

import { Suspense, useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import {
  Key,
  AlertTriangle,
  CreditCard,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Smartphone,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { formatCurrency } from '@/utils/formatters';
import type { PaymentSetting, SystemSettings } from '@/types';
import FloatingInput from '@/components/ui/FloatingInput';
import { PaymentPageSkeleton, SkeletonBox } from '@/components/ui/Skeleton';

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

  // 1. Ensure GCash is always first
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

  // 2. Ensure Visa / Bank Transfer is always second
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

  // 3. Append any additional configured manual accounts
  for (const row of dbRows) {
    if (!usedIds.has(row.id)) {
      result.push(row);
      usedIds.add(row.id);
    }
  }

  return result;
}

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
  const selectedBasePaxTier = Number(searchParams.get('selectedBasePaxTier') || '0');
  const extraGuests = Number(searchParams.get('extraGuests') || '0');
  const packageOption = searchParams.get('packageOption') || 'accommodation_only';
  const includeOvernight = searchParams.get('includeOvernight') === 'true';
  const overnightPaxCount = Number(searchParams.get('overnightPaxCount') || '0');

  const [accountName, setAccountName] = useState(fullName);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [paymentMode, setPaymentMode] = useState<'half' | 'full'>('half');
  const [selectedChannel, setSelectedChannel] = useState<string>('gcash');

  const [liveGateways, setLiveGateways] = useState<PaymentSetting[]>(DEFAULT_MANUAL_CHANNELS);
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
          selectedBasePaxTier,
          extraGuests,
          packageOption,
          totalPrice,
          paymentMode,
          paymentGateway: 'manual',
          paymentChannel: activeGateway?.provider_name?.toLowerCase().includes('gcash')
            ? 'gcash'
            : activeGateway?.provider_name?.toLowerCase().includes('visa')
            ? 'visa'
            : selectedChannel,
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
            <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100">
              Booking Submitted!
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              We have sent your complete booking receipt via SMS
              {email ? ` and Email (${email})` : ''}. Our team will verify your payment shortly.
            </p>
          </div>

          <div className="neu-inset p-5 text-left flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs text-gray-600 dark:text-gray-300 uppercase font-bold tracking-wider block">
                Your Booking Reference Code (Save This!)
              </span>
              <p className="font-mono text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-wider select-all">
                {returnedGuestId || 'GENERATING...'}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-normal">
                Use this code anytime on the <strong>My Bookings</strong> page to check your
                status, submit a follow-up payment via GCash or Visa, or request changes.
              </p>
            </div>
            <div className="h-11 w-11 shrink-0 neu-card-sm flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Key className="w-5 h-5" />
            </div>
          </div>

          <div className="neu-inset p-6 text-left space-y-2.5 text-xs sm:text-sm font-medium">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Guest Name:</span>
              <span className="text-gray-900 dark:text-gray-100 font-bold">{fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Contact:</span>
              <span className="text-gray-900 dark:text-gray-100 font-bold">
                {phone}
                {email ? ` • ${email}` : ''}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Venue:</span>
              <span className="text-gray-900 dark:text-gray-100 font-bold">{villaTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Date &amp; Slot:</span>
              <span className="text-gray-900 dark:text-gray-100 font-bold">
                {eventDate} ({timeSlot})
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-3">
              <span className="text-gray-600 dark:text-gray-300">Total Cost:</span>
              <span className="text-gray-900 dark:text-gray-100 font-mono font-bold">
                {formatCurrency(totalPrice)}
              </span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
              <span>Amount Submitted:</span>
              <span className="font-mono">{formatCurrency(computedAmountPaid)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-800 text-amber-600 dark:text-amber-400 font-bold">
              <span>Remaining Balance:</span>
              <span className="font-mono">{formatCurrency(computedRemainingBalance)}</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => router.push('/my-bookings')}
              className="neu-btn py-3.5 text-sm font-semibold"
            >
              Go to My Bookings
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="neu-btn-primary py-3.5 text-sm font-semibold"
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 pb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-bold">
              Step 3 • Manual Payment &amp; Receipt Upload
            </p>
            <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-gray-100">
              Complete Your Reservation
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
              {villaTitle} • {eventDate} • {paxCount} Guests
            </p>
          </div>

          <div className="neu-inset px-5 py-3 text-right">
            <span className="text-xs font-bold uppercase text-gray-600 dark:text-gray-300 block">
              Amount Due Now
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 text-2xl font-black font-mono">
              {formatCurrency(computedAmountPaid)}
            </span>
          </div>
        </div>

        {/* Payment Plan & Channel Selector */}
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-900 dark:text-gray-100">
              1. Choose Payment Amount
            </label>
            <div className="grid grid-cols-2 gap-2 p-1.5 neu-inset">
              <button
                type="button"
                onClick={() => setPaymentMode('half')}
                className={`py-2.5 px-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  paymentMode === 'half'
                    ? 'neu-btn-primary'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {minDepositPercent}% Deposit ({formatCurrency(minDepositAmount)})
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode('full')}
                className={`py-2.5 px-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  paymentMode === 'full'
                    ? 'neu-btn-primary'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                100% Full ({formatCurrency(totalPrice)})
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-900 dark:text-gray-100">
              2. Choose Payment Method (GCash or Visa)
            </label>
            <div className="grid grid-cols-2 gap-2 p-1.5 neu-inset">
              {liveGateways.map((g) => {
                const isGcash = g.provider_name?.toLowerCase().includes('gcash');
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedChannel(g.id)}
                    className={`py-2.5 px-3 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
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
          </div>
        </div>

        {/* Catering & Forfeiture Policy Banner */}
        <div className="neu-inset-sm p-4 text-xs text-gray-600 dark:text-gray-300 grid sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-gray-900 dark:text-gray-100 block">
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
                <strong className="text-gray-900 dark:text-gray-100 block">
                  Catering Payment Rule
                </strong>
                <span>
                  At least {formatCurrency(systemSettings.catering_required_amount)} must be settled
                  1 week ({systemSettings.catering_deadline_days} days) before your event.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Manual Payment Details + Receipt & ID Upload */}
        <div className="grid gap-8 lg:grid-cols-2 pt-2 items-start animate-fadeIn">
          {/* Left: Payment Account Details */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-600" />
                {activeGateway?.provider_name || 'Manual Transfer'} Account Details
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                Send {formatCurrency(computedAmountPaid)} via{' '}
                <strong>{activeGateway?.provider_name || 'GCash or Visa'}</strong>, then upload your
                payment receipt on the right:
              </p>
            </div>

            {fetchingGateways ? (
              <div className="neu-inset p-6 space-y-4">
                <SkeletonBox className="h-48 w-48 mx-auto" />
                <SkeletonBox className="h-5 w-40 mx-auto" />
                <SkeletonBox className="h-8 w-48 mx-auto" />
              </div>
            ) : !activeGateway ? (
              <p className="text-xs text-gray-600 dark:text-gray-300 italic py-6">
                Payment account details are not yet configured.
              </p>
            ) : (
              <div className="neu-inset p-5 sm:p-6 flex flex-col items-center gap-4 text-center">
                <div className="w-full flex justify-between items-center">
                  <span className="font-bold uppercase text-xs px-3 py-1 neu-card-sm text-emerald-600 dark:text-emerald-400">
                    {activeGateway.provider_name}
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-300 font-mono">
                    Due: {formatCurrency(computedAmountPaid)}
                  </span>
                </div>

                {activeGateway.qrUrl && (
                  <div className="w-full max-w-[220px] aspect-square bg-white rounded-lg p-3 overflow-hidden shadow-sm border border-gray-200">
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
                  <p className="text-gray-600 dark:text-gray-300 text-xs font-semibold">
                    Account Name
                  </p>
                  <p className="font-black text-gray-900 dark:text-gray-100 uppercase text-sm">
                    {activeGateway.account_name}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300 text-xs font-semibold pt-1">
                    {activeGateway.provider_name?.toLowerCase().includes('gcash')
                      ? 'GCash Mobile Number (Tap to copy)'
                      : 'Visa / Bank Account Number (Tap to copy)'}
                  </p>
                  <p className="font-mono font-black text-sm text-gray-900 dark:text-gray-100 neu-card-sm px-4 py-2 mt-1 mx-auto w-fit select-all tracking-wider">
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
            <h4 className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
              Submit {activeGateway?.provider_name || 'Manual'} Payment Proof
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
                <label className="mb-1.5 block text-xs font-bold text-gray-900 dark:text-gray-100">
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
                  className={`w-full p-3 text-center text-xs font-bold rounded-md transition cursor-pointer ${
                    receiptFile ? 'neu-btn-primary' : 'neu-btn text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {receiptFile ? 'Receipt Attached' : 'Upload Receipt'}
                </button>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-gray-900 dark:text-gray-100">
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
                  className={`w-full p-3 text-center text-xs font-bold rounded-md transition cursor-pointer ${
                    idFile ? 'neu-btn-primary' : 'neu-btn text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {idFile ? 'ID Attached' : 'Upload Valid ID'}
                </button>
              </div>
            </div>

            {apiError && (
              <div className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 p-3.5 rounded-md">
                {apiError}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmitManual}
              className="neu-btn-primary w-full py-3.5 text-sm font-semibold"
            >
              {submitting ? 'Submitting Booking...' : 'Submit Payment & Confirm Booking'}
            </button>
          </form>
        </div>
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