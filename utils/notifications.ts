import { createClient } from '@/utils/supabase/server';
import { formatCurrency, formatPackageLabel, formatStatusLabel, formatStayDates } from '@/utils/formatters';

export interface BookingNotificationPayload {
  bookingId: string;
  guestId: string;
  eventType:
    | 'new_booking'
    | 'booking_updated'
    | 'payment_verified'
    | 'catering_deadline'
    | 'cancellation_update'
    | 'refund_update';
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  villaName: string;
  villaAddress?: string | null;
  eventDate: string;
  endDate?: string | null;
  slotAssignment: string;
  packageOption: string;
  paxCount: number;
  includeOvernight?: boolean;
  overnightPaxCount?: number;
  totalPrice: number;
  amountPaid: number;
  remainingBalance: number;
  requiredDepositPercent?: number;
  requiredDepositAmount?: number;
  paymentGateway?: string;
  paymentChannel?: string | null;
  paymentMode?: string;
  accountName?: string | null;
  referenceNumber?: string | null;
  status: string;
  cateringStatus?: string;
  cateringRequiredAmount?: number;
  cateringDeadlineDate?: string | null;
  forfeitureDays?: number;
  isForfeited?: boolean;
  forfeitureReason?: string | null;
  refundStatus?: string;
  refundAmount?: number;
  notes?: string | null;
}

function normalizePhoneForSms(phone: string): string {
  const cleaned = (phone || '').trim();
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  const digits = cleaned.replace(/\D/g, '');
  if (digits.startsWith('09') && digits.length === 11) {
    return `+63${digits.slice(1)}`;
  }
  if (digits.startsWith('63') && digits.length === 12) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

export async function sendTextbeeSms(
  recipientPhone: string,
  message: string
): Promise<{ ok: boolean; response: any }> {
  const apiKey = process.env.TEXTBEE_API_KEY;
  const deviceId = process.env.TEXTBEE_DEVICE_ID;
  const normalizedPhone = normalizePhoneForSms(recipientPhone);

  if (!apiKey || !deviceId || !normalizedPhone) {
    return {
      ok: false,
      response: { error: 'Missing TEXTBEE_API_KEY, TEXTBEE_DEVICE_ID, or recipient phone.' },
    };
  }

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  };

  // Try standard Textbee v1 device endpoint first, then fallback to /gateway/send-sms
  const endpoints = [
    `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`,
    'https://api.textbee.dev/api/v1/gateway/send-sms',
    'https://api.textbee.dev/gateway/send-sms',
  ];

  let lastResponse: any = null;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          deviceId,
          recipients: [normalizedPhone],
          message,
        }),
      });
      const data = await res.json().catch(() => ({ status: res.status }));
      if (res.ok) {
        return { ok: true, response: data };
      }
      lastResponse = data;
    } catch (err: any) {
      lastResponse = { error: err.message };
    }
  }

  return { ok: false, response: lastResponse };
}

export async function sendResendEmail(
  toEmail: string,
  subject: string,
  html: string,
  text: string
): Promise<{ ok: boolean; response: any }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL || "Joy's Events and Party Place <onboarding@resend.dev>";

  if (!apiKey || !toEmail) {
    return {
      ok: false,
      response: { error: 'Missing RESEND_API_KEY or recipient email.' },
    };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail.trim()],
        subject,
        html,
        text,
      }),
    });
    const data = await res.json().catch(() => ({ status: res.status }));
    return { ok: res.ok, response: data };
  } catch (err: any) {
    return { ok: false, response: { error: err.message } };
  }
}

export function buildCustomerSmsReceipt(p: BookingNotificationPayload): string {
  const stayDates = formatStayDates(p.eventDate, p.endDate);
  const slotLabel = p.slotAssignment === 'day' ? 'Daytime (8AM-5PM)' : 'Evening/Overnight';
  const pkgLabel = formatPackageLabel(p.packageOption);
  const statusLabel = formatStatusLabel(p.status);
  const gatewayLabel = (p.paymentGateway || 'manual').toUpperCase();

  const lines = [
    `JOY'S EVENTS & PARTY PLACE`,
    `Update: ${statusLabel} (${p.guestId})`,
    `Guest: ${p.customerName}`,
    `Venue: ${p.villaName}`,
    `Date: ${stayDates} | ${slotLabel}`,
    `Package: ${pkgLabel} (${p.paxCount} pax${p.includeOvernight ? ` + ${p.overnightPaxCount || 0} overnight` : ''})`,
    `Total: ${formatCurrency(p.totalPrice)}`,
    `Paid: ${formatCurrency(p.amountPaid)} (${gatewayLabel}${p.paymentChannel ? `/${p.paymentChannel}` : ''})`,
    `Balance: ${formatCurrency(p.remainingBalance)}`,
    p.referenceNumber ? `Ref #: ${p.referenceNumber}` : '',
    p.packageOption === 'with_catering' && p.cateringDeadlineDate
      ? `Catering Rule: Pay at least ${formatCurrency(p.cateringRequiredAmount || 10000)} by ${p.cateringDeadlineDate}`
      : '',
    p.isForfeited && p.forfeitureReason ? `Policy: ${p.forfeitureReason}` : '',
    p.refundStatus && p.refundStatus !== 'none'
      ? `Refund Status: ${p.refundStatus.toUpperCase()} (${formatCurrency(p.refundAmount || 0)})`
      : '',
  ].filter(Boolean);

  return lines.join('\n');
}

export function buildAdminSmsAlert(p: BookingNotificationPayload): string {
  const stayDates = formatStayDates(p.eventDate, p.endDate);
  const gatewayLabel = (p.paymentGateway || 'manual').toUpperCase();
  return [
    `[ADMIN ALERT - ${p.eventType.replace(/_/g, ' ').toUpperCase()}]`,
    `Ref: ${p.guestId} | Status: ${formatStatusLabel(p.status)}`,
    `Guest: ${p.customerName} (${p.customerPhone}${p.customerEmail ? `, ${p.customerEmail}` : ''})`,
    `Venue: ${p.villaName}`,
    `Date: ${stayDates} (${p.slotAssignment.toUpperCase()})`,
    `Pkg: ${formatPackageLabel(p.packageOption)} | ${p.paxCount} pax`,
    `Paid: ${formatCurrency(p.amountPaid)} / ${formatCurrency(p.totalPrice)} via ${gatewayLabel}`,
    `Balance: ${formatCurrency(p.remainingBalance)}`,
    p.referenceNumber ? `Txn Ref: ${p.referenceNumber}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildCustomerEmailReceipt(p: BookingNotificationPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const stayDates = formatStayDates(p.eventDate, p.endDate);
  const slotLabel =
    p.packageOption === 'accommodation_only'
      ? 'Check-In 2:00 PM / Check-Out 9:00 AM'
      : p.slotAssignment === 'day'
      ? 'Daytime Event (8:00 AM – 5:00 PM)'
      : 'Evening Event (6:00 PM – 7:00 AM)';
  const pkgLabel = formatPackageLabel(p.packageOption);
  const statusLabel = formatStatusLabel(p.status);
  const gatewayLabel =
    p.paymentGateway === 'paymongo'
      ? `PayMongo (${p.paymentChannel || 'Online Checkout'})`
      : p.paymentGateway === 'cash'
      ? 'Walk-In Cash Payment'
      : `Manual Transfer (${p.accountName || 'Verified Account'})`;

  const subject = `Official Booking Receipt & Summary — ${p.guestId} (${statusLabel}) | Joy's Events and Party Place`;

  const text = buildCustomerSmsReceipt(p);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:24px;background-color:#e6ebf0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;">
  <div style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#059669,#047857);padding:28px 32px;color:#ffffff;">
      <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.9;font-weight:700;">Official Booking Receipt</p>
      <h1 style="margin:6px 0 4px;font-size:24px;font-weight:800;">Joy's Events and Party Place</h1>
      <p style="margin:0;font-size:13px;opacity:0.9;">${p.villaAddress || 'Ma-a, Davao City, Philippines, 8000'}</p>
    </div>

    <div style="padding:28px 32px;">
      <div style="display:flex;justify-content:space-between;align-items:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:16px 20px;margin-bottom:24px;">
        <div>
          <div style="font-size:11px;text-transform:uppercase;color:#64748b;font-weight:700;">Booking Reference ID</div>
          <div style="font-size:20px;font-weight:800;color:#059669;font-family:monospace;">${p.guestId}</div>
          <div style="font-size:11px;color:#94a3b8;">System ID: ${p.bookingId}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;text-transform:uppercase;color:#64748b;font-weight:700;">Current Status</div>
          <div style="display:inline-block;margin-top:4px;padding:6px 12px;border-radius:999px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:800;">
            ${statusLabel}
          </div>
        </div>
      </div>

      <h3 style="margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#475569;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">
        1. Guest Information
      </h3>
      <table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:6px 0;color:#64748b;">Full Name:</td>
          <td style="padding:6px 0;font-weight:700;text-align:right;">${p.customerName}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Phone Number:</td>
          <td style="padding:6px 0;font-weight:700;text-align:right;">${p.customerPhone}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Email Address:</td>
          <td style="padding:6px 0;font-weight:700;text-align:right;">${p.customerEmail || 'Not provided'}</td>
        </tr>
      </table>

      <h3 style="margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#475569;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">
        2. Venue & Schedule Details
      </h3>
      <table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:6px 0;color:#64748b;">Selected Venue / Room:</td>
          <td style="padding:6px 0;font-weight:700;text-align:right;">${p.villaName}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Reservation Dates:</td>
          <td style="padding:6px 0;font-weight:700;text-align:right;">${stayDates}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Time Slot / Schedule:</td>
          <td style="padding:6px 0;font-weight:700;text-align:right;">${slotLabel}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Selected Package:</td>
          <td style="padding:6px 0;font-weight:700;text-align:right;">${pkgLabel}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Total Guests (Pax):</td>
          <td style="padding:6px 0;font-weight:700;text-align:right;">${p.paxCount} Guests</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Overnight Stay Add-On:</td>
          <td style="padding:6px 0;font-weight:700;text-align:right;">
            ${p.includeOvernight ? `Yes (${p.overnightPaxCount || 0} Overnight Guests)` : 'None'}
          </td>
        </tr>
      </table>

      <h3 style="margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#475569;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">
        3. Complete Payment & Invoice Breakdown
      </h3>
      <table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="padding:6px 0;color:#64748b;">Payment Method / Gateway:</td>
          <td style="padding:6px 0;font-weight:700;text-align:right;">${gatewayLabel}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Payment Plan:</td>
          <td style="padding:6px 0;font-weight:700;text-align:right;">
            ${p.paymentMode === 'full' ? 'Full Payment (100%)' : `Deposit (${p.requiredDepositPercent || 50}% Minimum Required)`}
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Transaction Reference #:</td>
          <td style="padding:6px 0;font-weight:700;font-family:monospace;text-align:right;">${p.referenceNumber || 'N/A'}</td>
        </tr>
        <tr style="border-top:1px dashed #cbd5e1;">
          <td style="padding:10px 0 6px;color:#1e293b;font-weight:700;">Total Booking Cost:</td>
          <td style="padding:10px 0 6px;font-weight:800;font-size:15px;text-align:right;">${formatCurrency(p.totalPrice)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#059669;font-weight:700;">Amount Paid to Date:</td>
          <td style="padding:6px 0;color:#059669;font-weight:800;font-size:15px;text-align:right;">${formatCurrency(p.amountPaid)}</td>
        </tr>
        <tr style="border-top:1px solid #e2e8f0;">
          <td style="padding:10px 0;color:#d97706;font-weight:800;">Remaining Balance Due:</td>
          <td style="padding:10px 0;color:#d97706;font-weight:800;font-size:16px;text-align:right;">${formatCurrency(p.remainingBalance)}</td>
        </tr>
      </table>

      ${
        p.packageOption === 'with_catering'
          ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:14px 18px;margin-bottom:18px;font-size:12px;color:#92400e;">
              <strong>🍽️ Catering Payment Rule:</strong> Since you selected the All-In Catering Package, a minimum catering payment of <strong>${formatCurrency(
                p.cateringRequiredAmount || 10000
              )}</strong> must be settled on or before <strong>${
              p.cateringDeadlineDate || '1 week before your event'
            }</strong> (Catering Status: <strong>${(p.cateringStatus || 'pending_payment').toUpperCase()}</strong>).
            </div>`
          : ''
      }

      ${
        p.refundStatus && p.refundStatus !== 'none'
          ? `<div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:14px;padding:14px 18px;margin-bottom:18px;font-size:12px;color:#334155;">
              <strong>💳 Refund / Cancellation Summary:</strong> Status: <strong>${p.refundStatus.toUpperCase()}</strong> | Refundable Amount: <strong>${formatCurrency(
              p.refundAmount || 0
            )}</strong>
              ${p.forfeitureReason ? `<br/><span>${p.forfeitureReason}</span>` : ''}
            </div>`
          : ''
      }

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:14px 18px;font-size:11px;color:#64748b;line-height:1.5;">
        <strong>Cancellation & Forfeiture Policy:</strong> Cancellations made within <strong>${
          p.forfeitureDays ?? 7
        } days</strong> of your scheduled event date are non-refundable and any deposit paid is forfeited. Please keep your Booking Reference ID (<strong>${
    p.guestId
  }</strong>) to track or manage your reservation on our website under <em>My Bookings</em>.
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject, html, text };
}

export async function dispatchBookingNotifications(payload: BookingNotificationPayload) {
  const supabase = await createClient();

  // Fetch admin phone/email & rules from system_settings
  const { data: settings } = await supabase
    .from('system_settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();

  const enrichedPayload: BookingNotificationPayload = {
    ...payload,
    forfeitureDays: payload.forfeitureDays ?? settings?.forfeiture_days ?? 7,
  };

  const adminPhone = settings?.admin_alert_phone || process.env.ADMIN_ALERT_PHONE || '';
  const adminEmail = settings?.admin_alert_email || '';

  const results: Record<string, any> = {};

  // 1. Send Admin SMS Alert via Textbee
  if (adminPhone) {
    const adminSmsText = buildAdminSmsAlert(enrichedPayload);
    const adminSmsRes = await sendTextbeeSms(adminPhone, adminSmsText);
    results.adminSms = adminSmsRes;

    await supabase.from('notification_logs').insert([
      {
        booking_id: payload.bookingId,
        channel: 'sms_textbee',
        recipient_type: 'admin',
        recipient: adminPhone,
        event_type: payload.eventType,
        message_body: adminSmsText,
        status: adminSmsRes.ok ? 'sent' : 'failed',
        provider_response: adminSmsRes.response,
      },
    ]);
  }

  // 2. Send Customer SMS Receipt via Textbee
  if (payload.customerPhone) {
    const customerSmsText = buildCustomerSmsReceipt(enrichedPayload);
    const customerSmsRes = await sendTextbeeSms(payload.customerPhone, customerSmsText);
    results.customerSms = customerSmsRes;

    await supabase.from('notification_logs').insert([
      {
        booking_id: payload.bookingId,
        channel: 'sms_textbee',
        recipient_type: 'customer',
        recipient: payload.customerPhone,
        event_type: payload.eventType,
        message_body: customerSmsText,
        status: customerSmsRes.ok ? 'sent' : 'failed',
        provider_response: customerSmsRes.response,
      },
    ]);
  }

  // 3. Send Customer Detailed Email Receipt via Resend (if email provided)
  if (payload.customerEmail && payload.customerEmail.includes('@')) {
    const { subject, html, text } = buildCustomerEmailReceipt(enrichedPayload);
    const emailRes = await sendResendEmail(payload.customerEmail, subject, html, text);
    results.customerEmail = emailRes;

    await supabase.from('notification_logs').insert([
      {
        booking_id: payload.bookingId,
        channel: 'email_resend',
        recipient_type: 'customer',
        recipient: payload.customerEmail,
        event_type: payload.eventType,
        subject,
        message_body: text,
        status: emailRes.ok ? 'sent' : 'failed',
        provider_response: emailRes.response,
      },
    ]);
  }

  // 4. Optional Admin Email copy if configured
  if (adminEmail && adminEmail.includes('@')) {
    const { subject, html, text } = buildCustomerEmailReceipt(enrichedPayload);
    const adminEmailRes = await sendResendEmail(
      adminEmail,
      `[ADMIN COPY] ${subject}`,
      html,
      text
    );
    results.adminEmail = adminEmailRes;
  }

  return results;
}

