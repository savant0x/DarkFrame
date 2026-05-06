import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const email = 'spencerhowell84@gmail.com';

  // Confirm auth email first
  const { data: users } = await supabase.auth.admin.listUsers();
  const authUser = users.users.find(u => u.email === email || u.email === 'spencerhowell84@gmail.com');
  if (authUser) {
    const { error: confirmError } = await supabase.auth.admin.updateUserById(authUser.id, { email_confirm: true });
    console.log(confirmError ? `Email confirm failed: ${confirmError.message}` : '✅ Auth email confirmed');
  } else {
    console.log('No auth user found — creating one');
    await supabase.auth.admin.createUser({ email, password: 'Sthcnh4525!', email_confirm: true, user_metadata: { username: 'fame' } });
  }

  // Check by email
  let { data: player } = await supabase.from('players').select('username, is_admin, email').eq('email', email.toLowerCase()).single();

  if (!player) {
    // Check by username
    const { data: player2 } = await supabase.from('players').select('username, is_admin, email').eq('username', 'FAME').single();
    player = player2;
  }

  if (!player) {
    console.error('Player not found at all');
    return;
  }

  console.log(`Found: ${player.username} (admin: ${player.is_admin})`);

  const { error } = await supabase.from('players').update({
    is_admin: true,
    rank: 5,
  }).eq('username', player.username);

  if (error) {
    console.error('Update failed:', error);
  } else {
    console.log(`✅ ${player.username} upgraded to admin`);
  }
}

main();
