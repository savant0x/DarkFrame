import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { error } = await supabase.from('tiles').delete().neq('x', -1);
  if (error) { console.error('Delete failed:', error.message); process.exit(1); }
  
  const { data: existing } = await supabase.from('tiles').select('x, y').limit(1);
  if (existing && existing.length > 0) {
    console.log(`${existing.length} tiles still present`);
  } else {
    console.log('All tiles cleared');
  }
}
main();
