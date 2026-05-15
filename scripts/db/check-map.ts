import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const checks = [
    {x:1,y:1,expected:'Shrine'},
    {x:10,y:10,expected:'AuctionHouse'},
    {x:38,y:38,expected:'Bank'},
    {x:112,y:38,expected:'Bank'},
    {x:38,y:112,expected:'Bank'},
    {x:112,y:112,expected:'Bank'},
    {x:75,y:25,expected:'Bank'},
    {x:25,y:75,expected:'Bank'},
    {x:75,y:125,expected:'Bank'},
    {x:125,y:75,expected:'Bank'},
    {x:75,y:75,expected:'(any)'},
    {x:100,y:100,expected:'(any)'},
  ];
  for (const c of checks) {
    const { data } = await supabase.from('tiles').select('terrain, bank_type').eq('x', c.x).eq('y', c.y).single();
    const actual = data?.terrain + (data?.bank_type ? '(' + data.bank_type + ')' : '');
    const match = c.expected === '(any)' || data?.terrain === c.expected ? 'OK' : 'WRONG';
    console.log(match, `(${c.x},${c.y})`, actual, '| expected:', c.expected);
  }

  // Count terrain types
  const { data: counts } = await supabase.rpc('count_terrain_distribution');
  if (counts) {
    console.log('\nTerrain distribution:');
    for (const row of counts as any[]) {
      console.log(`  ${row.terrain}: ${row.count}`);
    }
  }
}

main().catch(console.error);
