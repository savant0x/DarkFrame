import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: tile } = await s.from('tiles').select('x, y').eq('terrain', 'Wasteland').eq('occupied_by_base', false).limit(1).single();
  console.log('Found tile:', JSON.stringify(tile));
  if (tile) {
    await s.from('players').update({ current_x: tile.x, current_y: tile.y, base_x: tile.x, base_y: tile.y }).eq('username', 'fame');
    await s.from('tiles').update({ occupied_by_base: true, base_owner: 'fame' }).eq('x', tile.x).eq('y', tile.y);
    console.log('Player moved to', tile.x, tile.y);
  }
}
main();
