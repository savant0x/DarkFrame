/**
 * MongoDB Indexes Setup - Messaging System
 * Created: 2025-10-25
 * Feature: FID-20251025-102
 * 
 * OVERVIEW:
 * Automated script to create optimized MongoDB indexes for the messaging system.
 * Improves query performance for conversation lookups, message retrieval,
 * and real-time features.
 * 
 * INDEXES CREATED:
 * 
 * conversations collection:
 * 1. participants (array index) - Fast conversation lookup by user
 * 2. participants + updatedAt (compound) - Sorted conversation lists
 * 
 * messages collection:
 * 1. conversationId + createdAt (compound) - Message history pagination
 * 2. senderId + recipientId (compound) - Direct message queries
 * 3. status (single field) - Unread message filtering
 * 4. createdAt (single field) - Time-based queries
 * 
 * USAGE:
 * node scripts/setup-messaging-indexes.js
 * 
 * REQUIREMENTS:
 * - MongoDB connection string in .env.local (MONGODB_URI)
 * - mongodb package installed (npm install mongodb)
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Load environment variables from .env.local
 */
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ Error: .env.local file not found');
    console.error('   Please create .env.local with MONGODB_URI variable');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};

  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      envVars[key.trim()] = value;
    }
  });

  return envVars;
}

const env = loadEnvFile();
const MONGODB_URI = env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in .env.local');
  process.exit(1);
}

// ============================================================================
// INDEX DEFINITIONS
// ============================================================================

const CONVERSATIONS_INDEXES = [
  {
    name: 'participants_1',
    key: { participants: 1 },
    options: {
      name: 'participants_index',
      background: true,
    },
    description: 'Fast lookup of conversations by participant username',
  },
  {
    name: 'participants_updatedAt',
    key: { participants: 1, updatedAt: -1 },
    options: {
      name: 'participants_updated_index',
      background: true,
    },
    description: 'Sorted conversation list for a user (most recent first)',
  },
  {
    name: 'updatedAt_desc',
    key: { updatedAt: -1 },
    options: {
      name: 'updated_at_index',
      background: true,
    },
    description: 'General time-based sorting',
  },
];

const MESSAGES_INDEXES = [
  {
    name: 'conversationId_createdAt',
    key: { conversationId: 1, createdAt: -1 },
    options: {
      name: 'conversation_messages_index',
      background: true,
    },
    description: 'Message history pagination (newest first)',
  },
  {
    name: 'senderId_recipientId',
    key: { senderId: 1, recipientId: 1 },
    options: {
      name: 'sender_recipient_index',
      background: true,
    },
    description: 'Direct message queries between two users',
  },
  {
    name: 'status',
    key: { status: 1 },
    options: {
      name: 'status_index',
      background: true,
      sparse: true,
    },
    description: 'Filter messages by status (sent, delivered, read)',
  },
  {
    name: 'createdAt_desc',
    key: { createdAt: -1 },
    options: {
      name: 'created_at_index',
      background: true,
    },
    description: 'Time-based message queries',
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Ensure collection exists (create if needed)
 */
async function ensureCollectionExists(db, collectionName) {
  const collections = await db.listCollections({ name: collectionName }).toArray();
  
  if (collections.length === 0) {
    console.log(`   📦 Creating collection "${collectionName}"...`);
    await db.createCollection(collectionName);
    console.log(`   ✅ Collection created\n`);
    return true;
  }
  
  console.log(`   ✓ Collection "${collectionName}" exists\n`);
  return false;
}

/**
 * Check if index already exists
 */
async function indexExists(collection, indexName) {
  try {
    const indexes = await collection.indexes();
    return indexes.some(idx => idx.name === indexName);
  } catch (error) {
    // Collection might not exist yet
    return false;
  }
}

/**
 * Create index with error handling
 */
async function createIndexSafely(collection, indexDef) {
  const indexName = indexDef.options.name;
  
  try {
    // Check if already exists
    const exists = await indexExists(collection, indexName);
    if (exists) {
      console.log(`   ⏭️  Index "${indexName}" already exists - skipping`);
      return { success: true, skipped: true };
    }

    // Create index
    await collection.createIndex(indexDef.key, indexDef.options);
    console.log(`   ✅ Created index "${indexName}"`);
    console.log(`      ${indexDef.description}`);
    return { success: true, created: true };
  } catch (error) {
    console.error(`   ❌ Failed to create index "${indexName}":`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Verify index was created successfully
 */
async function verifyIndex(collection, indexName) {
  const exists = await indexExists(collection, indexName);
  if (exists) {
    console.log(`   ✓ Verified: ${indexName}`);
    return true;
  } else {
    console.error(`   ✗ Missing: ${indexName}`);
    return false;
  }
}

// ============================================================================
// MAIN SETUP FUNCTION
// ============================================================================

async function setupMessagingIndexes() {
  console.log('\n🚀 MongoDB Messaging Indexes Setup\n');
  console.log('=' .repeat(60));
  
  let client;
  const results = {
    conversations: { created: 0, skipped: 0, failed: 0 },
    messages: { created: 0, skipped: 0, failed: 0 },
  };

  try {
    // Connect to MongoDB
    console.log('\n📡 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected successfully\n');

    const db = client.db();
    
    // Ensure collections exist
    console.log('📦 Checking collections...\n');
    await ensureCollectionExists(db, 'conversations');
    await ensureCollectionExists(db, 'messages');
    
    const conversationsCollection = db.collection('conversations');
    const messagesCollection = db.collection('messages');

    // Create Conversations Indexes
    console.log('📋 Creating CONVERSATIONS indexes...\n');
    for (const indexDef of CONVERSATIONS_INDEXES) {
      const result = await createIndexSafely(conversationsCollection, indexDef);
      if (result.created) results.conversations.created++;
      if (result.skipped) results.conversations.skipped++;
      if (!result.success) results.conversations.failed++;
    }

    // Create Messages Indexes
    console.log('\n📋 Creating MESSAGES indexes...\n');
    for (const indexDef of MESSAGES_INDEXES) {
      const result = await createIndexSafely(messagesCollection, indexDef);
      if (result.created) results.messages.created++;
      if (result.skipped) results.messages.skipped++;
      if (!result.success) results.messages.failed++;
    }

    // Verify All Indexes
    console.log('\n🔍 Verifying indexes...\n');
    
    console.log('Conversations collection:');
    let allVerified = true;
    for (const indexDef of CONVERSATIONS_INDEXES) {
      const verified = await verifyIndex(conversationsCollection, indexDef.options.name);
      if (!verified) allVerified = false;
    }

    console.log('\nMessages collection:');
    for (const indexDef of MESSAGES_INDEXES) {
      const verified = await verifyIndex(messagesCollection, indexDef.options.name);
      if (!verified) allVerified = false;
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 SUMMARY\n');
    console.log(`Conversations Indexes:`);
    console.log(`  ✅ Created: ${results.conversations.created}`);
    console.log(`  ⏭️  Skipped: ${results.conversations.skipped}`);
    console.log(`  ❌ Failed:  ${results.conversations.failed}`);
    
    console.log(`\nMessages Indexes:`);
    console.log(`  ✅ Created: ${results.messages.created}`);
    console.log(`  ⏭️  Skipped: ${results.messages.skipped}`);
    console.log(`  ❌ Failed:  ${results.messages.failed}`);

    const totalCreated = results.conversations.created + results.messages.created;
    const totalFailed = results.conversations.failed + results.messages.failed;

    if (totalFailed > 0) {
      console.log('\n⚠️  Some indexes failed to create. Check errors above.');
      process.exit(1);
    } else if (totalCreated === 0) {
      console.log('\n✨ All indexes already exist - nothing to do!');
    } else {
      console.log(`\n✨ Successfully created ${totalCreated} new indexes!`);
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n❌ Fatal Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n👋 MongoDB connection closed\n');
    }
  }
}

// ============================================================================
// EXECUTE
// ============================================================================

setupMessagingIndexes()
  .then(() => {
    console.log('✅ Index setup completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Index setup failed:', error);
    process.exit(1);
  });

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Environment Loading:
 *    - Manually parses .env.local (no dotenv dependency)
 *    - Validates MONGODB_URI presence
 *    - Fails fast if configuration missing
 * 
 * 2. Index Strategy:
 *    - All indexes created with background: true (non-blocking)
 *    - Sparse indexes for optional fields (status)
 *    - Compound indexes for common query patterns
 *    - Descending sort (-1) for "newest first" queries
 * 
 * 3. Error Handling:
 *    - Checks if index exists before creating
 *    - Continues on individual failures
 *    - Verifies all indexes after creation
 *    - Detailed error reporting
 * 
 * 4. Performance Considerations:
 *    - participants array index for conversation lookup
 *    - conversationId + createdAt for paginated history
 *    - senderId + recipientId for direct messages
 *    - status index for unread filtering
 * 
 * 5. Index Benefits:
 *    - 10-100x faster conversation queries
 *    - Efficient message history pagination
 *    - Fast unread message counts
 *    - Optimized real-time features
 * 
 * MAINTENANCE:
 * - Run this script after deploying messaging system
 * - Re-run if indexes are accidentally dropped
 * - Safe to run multiple times (idempotent)
 * - Monitor index usage with MongoDB Atlas or explain()
 */
