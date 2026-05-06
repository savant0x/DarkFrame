/**
 * Script to regenerate the game map with correct special locations
 * Run with: node -r dotenv/config scripts/regenerate-map.js dotenv_config_path=.env.local
 */

const { MongoClient } = require('mongodb');

async function regenerateMap() {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    console.error('❌ MONGODB_URI not found in environment');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db('darkframe');
    const tilesCollection = db.collection('tiles');

    // Count existing tiles
    const existingCount = await tilesCollection.countDocuments();
    console.log(`📊 Current tile count: ${existingCount}`);

    // Delete all existing tiles
    console.log('🗑️  Deleting existing tiles...');
    const deleteResult = await tilesCollection.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} tiles`);

    // The map will be regenerated on next server start when mapGeneration.initializeMap() runs
    console.log('✅ Map cleared successfully');
    console.log('🔄 Map will be regenerated on next server request');
    console.log('');
    console.log('Special locations that will be created:');
    console.log('  - (1,1): Shrine of Remembrance');
    console.log('  - (25,25): Metal Bank');
    console.log('  - (50,50): Exchange Bank');
    console.log('  - (75,75): Energy Bank');
    console.log('  - (100,100): Exchange Bank');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('👋 Connection closed');
  }
}

regenerateMap();
