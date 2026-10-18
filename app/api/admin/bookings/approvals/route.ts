import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const role = user?.app_metadata?.role || user?.user_metadata?.role;
    if (role !== 'owner') {
      return NextResponse.json({ error: 'Only the owner can view approval requests.' }, { status: 403 });
    }

    const { data: requests, error } = await supabase
      .from('booking_changes_approval')
      .select(`
        *,
        bookings (
          id,
          guest_id
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ requests: requests || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}