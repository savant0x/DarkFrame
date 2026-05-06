/**
 * User permissions route
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get('username');
  if (!username) return NextResponse.json({ success: false, error: 'Username parameter required' }, { status: 400 });
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from('players').select('is_admin').eq('username', username).single();
    return NextResponse.json({ success: true, isAdmin: data?.is_admin || false });
  } catch { return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 }); }
}
