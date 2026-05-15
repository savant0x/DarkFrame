import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  // Find and delete existing auth user
  const { data: users } = await supabase.auth.admin.listUsers();
  const existing = users?.users.find(u => u.email === 'spencerhowell84@gmail.com');
  if (existing) {
    await supabase.auth.admin.deleteUser(existing.id);
    console.log('Deleted existing auth user');
  }

  // Create fresh auth user with correct password
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'spencerhowell84@gmail.com',
    password: 'Sthcnh4525!',
    email_confirm: true,
    user_metadata: { username: 'FAME' },
  });
  if (error) { console.log('Auth error:', error.message); return; }
  console.log('Created auth user:', data.user?.id);

  // Upsert player record
  const vipExp = new Date();
  vipExp.setFullYear(vipExp.getFullYear() + 1);
  const { error: pErr } = await supabase.from('players').upsert({
    username: 'FAME',
    email: 'spencerhowell84@gmail.com',
    password: 'SUPABASE_AUTH',
    is_admin: true,
    is_vip: true,
    vip_tier: 'YEARLY',
    vip_expiration: vipExp.toISOString(),
    vip_last_updated: new Date().toISOString(),
    rank: 5, level: 1, xp: 0, research_points: 0,
    resources_metal: 100000, resources_energy: 100000,
    bank_metal: 0, bank_energy: 0,
    gathering_metal_bonus: 0, gathering_energy_bonus: 0,
    inventory_capacity: 2000, inventory_metal_digger_count: 0, inventory_energy_digger_count: 0,
    factory_count: 0, base_x: 75, base_y: 75, current_x: 75, current_y: 75,
    unlocked_tiers: [1],
  }, { onConflict: 'username' });
  if (pErr) console.log('Player error:', pErr.message);
  else console.log('Player record upserted');

  // Verify
  const { data: admin } = await supabase.from('players')
    .select('username, is_vip, vip_tier, is_admin').eq('username', 'FAME').single();
  console.log('Admin:', JSON.stringify(admin));
}

main().catch(console.error);
