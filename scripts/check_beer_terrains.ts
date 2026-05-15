import { createServiceClient } from '../lib/supabase/server';

async function main() {
  const supabase = createServiceClient();
  
  const { data: beerBases } = await supabase
    .from('players')
    .select('username, current_x, current_y')
    .eq('is_bot', true)
    .eq('is_special_base', true);

  console.log(`Checking ${beerBases?.length || 0} beer bases for valid terrain...`);
  
  for (const base of beerBases || []) {
    const { data: tile } = await supabase
      .from('tiles')
      .select('terrain, occupied_by_base')
      .eq('x', base.current_x)
      .eq('y', base.current_y)
      .single();
    
    const status = tile?.terrain === 'Wasteland' && !tile?.occupied_by_base ? '✅' : '❌';
    console.log(`  ${status} ${base.username} at (${base.current_x}, ${base.current_y}) → ${tile?.terrain || 'UNKNOWN'} occupied=${tile?.occupied_by_base}`);
  }
}

main().catch(console.error);
