/**
 * Test active player detection
 */

import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI!;

async function testActivePlayerDetection() {
  console.log('🔍 Testing active player detection...\n');
  
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('darkframe');
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  console.log('📅 Checking for players active since:', sevenDaysAgo.toISOString());
  
  // Count all real players (using updated logic)
  const totalRealPlayers = await db.collection('players').countDocuments({ isBot: { $ne: true } });
  console.log(`📊 Total real players: ${totalRealPlayers}`);
  
  // Get all real players with their data
  const allPlayers = await db.collection('players').find(
    { isBot: { $ne: true } },
    { projection: { username: 1, level: 1, lastLoginDate: 1 } }
  ).toArray();
  
  console.log('\n👥 All real players:');
  for (const player of allPlayers) {
    const lastLogin = (player as any).lastLoginDate;
    const isActive = !lastLogin || lastLogin >= sevenDaysAgo;
    console.log(`  - ${(player as any).username} (Level ${(player as any).level || 1})`);
    console.log(`    Last login: ${lastLogin ? lastLogin.toISOString() : 'Never (no tracking)'}`);
    console.log(`    Active: ${isActive ? '✅ YES' : '❌ NO (older than 7 days)'}`);
  }
  
  // Count active players with fixed query
  const activeCount = await db.collection('players').countDocuments({
    isBot: { $ne: true },
    $or: [
      { lastLoginDate: { $gte: sevenDaysAgo } },
      { lastLoginDate: { $exists: false } }
    ]
  });
  
  console.log(`\n✅ Active players (last 7 days): ${activeCount}`);
  
  await client.close();
}

testActivePlayerDetection().catch(console.error);
