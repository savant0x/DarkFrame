/**
 * @file scripts/cleanup-duplicate-users.ts
 * @created 2025-02-01
 * @overview Script to remove duplicate test users (Fame, demo)
 * 
 * OVERVIEW:
 * Removes duplicate test accounts that are not the actual admin user.
 * Keeps: FAME (admin)
 * Removes: Fame, demo
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI not found in environment variables');
}

async function cleanupDuplicateUsers() {
  const client = new MongoClient(MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('📡 Connected to MongoDB');
    
    const db = client.db('darkframe');
    const playersCollection = db.collection('players');
    
    // Find duplicate users
    const duplicates = await playersCollection.find({
      username: { $in: ['Fame', 'demo'] }
    }).toArray();
    
    console.log(`\n🔍 Found ${duplicates.length} duplicate users:`);
    duplicates.forEach(user => {
      console.log(`  - ${user.username} (Level ${user.level})`);
    });
    
    // Delete duplicates
    const result = await playersCollection.deleteMany({
      username: { $in: ['Fame', 'demo'] }
    });
    
    console.log(`\n✅ Deleted ${result.deletedCount} duplicate users`);
    
    // Verify FAME still exists
    const admin = await playersCollection.findOne({ username: 'FAME' });
    if (admin) {
      console.log(`\n👑 Admin user "FAME" confirmed (Level ${admin.level})`);
    } else {
      console.log('\n⚠️  Warning: Admin user "FAME" not found!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run script
cleanupDuplicateUsers()
  .then(() => {
    console.log('\n✨ Cleanup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Cleanup failed:', error);
    process.exit(1);
  });
