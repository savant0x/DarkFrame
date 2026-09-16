/**
 * Factory Defense Migration Script
 * Created: 2025-11-04
 * Updated: 2025-11-04 - Exponential defense formula
 * 
 * OVERVIEW:
 * Updates all existing factories to use exponential level-based defense calculation.
 * Previously, all factories had random defense (500-1000) regardless of level.
 * 
 * NEW EXPONENTIAL FORMULA:
 * - Level 1: 1,000 defense (accessible for first factory capture)
 * - Level 2+: (level - 1)² × 50,000 (exponential growth)
 * 
 * DEFENSE PROGRESSION:
 * - Level 1: 1,000 defense (anyone can capture)
 * - Level 2: 50,000 defense (requires ~50K strength)
 * - Level 5: 650,000 defense (requires ~650K strength)
 * - Level 10: 3,650,000 defense (requires ~3M+ strength - end-game)
 * 
 * MIGRATION PROCESS:
 * 1. Read all factories from database
 * 2. For each factory, calculate correct defense based on level
 * 3. Update defense field with new exponential value
 * 4. Report statistics (total updated, level distribution, defense changes)
 */

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = 'darkframe';

// Defense formula constants (matches factoryUpgradeService.ts)
const MIN_LEVEL = 1;
const MAX_LEVEL = 10;

/**
 * Calculate factory defense based on level
 * 
 * EXPONENTIAL SCALING FORMULA:
 * - Level 1: 1,000 (accessible to all players)
 * - Level 2+: (level - 1)² × 50,000 (exponential growth)
 * 
 * @param {number} level - Factory level (1-10)
 * @returns {number} Defense rating
 */
function getFactoryDefense(level) {
  if (level < MIN_LEVEL || level > MAX_LEVEL) {
    throw new Error(`Invalid factory level: ${level}`);
  }
  
  // Level 1 is special - very low defense for accessibility
  if (level === 1) {
    return 1000;
  }
  
  // Level 2+: Exponential scaling
  // Formula: (level - 1)² × 50,000
  const exponent = level - 1;
  return exponent * exponent * 50000;
}

async function migrateFactoryDefense() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  🛡️  FACTORY DEFENSE MIGRATION                        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_NAME);
    const factoriesCollection = db.collection('factories');

    // Get all factories
    const factories = await factoriesCollection.find({}).toArray();
    console.log(`📊 Found ${factories.length} total factories\n`);

    if (factories.length === 0) {
      console.log('⚠️  No factories found. Nothing to migrate.\n');
      return;
    }

    // Analyze current state
    const levelDistribution = {};
    const defenseChanges = [];
    let factoriesWithoutLevel = 0;

    factories.forEach(factory => {
      const level = factory.level || 1; // Default to Level 1 if missing
      const currentDefense = factory.defense || 0;
      const correctDefense = getFactoryDefense(level);

      // Track level distribution
      levelDistribution[level] = (levelDistribution[level] || 0) + 1;

      // Track if defense needs updating
      if (currentDefense !== correctDefense) {
        defenseChanges.push({
          x: factory.x,
          y: factory.y,
          level,
          currentDefense,
          correctDefense,
          owner: factory.owner || 'Unclaimed'
        });
      }

      if (!factory.level) {
        factoriesWithoutLevel++;
      }
    });

    // Display current state
    console.log('📈 CURRENT STATE:');
    console.log('─────────────────────────────────────────────────────────');
    console.log('Level Distribution:');
    Object.keys(levelDistribution).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
      const count = levelDistribution[level];
      const expectedDefense = getFactoryDefense(parseInt(level));
      console.log(`  Level ${level.padStart(2)}: ${count.toString().padStart(4)} factories (${expectedDefense.toLocaleString()} defense)`);
    });
    console.log(`\nFactories needing update: ${defenseChanges.length}`);
    if (factoriesWithoutLevel > 0) {
      console.log(`Factories without level field: ${factoriesWithoutLevel} (will default to Level 1)`);
    }
    console.log();

    if (defenseChanges.length === 0) {
      console.log('✅ All factories already have correct defense values!\n');
      return;
    }

    // Show sample changes
    console.log('🔍 SAMPLE CHANGES (first 10):');
    console.log('─────────────────────────────────────────────────────────');
    defenseChanges.slice(0, 10).forEach(change => {
      const delta = change.correctDefense - change.currentDefense;
      const deltaStr = delta >= 0 ? `+${delta}` : delta;
      console.log(`  (${change.x}, ${change.y}) Level ${change.level} - Owner: ${change.owner}`);
      console.log(`    ${change.currentDefense} → ${change.correctDefense} (${deltaStr})`);
    });
    if (defenseChanges.length > 10) {
      console.log(`  ... and ${defenseChanges.length - 10} more\n`);
    } else {
      console.log();
    }

    // Confirm migration
    console.log('⚙️  PERFORMING MIGRATION...\n');

    // Build aggregation pipeline to update all factories
    // Use $set to calculate exponential defense based on level field
    const updateResult = await factoriesCollection.updateMany(
      {},
      [
        {
          $set: {
            // Set level to 1 if missing (backwards compatibility)
            level: {
              $ifNull: ['$level', 1]
            }
          }
        },
        {
          $set: {
            // Calculate defense based on exponential formula
            // Level 1: 1,000
            // Level 2+: (level - 1)² × 50,000
            defense: {
              $cond: {
                if: { $eq: ['$level', 1] },
                then: 1000,
                else: {
                  $multiply: [
                    {
                      $pow: [
                        { $subtract: ['$level', 1] },
                        2
                      ]
                    },
                    50000
                  ]
                }
              }
            }
          }
        }
      ]
    );

    console.log('✅ MIGRATION COMPLETE!\n');
    console.log('📊 RESULTS:');
    console.log('─────────────────────────────────────────────────────────');
    console.log(`  Matched: ${updateResult.matchedCount}`);
    console.log(`  Modified: ${updateResult.modifiedCount}`);
    console.log();

    // Verify migration
    console.log('🔍 VERIFICATION:');
    console.log('─────────────────────────────────────────────────────────');
    const verifyFactories = await factoriesCollection.find({}).toArray();
    
    let correctCount = 0;
    let incorrectCount = 0;

    verifyFactories.forEach(factory => {
      const level = factory.level || 1;
      const expectedDefense = getFactoryDefense(level);
      if (factory.defense === expectedDefense) {
        correctCount++;
      } else {
        incorrectCount++;
        console.log(`  ❌ (${factory.x}, ${factory.y}) Level ${level}: defense=${factory.defense}, expected=${expectedDefense}`);
      }
    });

    console.log(`  ✅ Correct: ${correctCount}/${verifyFactories.length}`);
    if (incorrectCount > 0) {
      console.log(`  ❌ Incorrect: ${incorrectCount}/${verifyFactories.length}`);
    } else {
      console.log('  🎉 All factories have correct defense values!');
    }
    console.log();

    // Display new defense distribution
    console.log('📊 NEW DEFENSE DISTRIBUTION:');
    console.log('─────────────────────────────────────────────────────────');
    const defenseStats = {};
    verifyFactories.forEach(factory => {
      const defense = factory.defense;
      defenseStats[defense] = (defenseStats[defense] || 0) + 1;
    });
    Object.keys(defenseStats).sort((a, b) => parseInt(a) - parseInt(b)).forEach(defense => {
      const count = defenseStats[defense];
      console.log(`  ${defense.padStart(5)} defense: ${count} factories`);
    });
    console.log();

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('✅ MongoDB connection closed\n');
  }
}

// Run migration
migrateFactoryDefense()
  .then(() => {
    console.log('🎉 Factory defense migration completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
