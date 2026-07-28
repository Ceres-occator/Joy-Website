// app/api/admin/bookings/route.ts
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") || "pending_verification";

    const supabase = await createClient();

    // 🚀 FIXED: Replaced select("*") with explicit strings to join relation tables fields mapping keys
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(`
        id,
        guest_id,
        customer_name,
        customer_phone,
        account_name,
        reference_number,
        total_price,
        amount_paid,
        remaining_balance,
        event_date,
        slot_assignment,
        pax_count,
        package_option,
        include_overnight,
        overnight_pax_count,
        status,
        receipt_file_path,
        id_file_path,
        villas ( id, name )
      `)
      .eq("status", statusFilter)
      .order("event_date", { ascending: true });

    if (error) throw error;

    const bookingsWithSignedUrls = await Promise.all((bookings || []).map(async (booking) => {
      let signedReceiptUrl = booking.receipt_file_path;
      let signedIdUrl = booking.id_file_path;

      if (booking.receipt_file_path) {
        const { data } = await supabase.storage
          .from("booking-attachments")
          .createSignedUrl(booking.receipt_file_path, 900);
        if (data?.signedUrl) signedReceiptUrl = data.signedUrl;
      }

      if (booking.id_file_path) {
        const { data } = await supabase.storage
          .from("booking-attachments")
          .createSignedUrl(booking.id_file_path, 900);
        if (data?.signedUrl) signedIdUrl = data.signedUrl;
      }

      return {
        ...booking,
        receipt_file_path: signedReceiptUrl,
        id_file_path: signedIdUrl
      };
    }));

    return NextResponse.json({ bookings: bookingsWithSignedUrls });

  } catch (error: any) {
    console.error("Admin preview link parsing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}