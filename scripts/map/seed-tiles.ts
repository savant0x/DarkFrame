import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const TERRAIN_TYPES = ['Wasteland','Forest','Metal','Energy','Cave','Factory','Bank','Shrine','AuctionHouse'];

async function main() {
  // Check existing tiles
  const { count } = await supabase.from('tiles').select('*', { count: 'exact', head: true });
  console.log(`Existing tiles: ${count}`);

  if (count && count >= 22500) {
    console.log('Tiles already seeded, skipping');
    return;
  }

  console.log('Seeding 150x150 map (22,500 tiles)...');
  const batch: Record<string, unknown>[] = [];
  
  for (let x = 1; x <= 150; x++) {
    for (let y = 1; y <= 150; y++) {
      const terrain = TERRAIN_TYPES[Math.floor(Math.random() * TERRAIN_TYPES.length)];
      batch.push({ x, y, terrain, occupied_by_base: false });
      
      if (batch.length >= 1000) {
        const { error } = await supabase.from('tiles').insert(batch);
        if (error) { console.error(`Batch insert failed at (${x},${y}):`, error.message); process.exit(1); }
        console.log(`Inserted up to (${x},${y})`);
        batch.length = 0;
      }
    }
  }
  
  if (batch.length > 0) {
    const { error } = await supabase.from('tiles').insert(batch);
    if (error) console.error('Final batch failed:', error.message);
  }
  
  const { count: final } = await supabase.from('tiles').select('*', { count: 'exact', head: true });
  console.log(`Done. Total tiles: ${final}`);
}

main();
