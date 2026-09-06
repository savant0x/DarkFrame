/**
 * Create Tutorial Database Indexes
 * Created: 2025-10-25
 * Feature: FID-20251025-106 - Tutorial Production Readiness Fix
 * 
 * OVERVIEW:
 * Creates MongoDB indexes for tutorial collections to ensure optimal query performance:
 * - tutorial_progress: Unique index on playerId for fast player lookups
 * - tutorial_action_tracking: Compound index on playerId + stepId for real-time progress
 * 
 * USAGE:
 * npx ts-node scripts/create-tutorial-indexes.ts
 */

import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'darkframe';

async function createTutorialIndexes() {
  console.log('🔧 Creating tutorial database indexes...\n');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(DATABASE_NAME);

    // ========================================================================
    // Index 1: tutorial_progress - Unique playerId index
    // ========================================================================
    console.log('\n📊 Creating index: tutorial_progress.playerId (unique)');
    
    const progressCollection = db.collection('tutorial_progress');
    await progressCollection.createIndex(
      { playerId: 1 },
      { 
        unique: true,
        name: 'idx_playerId_unique',
        background: true,
      }
    );
    
    console.log('✅ Index created: tutorial_progress.playerId');

    // ========================================================================
    // Index 2: tutorial_action_tracking - Compound playerId + stepId index
    // ========================================================================
    console.log('\n📊 Creating index: tutorial_action_tracking (playerId + stepId)');
    
    const trackingCollection = db.collection('tutorial_action_tracking');
    await trackingCollection.createIndex(
      { playerId: 1, stepId: 1 },
      {
        unique: true,
        name: 'idx_playerId_stepId',
        background: true,
      }
    );
    
    console.log('✅ Index created: tutorial_action_tracking.playerId + stepId');

    // ========================================================================
    // Index 3: tutorial_progress - lastUpdated for analytics queries
    // ========================================================================
    console.log('\n📊 Creating index: tutorial_progress.lastUpdated');
    
    await progressCollection.createIndex(
      { lastUpdated: -1 },
      {
        name: 'idx_lastUpdated',
        background: true,
      }
    );
    
    console.log('✅ Index created: tutorial_progress.lastUpdated');

    // ========================================================================
    // Verify indexes
    // ========================================================================
    console.log('\n🔍 Verifying indexes...');
    
    const progressIndexes = await progressCollection.indexes();
    console.log('\n📋 tutorial_progress indexes:');
    progressIndexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    const trackingIndexes = await trackingCollection.indexes();
    console.log('\n📋 tutorial_action_tracking indexes:');
    trackingIndexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log('\n✅ All tutorial indexes created successfully!');
    console.log('\n📈 Performance Benefits:');
    console.log('   - Fast player tutorial lookups (unique playerId)');
    console.log('   - Real-time action progress queries (playerId + stepId)');
    console.log('   - Analytics queries by date (lastUpdated)');
    console.log('   - Prevents duplicate progress records (unique constraint)');

  } catch (error) {
    console.error('\n❌ Error creating indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run if executed directly (ES module compatible check)
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const ___dirname = dirname(__filename);

// Check if this file is being run directly
const isMainModule = process.argv[1] === __filename || process.argv[1]?.endsWith('create-tutorial-indexes.ts');

if (isMainModule) {
  createTutorialIndexes()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default createTutorialIndexes;
