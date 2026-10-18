export type TimeSlot = 'day' | 'evening';
export type DayGroup = 'weekday' | 'weekend_holiday';
export type PackageOption = 'with_catering' | 'venue_only' | 'accommodation_only';
export type BookingPurpose = 'events' | 'accommodation';
export type PaymentMode = 'half' | 'full' | 'custom';
export type PaymentGateway = 'manual' | 'paymongo' | 'cash';

export type BookingStatus =
  | 'pending_verification'
  | 'confirmed'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'cancelled_request_pending'
  | 'archived';

export type CateringStatus =
  | 'not_applicable'
  | 'pending_payment'
  | 'confirmed'
  | 'paid'
  | 'flagged'
  | 'flagged_unpaid'
  | 'cancelled';

export type RefundStatus =
  | 'none'
  | 'requested'
  | 'approved'
  | 'processed'
  | 'refunded'
  | 'rejected'
  | 'forfeited';

export interface SystemSettings {
  id: string | number;
  min_deposit_percent: number;
  forfeiture_days: number;
  catering_required_amount: number;
  catering_deadline_days: number;
  catering_auto_action: 'flagged_unpaid' | 'flagged' | 'cancelled';
  admin_alert_phone: string | null;
  admin_alert_email: string | null;
  updated_at?: string;
}

export interface Villa {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  inclusions: string[] | null;
  category_type: string[] | null;
  min_deposit_percent?: number | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  map_zoom?: number | null;
}

export interface VillaLookup {
  id: string;
  name: string;
  min_deposit_percent?: number | null;
}

export interface PackageRow {
  id: string;
  villa_id: string;
  name: PackageOption;
  excess_pax_rate: number;
}

export interface RateTierRow {
  id: string;
  package_id: string;
  base_pax: number;
  time_of_day: TimeSlot;
  day_group: DayGroup;
  price: number;
}

export interface BookingRecord {
  id: string;
  guest_id: string;
  customer_name: string;
  customer_phone: string;
  email?: string | null;
  customer_email?: string | null;
  account_name: string;
  reference_number: string;
  total_price: number;
  amount_paid: number;
  remaining_balance: number;
  payment_mode?: string;
  payment_gateway?: PaymentGateway;
  payment_channel?: string | null;
  paymongo_checkout_id?: string | null;
  paymongo_payment_id?: string | null;
  required_deposit_percent?: number;
  required_deposit_amount?: number;
  catering_status?: CateringStatus;
  catering_required_amount?: number;
  catering_deadline_date?: string | null;
  cancelled_at?: string | null;
  is_forfeited?: boolean;
  forfeiture_reason?: string | null;
  refund_status?: RefundStatus;
  refund_amount?: number;
  refund_reason?: string | null;
  refund_notes?: string | null;
  refund_processed_at?: string | null;
  event_date: string;
  end_date?: string | null;
  slot_assignment: string;
  pax_count: number;
  package_option: string;
  include_overnight: boolean;
  overnight_pax_count: number;
  status: string;
  created_at?: string;
  updated_at?: string;
  receipt_file_path?: string | null;
  id_file_path?: string | null;
  villas?: { id?: string; name: string; address?: string | null } | null;
  villa_id?: string;
}

export interface PaymentTransaction {
  id: string;
  booking_id: string;
  phase: 'downpayment' | 'full_payment' | 'catering_payment' | 'follow_up' | 'balance_settlement' | 'refund';
  payment_gateway: PaymentGateway;
  payment_channel?: string | null;
  amount: number;
  account_name?: string | null;
  reference_number?: string | null;
  receipt_file_path?: string | null;
  paymongo_checkout_id?: string | null;
  paymongo_payment_id?: string | null;
  status: 'pending' | 'verified' | 'paid' | 'failed' | 'refunded' | 'rejected';
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationLog {
  id: string;
  booking_id?: string | null;
  channel: 'sms_textbee' | 'email_resend';
  recipient_type: 'admin' | 'customer';
  recipient: string;
  event_type: string;
  subject?: string | null;
  message_body: string;
  status: 'sent' | 'failed';
  created_at: string;
}

export interface PaymentSetting {
  id: string;
  provider_name: string;
  account_name: string;
  account_number: string;
  qr_file_path: string | null;
  qrUrl?: string | null;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  display_order: number;
}

export interface DashboardMetrics {
  totalRevenue: number;
  totalBookingsCount: number;
  eventBookingsCount: number;
  accommodationBookingsCount: number;
}

export interface PriceBreakdown {
  fixedPackagePrice: number;
  excessPaxSurcharge: number;
  mandatoryCleaningFee: number;
  optionalOvernightAddonPrice: number;
  aggregateTotalCost: number;
}
