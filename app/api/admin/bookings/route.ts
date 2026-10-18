import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status') || 'pending_verification';

    const supabase = await createClient();

    // Enforce catering deadlines automatically before returning admin bookings
    try {
      await supabase.rpc('enforce_catering_deadlines');
    } catch {}

    let query = supabase
      .from('bookings')
      .select(`
        id,
        guest_id,
        villa_id,
        customer_name,
        customer_phone,
        email,
        account_name,
        reference_number,
        total_price,
        amount_paid,
        remaining_balance,
        payment_mode,
        payment_gateway,
        payment_channel,
        paymongo_checkout_id,
        paymongo_payment_id,
        required_deposit_percent,
        required_deposit_amount,
        catering_status,
        catering_required_amount,
        catering_deadline_date,
        cancelled_at,
        is_forfeited,
        forfeiture_reason,
        refund_status,
        refund_amount,
        refund_reason,
        refund_processed_at,
        event_date,
        end_date,
        slot_assignment,
        pax_count,
        package_option,
        include_overnight,
        overnight_pax_count,
        status,
        receipt_file_path,
        id_file_path,
        created_at,
        updated_at,
        villas ( id, name, address )
      `);

    if (statusFilter === 'refunds') {
      query = query.or('refund_status.neq.none,status.eq.cancelled,status.eq.cancelled_request_pending');
    } else {
      query = query.eq('status', statusFilter);
    }

    const { data: bookings, error } = await query.order('event_date', { ascending: true });

    if (error) throw error;

    const bookingsWithSignedUrls = await Promise.all(
      (bookings || []).map(async (booking) => {
        let signedReceiptUrl = booking.receipt_file_path;
        let signedIdUrl = booking.id_file_path;

        if (booking.receipt_file_path && !booking.receipt_file_path.startsWith('http')) {
          const { data } = await supabase.storage
            .from('booking-attachments')
            .createSignedUrl(booking.receipt_file_path, 900);
          if (data?.signedUrl) signedReceiptUrl = data.signedUrl;
        }

        if (booking.id_file_path && !booking.id_file_path.startsWith('http')) {
          const { data } = await supabase.storage
            .from('booking-attachments')
            .createSignedUrl(booking.id_file_path, 900);
          if (data?.signedUrl) signedIdUrl = data.signedUrl;
        }

        return {
          ...booking,
          receipt_file_path: signedReceiptUrl,
          id_file_path: signedIdUrl,
        };
      })
    );

    return NextResponse.json({ bookings: bookingsWithSignedUrls });
  } catch (error: any) {
    console.error('Admin bookings fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}