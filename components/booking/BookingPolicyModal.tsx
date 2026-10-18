'use client';

import { formatCurrency } from '@/utils/formatters';

interface BookingPolicyModalProps {
  activePopup: 'faq' | 'terms' | 'privacy' | null;
  onClose: () => void;
  minDepositPercent?: number;
  forfeitureDays?: number;
  cateringRequiredAmount?: number;
}

export default function BookingPolicyModal({
  activePopup,
  onClose,
  minDepositPercent = 50,
  forfeitureDays = 7,
  cateringRequiredAmount = 10000,
}: BookingPolicyModalProps) {
  if (!activePopup) return null;

  const quickFaqs = [
    {
      q: 'How do I confirm my booking?',
      a: `We require at least a ${minDepositPercent}% deposit via PayMongo (Chinabank, QR Ph, GCash, Maya, or Card) or manual transfer with receipt upload.`,
    },
    {
      q: 'What is the cancellation and forfeiture policy?',
      a: `If you cancel within ${forfeitureDays} days of your scheduled event or stay, your payment is forfeited and no refund is allowed.`,
    },
    {
      q: 'What is the rule for catering bookings?',
      a: `If you choose the All-In Catering package, at least ${formatCurrency(
        cateringRequiredAmount
      )} must be paid at least 1 week (7 days) before your appointment, otherwise the catering arrangement is automatically flagged or cancelled.`,
    },
    {
      q: 'Is there a security deposit at check-in?',
      a: 'Yes. A refundable ₱3,000 cash security deposit is collected at check-in and returned in full at check-out if there are no property damages.',
    },
  ];

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="neu-card p-6 sm:p-8 max-w-lg w-full max-h-[82vh] flex flex-col justify-between text-xs text-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-300/60 pb-3 mb-4 shrink-0">
          <h3 className="font-extrabold text-slate-800 text-base">
            {activePopup === 'faq' && 'Common Questions'}
            {activePopup === 'terms' && 'Booking Rules & Cancellation Policy'}
            {activePopup === 'privacy' && 'Privacy Policy'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="neu-btn px-2.5 h-8 flex items-center justify-center font-bold text-slate-600"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4 leading-relaxed">
          {activePopup === 'faq' && (
            <div className="space-y-3">
              {quickFaqs.map((faq, idx) => (
                <div key={idx} className="neu-inset p-4 space-y-1.5">
                  <p className="font-bold text-slate-800 text-xs">
                    <span className="text-emerald-600 mr-1">Q:</span>
                    {faq.q}
                  </p>
                  <p className="text-slate-600 pl-4">{faq.a}</p>
                </div>
              ))}
            </div>
          )}

          {activePopup === 'terms' && (
            <div className="space-y-4">
              <div className="neu-inset p-4 space-y-1.5">
                <h4 className="font-bold text-slate-800">
                  1. Deposit ({minDepositPercent}%) & Cancellation Forfeiture ({forfeitureDays} Days)
                </h4>
                <p className="text-slate-600">
                  A minimum <strong>{minDepositPercent}% deposit</strong> is required to lock in your
                  date. If you cancel within <strong>{forfeitureDays} days</strong> of your
                  reservation date, your payment is strictly <strong>forfeited</strong> and no refund
                  is allowed.
                </p>
              </div>

              <div className="neu-inset p-4 space-y-1.5">
                <h4 className="font-bold text-slate-800">2. Catering Deadline Rule (1 Week Prior)</h4>
                <p className="text-slate-600">
                  For bookings with catering, a minimum payment of{' '}
                  <strong>{formatCurrency(cateringRequiredAmount)}</strong> must be settled at least{' '}
                  <strong>1 week (7 days)</strong> before your appointment. Unpaid catering
                  arrangements are automatically flagged or cancelled.
                </p>
              </div>

              <div className="neu-inset p-4 space-y-1.5">
                <h4 className="font-bold text-slate-800">3. Guest Limits & Security Deposit</h4>
                <p className="text-slate-600">
                  Only the declared number of guests may enter. A refundable{' '}
                  <strong>₱3,000 cash security deposit</strong> and any remaining balance are
                  collected upon check-in.
                </p>
              </div>
            </div>
          )}

          {activePopup === 'privacy' && (
            <div className="neu-inset p-4 space-y-3">
              <p>
                We respect your privacy and only collect the information needed to confirm your
                reservation and send your official receipt:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li>Your full name, phone number, and optional email address for SMS/Email receipts.</li>
                <li>Valid ID and payment proof for manual transfers, or secure PayMongo checkout.</li>
              </ul>
            </div>
          )}
        </div>

        <div className="pt-4 mt-4 border-t border-slate-300/60 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="neu-btn-primary w-full font-bold py-2.5 text-xs"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
