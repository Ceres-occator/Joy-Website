// app/api/admin/bookings/route.ts
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") || "pending_verification";

    const supabase = await createClient();

    // 1. Fetch matching rows from your bookings table
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("status", statusFilter)
      .order("event_date", { ascending: true });

    if (error) throw error;

    // 2. Map directly back into your existing database column names 💸
    const bookingsWithSignedUrls = await Promise.all((bookings || []).map(async (booking) => {
      let signedReceiptUrl = booking.receipt_file_path;
      let signedIdUrl = booking.id_file_path;

      // Swap out the plain text path with a 15-minute secure access URL link
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
        receipt_file_path: signedReceiptUrl, // 👈 Overwritten with the signed URL link string
        id_file_path: signedIdUrl            // 👈 Overwritten with the signed URL link string
      };
    }));

    return NextResponse.json({ bookings: bookingsWithSignedUrls });

  } catch (error: any) {
    console.error("Admin preview link parsing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}