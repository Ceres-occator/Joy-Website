// app/api/admin/bookings/approve-change/route.ts
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { requestId, action, reason } = await req.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (user?.user_metadata?.role !== 'owner') {
      return NextResponse.json({ error: "Unauthorized action capability execution mapping." }, { status: 403 });
    }

    const { data: requestRow, error: fetchErr } = await supabase
      .from("booking_changes_approval")
      .select("*")
      .eq("request_id", requestId)
      .single();

    if (fetchErr || !requestRow) {
      return NextResponse.json({ error: "Target modification history request record row missing." }, { status: 404 });
    }

    if (action === "reject") {
      const { error: rejectErr } = await supabase
        .from("booking_changes_approval")
        .update({ 
          status: "rejected", 
          reviewed_by: user?.id, 
          rejection_reason: reason || "Denied by management" 
        })
        .eq("request_id", requestId);

      if (rejectErr) throw rejectErr;
      return NextResponse.json({ success: true, message: "Change request denied successfully." });
    }

    if (action === "approve") {
      // Pull strictly from the 'after' object containing the updated fields
      const unpackedProposedChanges = requestRow.proposed_changes?.after || requestRow.proposed_changes;

      const { error: updateErr } = await supabase
        .from("bookings")
        .update(unpackedProposedChanges)
        .eq("id", requestRow.booking_id);

      if (updateErr) throw updateErr;

      const { error: finalizeErr } = await supabase
        .from("booking_changes_approval")
        .update({ 
          status: "approved", 
          reviewed_by: user?.id 
        })
        .eq("request_id", requestId);

      if (finalizeErr) throw finalizeErr;

      return NextResponse.json({ success: true, message: "Changes successfully committed to system database ledgers!" });
    }

    return NextResponse.json({ error: "Invalid action method parameter tokens passed." }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}