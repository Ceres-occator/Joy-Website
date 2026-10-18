import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({
      message: 'Supabase connected',
      user: user ? { id: user.id, email: user.email } : null,
      status: 'ok',
    });
  } catch {
    return NextResponse.json(
      { error: 'Could not connect to Supabase' },
      { status: 500 }
    );
  }
}
