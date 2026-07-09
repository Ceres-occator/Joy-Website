// app/api/admin/bookings/approvals/route.ts
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Enforce role security isolation protection routines
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.user_metadata?.role !== 'owner') {
      return NextResponse.json({ error: "Unauthorized endpoint request access path." }, { status: 403 });
    }

    const { data: requests, error } = await supabase
      .from("booking_changes_approval")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ requests: requests || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}