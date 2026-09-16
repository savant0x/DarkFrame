/**
 * Reclaim Database Storage Space Script
 * Created: 2025-10-25
 * 
 * PURPOSE:
 * Force MongoDB Atlas to reclaim allocated storage space after mass deletion.
 * 
 * ISSUE:
 * - Deleted 153,706 documents but storageSize still shows 289 MB allocated
 * - MongoDB holds onto allocated space for future writes (fragmentation)
 * - Atlas free tier doesn't support manual compact() command
 * 
 * SOLUTION:
 * Copy all remaining documents to temporary collection, drop original, rename temp back.
 * This forces MongoDB to allocate only needed space.
 * 
 * USAGE:
 * npx ts-node -r dotenv/config scripts/reclaim-database-space.ts dotenv_config_path=.env.local
 */

import { MongoClient } from 'mongodb';

async function reclaimSpace() {
  console.log('🔄 [STORAGE RECLAIM] Starting space reclamation process...\n');
  
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in environment');
    process.exit(1);
  }
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('darkframe');
    
    // Get storage stats BEFORE
    console.log('📊 Storage Stats BEFORE:');
    const statsBefore = await db.command({ collStats: 'players' });
    const storageMB = (statsBefore.storageSize / 1024 / 1024).toFixed(2);
    const dataMB = (statsBefore.size / 1024 / 1024).toFixed(2);
    const wastedMB = (parseFloat(storageMB) - parseFloat(dataMB)).toFixed(2);
    
    console.log(`   Data Size: ${dataMB} MB (actual data)`);
    console.log(`   Storage Size: ${storageMB} MB (allocated space)`);
    console.log(`   Wasted Space: ${wastedMB} MB (fragmentation)\n`);
    
    if (parseFloat(wastedMB) < 10) {
      console.log('✅ Less than 10 MB wasted - no reclamation needed');
      await client.close();
      process.exit(0);
    }
    
    // Count documents to verify
    const docCount = await db.collection('players').countDocuments({});
    console.log(`📋 Documents to migrate: ${docCount}\n`);
    
    // Step 1: Copy all documents to temporary collection
    console.log('📦 Step 1/4: Copying documents to temporary collection...');
    const allDocs = await db.collection('players').find({}).toArray();
    
    if (allDocs.length > 0) {
      await db.collection('players_temp').insertMany(allDocs);
      console.log(`✅ Copied ${allDocs.length} documents to players_temp\n`);
    } else {
      console.log('⚠️  No documents to copy\n');
    }
    
    // Step 2: Get all indexes from original collection
    console.log('🔍 Step 2/4: Backing up indexes...');
    const indexes = await db.collection('players').indexes();
    console.log(`✅ Found ${indexes.length} indexes to recreate\n`);
    
    // Step 3: Drop original collection (releases storage)
    console.log('🗑️  Step 3/4: Dropping original collection to release storage...');
    await db.collection('players').drop();
    console.log('✅ Original collection dropped\n');
    
    // Step 4: Rename temp collection back to original
    console.log('🔄 Step 4/4: Renaming temporary collection back to "players"...');
    await db.collection('players_temp').rename('players');
    console.log('✅ Collection renamed successfully\n');
    
    // Recreate indexes (except _id which is automatic)
    console.log('🔧 Recreating indexes...');
    for (const index of indexes) {
      if (index.name === '_id_') continue; // Skip default _id index
      
      try {
        await db.collection('players').createIndex(
          index.key,
          {
            name: index.name,
            unique: index.unique || false,
            sparse: index.sparse || false,
          }
        );
        console.log(`   ✅ Recreated index: ${index.name}`);
      } catch (error) {
        console.warn(`   ⚠️  Failed to recreate index ${index.name}:`, error);
      }
    }
    console.log('');
    
    // Get storage stats AFTER
    console.log('📊 Storage Stats AFTER:');
    const statsAfter = await db.command({ collStats: 'players' });
    const newStorageMB = (statsAfter.storageSize / 1024 / 1024).toFixed(2);
    const newDataMB = (statsAfter.size / 1024 / 1024).toFixed(2);
    const reclaimedMB = (parseFloat(storageMB) - parseFloat(newStorageMB)).toFixed(2);
    
    console.log(`   Data Size: ${newDataMB} MB`);
    console.log(`   Storage Size: ${newStorageMB} MB`);
    console.log(`   Reclaimed: ${reclaimedMB} MB\n`);
    
    // Verify document count
    const finalCount = await db.collection('players').countDocuments({});
    if (finalCount === docCount) {
      console.log('✅ SUCCESS! All documents preserved');
      console.log(`✅ ${reclaimedMB} MB of storage space reclaimed`);
      console.log('✅ Database compaction complete\n');
    } else {
      console.error(`❌ Document count mismatch! Before: ${docCount}, After: ${finalCount}`);
      process.exit(1);
    }
    
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Storage reclamation failed:', error);
    
    // Attempt cleanup if temp collection exists
    try {
      const db = client.db('darkframe');
      const collections = await db.listCollections({ name: 'players_temp' }).toArray();
      if (collections.length > 0) {
        console.log('\n🧹 Cleaning up temporary collection...');
        await db.collection('players_temp').drop();
        console.log('✅ Cleanup complete');
      }
    } catch (cleanupError) {
      console.error('❌ Cleanup failed:', cleanupError);
    }
    
    await client.close();
    process.exit(1);
  }
}

reclaimSpace();
