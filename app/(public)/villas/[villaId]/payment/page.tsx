'use client'

import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { useState, use, useRef } from 'react';

interface PageProps {
  params: Promise<{
    villaId: string;
  }>;
}

export default function PaymentPage({ params }: PageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { villaId } = use(params);

  // --- UNPACK URL STATE ---
  const villaTitle = searchParams.get('villaTitle') || 'Selected Villa';
  const fullName = searchParams.get('fullName') || '';
  const phone = searchParams.get('phone') || '';
  const eventDate = searchParams.get('eventDate') || '';
  const timeSlot = searchParams.get('timeSlot') || 'day';
  const paxCount = searchParams.get('paxCount') || '50';
  const packageOption = searchParams.get('packageOption') || 'with_catering';
  const includeOvernight = searchParams.get('includeOvernight') === 'true';
  const overnightPaxCount = searchParams.get('overnightPaxCount') || '0';
  const totalPrice = Number(searchParams.get('price') || 0);

  // --- USER DATA CAPTURE STATES ---
  const [accountName, setAccountName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  
  // Storing the actual Files instead of just a boolean flag
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);

  // --- DOM REFERENCES FOR FILE INPUTS ---
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const idInputRef = useRef<HTMLInputElement>(null);

  // --- FLOW STATES ---
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const canSubmit = 
    accountName.trim().length > 0 && 
    referenceNumber.trim().length > 0 && 
    receiptFile !== null && 
    idFile !== null && 
    !submitting;

  const handleBookingVerificationSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setApiError(null);

    try {
      // Note: If you want to upload the files to Supabase Storage later, 
      // you would do it here using FormData or converting to base64.
      const res = await fetch('/api/booking/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          villaId,
          fullName,
          phone,
          eventDate,
          timeSlot,
          paxCount,
          packageOption,
          includeOvernight,
          overnightPaxCount,
          totalPrice,
          referenceNumber,
          accountName
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete transaction logging.');

      setIsSuccess(true);
    } catch (err: any) {
      setApiError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="mx-auto max-w-md p-4 sm:p-6">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl space-y-6 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">🎉</div>
          
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-zinc-900">Booking Requested!</h2>
            <p className="text-sm text-zinc-500">
              Your details and payment slip are successfully registered. Our team will verify your reference number shortly.
            </p>
          </div>

          <div className="rounded-2xl bg-zinc-50 p-4 text-left text-sm space-y-3 border border-zinc-100">
            <h3 className="font-bold text-zinc-800 border-b pb-1 text-xs uppercase tracking-wider text-zinc-400">Reservation Details</h3>
            <div className="flex justify-between">
              <span className="text-zinc-500">Venue:</span>
              <span className="font-semibold text-zinc-900">{villaTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Date:</span>
              <span className="font-semibold text-zinc-900">{eventDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Time Slot:</span>
              <span className="font-semibold capitalize text-zinc-900">{timeSlot} Slot</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-bold text-base text-zinc-900">
              <span>Total Price Paid:</span>
              <span className="text-emerald-600">₱{totalPrice.toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={() => router.push('/')}
            className="w-full rounded-full bg-zinc-900 py-3.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Return to Home Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-4 sm:p-6 space-y-6">
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Checkout Step</p>
          <h2 className="text-2xl font-bold text-zinc-900">Payment Upload</h2>
        </div>

        <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4 text-sm space-y-1">
          <div className="flex justify-between font-bold text-zinc-800">
            <span>50% Required Deposit due:</span>
            <span className="text-emerald-600 text-base">₱{(totalPrice * 0.5).toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <label className="mb-1 block font-semibold text-zinc-700">Account Name *</label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Sender Account Name"
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 focus:border-emerald-500 focus:outline-none bg-zinc-50"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-zinc-700">Reference Number *</label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Enter receipt reference tracking code"
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 focus:border-emerald-500 focus:outline-none bg-zinc-50"
            />
          </div>

          {/* Real Upload Box A: Payment Receipt */}
          <div>
            <label className="mb-1 block font-semibold text-zinc-700">Proof of Payment *</label>
            <input 
              type="file" 
              ref={receiptInputRef}
              accept="image/*"
              className="hidden" 
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
            />
            <div
              onClick={() => receiptInputRef.current?.click()}
              className={`w-full border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer select-none ${
                receiptFile 
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-800' 
                  : 'border-zinc-200 bg-zinc-50 text-zinc-400 hover:bg-zinc-100'
              }`}
            >
              {receiptFile ? `✅ Selected: ${receiptFile.name}` : '📁 Tap to upload receipt picture'}
            </div>
          </div>

          {/* Real Upload Box B: Valid ID Picture */}
          <div>
            <label className="mb-1 block font-semibold text-zinc-700">Valid ID Picture *</label>
            <input 
              type="file" 
              ref={idInputRef}
              accept="image/*"
              className="hidden" 
              onChange={(e) => setIdFile(e.target.files?.[0] || null)}
            />
            <div
              onClick={() => idInputRef.current?.click()}
              className={`w-full border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer select-none ${
                idFile 
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-800' 
                  : 'border-zinc-200 bg-zinc-50 text-zinc-400 hover:bg-zinc-100'
              }`}
            >
              {idFile ? `✅ Attached: ${idFile.name}` : '🪪 Tap to upload valid ID picture'}
            </div>
          </div>
        </div>

        {apiError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 font-medium">
            {apiError}
          </div>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleBookingVerificationSubmit}
          className={`w-full rounded-full py-3.5 text-sm font-semibold text-white transition shadow-md ${
            canSubmit 
              ? 'bg-emerald-500 hover:bg-emerald-600' 
              : 'bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none'
          }`}
        >
          {submitting ? 'Registering Booking Record...' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}