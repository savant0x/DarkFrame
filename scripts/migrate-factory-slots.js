/**
 * Factory Slot Capacity Migration Script
 * Created: 2025-11-04
 * 
 * OVERVIEW:
 * Updates all existing factories in the database to use the new exponential
 * slot cost system capacity values (5000 base + 500 per level).
 * 
 * OLD FORMULA: 10 + ((level - 1) × 2)
 * NEW FORMULA: 5000 + ((level - 1) × 500)
 * 
 * This migration is necessary because factories are static map tiles,
 * not player-created structures, so existing data needs updating.
 */

const { MongoClient } = require('mongodb');

const FACTORY_UPGRADE = {
  BASE_SLOTS: 5000,
  SLOTS_PER_LEVEL: 500
};

function getMaxSlots(level) {
  return FACTORY_UPGRADE.BASE_SLOTS + ((level - 1) * FACTORY_UPGRADE.SLOTS_PER_LEVEL);
}

async function migrateFactorySlots() {
  const uri = 'mongodb://localhost:27017';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db('darkframe');
    const factoriesCollection = db.collection('factories');

    // Get all factories
    const factories = await factoriesCollection.find({}).toArray();
    console.log(`\n📊 Found ${factories.length} factories to migrate`);

    if (factories.length === 0) {
      console.log('⚠️  No factories found in database');
      return;
    }

    // Show sample before migration
    console.log('\n🔍 Sample factory BEFORE migration:');
    const sample = factories[0];
    console.log(`   Level ${sample.level}: ${sample.slots} slots (old formula)`);
    console.log(`   Should be: ${getMaxSlots(sample.level)} slots (new formula)`);

    // Prepare bulk update operations
    const bulkOps = factories.map(factory => {
      const newSlots = getMaxSlots(factory.level || 1);
      
      return {
        updateOne: {
          filter: { _id: factory._id },
          update: {
            $set: {
              slots: newSlots
            }
          }
        }
      };
    });

    // Execute bulk update
    console.log('\n🔄 Updating factory slots...');
    const result = await factoriesCollection.bulkWrite(bulkOps);

    console.log(`\n✅ Migration complete!`);
    console.log(`   Modified: ${result.modifiedCount} factories`);
    console.log(`   Matched: ${result.matchedCount} factories`);

    // Show sample after migration
    const updatedSample = await factoriesCollection.findOne({ _id: sample._id });
    console.log('\n🔍 Sample factory AFTER migration:');
    console.log(`   Level ${updatedSample.level}: ${updatedSample.slots} slots ✅`);

    // Show summary by level
    console.log('\n📊 Summary by factory level:');
    const levels = await factoriesCollection.aggregate([
      {
        $group: {
          _id: '$level',
          count: { $sum: 1 },
          avgSlots: { $avg: '$slots' }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();

    levels.forEach(({ _id: level, count, avgSlots }) => {
      const expectedSlots = getMaxSlots(level);
      console.log(`   Level ${level}: ${count} factories, ${Math.round(avgSlots)} slots (expected: ${expectedSlots})`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run migration
console.log('🚀 Starting factory slot capacity migration...');
console.log('   OLD: 10 + ((level - 1) × 2)');
console.log('   NEW: 5000 + ((level - 1) × 500)');

migrateFactorySlots()
  .then(() => {
    console.log('\n✨ Migration successful!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration error:', error);
    process.exit(1);
  });
