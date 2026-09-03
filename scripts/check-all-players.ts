/**
 * Check all players (including database info)
 */

import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI!;

async function checkAllPlayers() {
  console.log('🔍 Checking database for all players...\n');
  console.log('📍 MongoDB URI:', MONGODB_URI.replace(/:[^:@]+@/, ':****@'));
  
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  
  // List all databases
  const adminDb = client.db().admin();
  const { databases } = await adminDb.listDatabases();
  console.log('\n📂 Available databases:');
  for (const db of databases) {
    const size = db.sizeOnDisk ? (db.sizeOnDisk / 1024 / 1024).toFixed(2) : '0.00';
    console.log(`  - ${db.name} (${size} MB)`);
  }
  
  // Check darkframe database
  const db = client.db('darkframe');
  console.log('\n🎯 Checking "darkframe" database...\n');
  
  // Count all players
  const totalPlayers = await db.collection('players').countDocuments({});
  console.log(`📊 Total players (including bots): ${totalPlayers}`);
  
  const realPlayers = await db.collection('players').countDocuments({ isBot: false });
  console.log(`👥 Real players (isBot: false): ${realPlayers}`);
  
  const botPlayers = await db.collection('players').countDocuments({ isBot: true });
  console.log(`🤖 Bot players (isBot: true): ${botPlayers}`);
  
  const beerBases = await db.collection('players').countDocuments({ isBot: true, isSpecialBase: true });
  console.log(`🍺 Beer Bases: ${beerBases}`);
  
  // Show all players
  const allPlayers = await db.collection('players').find({}).toArray();
  console.log('\n📋 All players in database:');
  for (const player of allPlayers) {
    const p = player as any;
    console.log(`  - ${p.username}`);
    console.log(`    Type: ${p.isBot ? (p.isSpecialBase ? '🍺 Beer Base' : '🤖 Bot') : '👤 Real Player'}`);
    console.log(`    Level: ${p.level || 1}`);
    console.log(`    Last Login: ${p.lastLoginDate ? p.lastLoginDate.toISOString() : 'Never'}`);
  }
  
  await client.close();
}

checkAllPlayers().catch(console.error);
