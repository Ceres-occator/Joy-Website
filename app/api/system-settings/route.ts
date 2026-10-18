import { NextRequest, NextResponse } from 'next/server';
import { createClient, requireAdminUser } from '@/utils/supabase/server';

const DEFAULT_SETTINGS = {
  id: 'default',
  min_deposit_percent: 50,
  forfeiture_days: 7,
  catering_required_amount: 10000,
  catering_deadline_days: 7,
  catering_auto_action: 'flagged_unpaid',
  admin_alert_phone: null,
  admin_alert_email: null,
};

export async function GET() {
  try {
    const supabase = await createClient();

    // Automatically run catering deadline enforcement (1 week before event)
    try {
      await supabase.rpc('enforce_catering_deadlines');
    } catch {
      // Safe fallback if RPC hasn't been called yet
    }

    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ settings: DEFAULT_SETTINGS });
    }

    return NextResponse.json({
      settings: data || DEFAULT_SETTINGS,
    });
  } catch (err: any) {
    return NextResponse.json({ settings: DEFAULT_SETTINGS });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { supabase, unauthorizedResponse } = await requireAdminUser();
    if (unauthorizedResponse) return unauthorizedResponse;

    const body = await req.json();

    const payload = {
      id: 'default',
      min_deposit_percent: Math.min(100, Math.max(0, Number(body.min_deposit_percent ?? 50))),
      forfeiture_days: Math.max(0, Number(body.forfeiture_days ?? 7)),
      catering_required_amount: Math.max(0, Number(body.catering_required_amount ?? 10000)),
      catering_deadline_days: Math.max(1, Number(body.catering_deadline_days ?? 7)),
      catering_auto_action:
        body.catering_auto_action === 'cancelled' ? 'cancelled' : 'flagged_unpaid',
      admin_alert_phone: body.admin_alert_phone ? String(body.admin_alert_phone).trim() : null,
      admin_alert_email: body.admin_alert_email ? String(body.admin_alert_email).trim() : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('system_settings')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;

    // Re-evaluate catering deadlines immediately after rule update
    try {
      await supabase.rpc('enforce_catering_deadlines');
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Business and booking rules updated!',
      settings: data,
    });
  } catch (err: any) {
    console.error('Failed to update system settings:', err);
    return NextResponse.json(
      { error: err.message || 'Could not update system settings.' },
      { status: 500 }
    );
  }
}

