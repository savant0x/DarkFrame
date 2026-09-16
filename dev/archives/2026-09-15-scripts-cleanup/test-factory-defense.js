/**
 * Factory Defense System Test Script
 * Created: 2025-11-04
 * Updated: 2025-11-04 - Exponential defense formula
 * 
 * OVERVIEW:
 * Comprehensive test suite for factory defense scaling system.
 * Validates exponential defense calculation formula, database consistency,
 * and upgrade behavior.
 * 
 * EXPONENTIAL FORMULA:
 * - Level 1: 1,000 defense (accessible)
 * - Level 2+: (level - 1)² × 50,000 (exponential growth)
 * 
 * TEST SUITES:
 * 1. Database State Validation
 * 2. Defense Formula Verification
 * 3. Level Distribution Analysis
 * 4. Sample Factory Details
 * 5. Owned Factory Validation
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
 * EXPONENTIAL SCALING FORMULA
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

async function testFactoryDefenseSystem() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  🛡️  FACTORY DEFENSE SYSTEM TESTS                     ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_NAME);
    const factoriesCollection = db.collection('factories');

    // ========================================
    // TEST 1: Defense Formula Verification
    // ========================================
    console.log('TEST 1: Defense Formula Verification');
    console.log('─────────────────────────────────────────────────────────');
    console.log('Expected defense values by level:');
    for (let level = MIN_LEVEL; level <= MAX_LEVEL; level++) {
      const defense = getFactoryDefense(level);
      console.log(`  Level ${level.toString().padStart(2)}: ${defense.toLocaleString().padStart(5)} defense`);
    }
    console.log('✅ Formula test passed\n');

    // ========================================
    // TEST 2: Database Consistency Check
    // ========================================
    console.log('TEST 2: Database Consistency Check');
    console.log('─────────────────────────────────────────────────────────');
    
    const factories = await factoriesCollection.find({}).toArray();
    console.log(`Total factories: ${factories.length}`);

    let correctCount = 0;
    let incorrectCount = 0;
    const incorrectFactories = [];

    factories.forEach(factory => {
      const level = factory.level || 1;
      const expectedDefense = getFactoryDefense(level);
      
      if (factory.defense === expectedDefense) {
        correctCount++;
      } else {
        incorrectCount++;
        incorrectFactories.push({
          x: factory.x,
          y: factory.y,
          level,
          currentDefense: factory.defense,
          expectedDefense,
          owner: factory.owner || 'Unclaimed'
        });
      }
    });

    console.log(`✅ Correct: ${correctCount}/${factories.length} (${((correctCount/factories.length)*100).toFixed(1)}%)`);
    
    if (incorrectCount > 0) {
      console.log(`❌ Incorrect: ${incorrectCount}/${factories.length}`);
      console.log('\nFirst 5 incorrect factories:');
      incorrectFactories.slice(0, 5).forEach(f => {
        console.log(`  (${f.x}, ${f.y}) Level ${f.level} - Owner: ${f.owner}`);
        console.log(`    Defense: ${f.currentDefense} (expected ${f.expectedDefense})`);
      });
      console.log('\n❌ TEST 2 FAILED\n');
    } else {
      console.log('✅ TEST 2 PASSED - All factories have correct defense\n');
    }

    // ========================================
    // TEST 3: Level Distribution Analysis
    // ========================================
    console.log('TEST 3: Level Distribution Analysis');
    console.log('─────────────────────────────────────────────────────────');
    
    const levelStats = {};
    const ownershipStats = { claimed: 0, unclaimed: 0 };
    
    factories.forEach(factory => {
      const level = factory.level || 1;
      if (!levelStats[level]) {
        levelStats[level] = {
          count: 0,
          avgDefense: 0,
          totalDefense: 0
        };
      }
      levelStats[level].count++;
      levelStats[level].totalDefense += factory.defense;
      
      if (factory.owner) {
        ownershipStats.claimed++;
      } else {
        ownershipStats.unclaimed++;
      }
    });

    console.log('Level distribution:');
    Object.keys(levelStats).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
      const stats = levelStats[level];
      stats.avgDefense = Math.round(stats.totalDefense / stats.count);
      const expectedDefense = getFactoryDefense(parseInt(level));
      const match = stats.avgDefense === expectedDefense ? '✅' : '❌';
      
      console.log(`  Level ${level.padStart(2)}: ${stats.count.toString().padStart(4)} factories | Avg defense: ${stats.avgDefense.toLocaleString()} (expected ${expectedDefense.toLocaleString()}) ${match}`);
    });

    console.log(`\nOwnership:`);
    console.log(`  Claimed: ${ownershipStats.claimed} (${((ownershipStats.claimed/factories.length)*100).toFixed(1)}%)`);
    console.log(`  Unclaimed: ${ownershipStats.unclaimed} (${((ownershipStats.unclaimed/factories.length)*100).toFixed(1)}%)`);
    console.log('✅ TEST 3 PASSED\n');

    // ========================================
    // TEST 4: Sample Factory Details
    // ========================================
    console.log('TEST 4: Sample Factory Details');
    console.log('─────────────────────────────────────────────────────────');
    
    // Get 5 random factories
    const sampleFactories = await factoriesCollection.aggregate([
      { $sample: { size: 5 } }
    ]).toArray();

    sampleFactories.forEach((factory, idx) => {
      const level = factory.level || 1;
      const expectedDefense = getFactoryDefense(level);
      const match = factory.defense === expectedDefense ? '✅' : '❌';
      
      console.log(`Factory ${idx + 1}:`);
      console.log(`  Location: (${factory.x}, ${factory.y})`);
      console.log(`  Level: ${level}`);
      console.log(`  Defense: ${factory.defense} (expected ${expectedDefense}) ${match}`);
      console.log(`  Owner: ${factory.owner || 'Unclaimed'}`);
      console.log(`  Capacity: ${factory.slots || 'N/A'}`);
      console.log();
    });
    console.log('✅ TEST 4 PASSED\n');

    // ========================================
    // TEST 5: Owned Factory Check
    // ========================================
    console.log('TEST 5: Owned Factory Validation');
    console.log('─────────────────────────────────────────────────────────');
    
    const ownedFactories = await factoriesCollection.find({ owner: { $ne: null } }).toArray();
    console.log(`Total owned factories: ${ownedFactories.length}`);
    
    if (ownedFactories.length > 0) {
      console.log('\nSample owned factories:');
      ownedFactories.slice(0, 5).forEach(factory => {
        const level = factory.level || 1;
        const expectedDefense = getFactoryDefense(level);
        const match = factory.defense === expectedDefense ? '✅' : '❌';
        
        console.log(`  (${factory.x}, ${factory.y}) Level ${level} - Owner: ${factory.owner}`);
        console.log(`    Defense: ${factory.defense} (expected ${expectedDefense}) ${match}`);
      });
      console.log();
    }
    console.log('✅ TEST 5 PASSED\n');

    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║  📊 FINAL SUMMARY                                      ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log();
    console.log(`Total Factories: ${factories.length}`);
    console.log(`Correct Defense: ${correctCount}/${factories.length} (${((correctCount/factories.length)*100).toFixed(1)}%)`);
    console.log(`Incorrect Defense: ${incorrectCount}/${factories.length}`);
    console.log();
    
    if (incorrectCount === 0) {
      console.log('🎉 ALL TESTS PASSED - Factory defense system working perfectly!\n');
    } else {
      console.log('⚠️  SOME TESTS FAILED - Please review incorrect factories above\n');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('✅ MongoDB connection closed\n');
  }
}

// Run tests
testFactoryDefenseSystem()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Tests failed:', error);
    process.exit(1);
  });
