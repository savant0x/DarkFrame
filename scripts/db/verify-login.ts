import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  // Check auth user
  const { data: users } = await supabase.auth.admin.listUsers();
  const admin = users?.users.find(u => u.email === 'spencerhowell84@gmail.com');
  console.log('Auth user:', admin ? JSON.stringify({ id: admin.id, email: admin.email, metadata: admin.user_metadata }, null, 2) : 'NOT FOUND');

  // Check player record
  const { data: player } = await supabase.from('players').select('username, email, is_admin, is_vip, vip_tier').eq('username', 'FAME').maybeSingle();
  console.log('Player record:', player ? JSON.stringify(player, null, 2) : 'NOT FOUND');

  // Try login
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'spencerhowell84@gmail.com',
    password: 'Sthcnh4525!',
  });
  if (loginError) console.log('Login error:', loginError.message);
  else console.log('Login OK, user_metadata:', loginData.user?.user_metadata);
}

main().catch(console.error);
