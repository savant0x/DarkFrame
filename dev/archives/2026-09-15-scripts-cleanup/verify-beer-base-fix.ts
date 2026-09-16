/**
 * Verify Beer Base Fix
 * 
 * Purpose: Check if Beer Base usernames are using new format (timestamp-based)
 * Run after server restart to confirm fix is active
 * 
 * Usage: npx ts-node -r dotenv/config scripts/verify-beer-base-fix.ts dotenv_config_path=.env.local
 */

import { MongoClient } from 'mongodb';

async function verifyBeerBaseFix() {
  console.log('🔍 [Verification] Checking Beer Base username format...\n');
  
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in environment');
    process.exit(1);
  }
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    // Find all Beer Bases
    const beerBases = await db.collection('players').find({ 
      isBot: true, 
      isSpecialBase: true 
    }).toArray();
    
    if (beerBases.length === 0) {
      console.log('ℹ️  No Beer Bases found in database');
      console.log('   This is normal if cleanup script was just run.');
      console.log('   Beer Bases will respawn on next cycle (~30-60 seconds).\n');
      process.exit(0);
    }
    
    console.log(`📊 Found ${beerBases.length} Beer Base(s):\n`);
    
    let oldFormatCount = 0;
    let newFormatCount = 0;
    
    beerBases.forEach((base: any, i: number) => {
      const username = base.username;
      const level = base.level;
      const pos = `${base.currentPosition?.x},${base.currentPosition?.y}`;
      
      // Check if username has timestamp (long number in middle)
      const hasTimestamp = /BeerBase-\w+-\d{13}-\d+/.test(username);
      
      if (hasTimestamp) {
        console.log(`   ✅ ${i + 1}. ${username}`);
        console.log(`      Level ${level} | Position: (${pos}) | Format: NEW (timestamp-based)`);
        newFormatCount++;
      } else {
        console.log(`   ❌ ${i + 1}. ${username}`);
        console.log(`      Level ${level} | Position: (${pos}) | Format: OLD (sequential numbering)`);
        oldFormatCount++;
      }
      console.log('');
    });
    
    // Summary
    console.log('═'.repeat(70));
    console.log('\n📋 SUMMARY:\n');
    console.log(`   New Format (Fixed):  ${newFormatCount} bases`);
    console.log(`   Old Format (Broken): ${oldFormatCount} bases`);
    console.log('');
    
    if (oldFormatCount > 0) {
      console.log('⚠️  WARNING: Old format Beer Bases detected!');
      console.log('   This means either:');
      console.log('   1. Server was not restarted after code fix, OR');
      console.log('   2. Cleanup script was not run before restart\n');
      console.log('📝 RECOMMENDED ACTIONS:');
      console.log('   1. Stop server (Ctrl+C)');
      console.log('   2. Run: npx ts-node scripts/cleanup-beer-bases.ts');
      console.log('   3. Restart: npm run dev');
      console.log('');
    } else if (newFormatCount > 0) {
      console.log('✅ SUCCESS! All Beer Bases using new timestamp-based format.');
      console.log('   The duplicate key error fix is active and working.\n');
    }
    
    await client.close();
    process.exit(oldFormatCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Error during verification:', error);
    await client.close();
    process.exit(1);
  }
}

verifyBeerBaseFix();
