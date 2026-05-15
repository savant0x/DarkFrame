import { createServiceClient } from '../lib/supabase/server';

async function main() {
  const supabase = createServiceClient();
  
  const { data: beerBases } = await supabase
    .from('players')
    .select('username, current_x, current_y')
    .eq('is_bot', true)
    .eq('is_special_base', true);
  
  console.log('Beer bases found:', beerBases?.length || 0);
  if (beerBases && beerBases.length > 0) {
    beerBases.forEach(b => console.log(`  ${b.username} at (${b.current_x}, ${b.current_y})`));
  } else {
    console.log('NO BEER BASES FOUND');
  }
}

main().catch(console.error);
