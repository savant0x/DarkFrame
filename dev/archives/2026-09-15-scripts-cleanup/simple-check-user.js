/**
 * @file scripts/simple-check-user.js
 * @created 2025-10-31
 * @overview Simple script to check user account (JavaScript for easier env loading)
 */

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkUser(username) {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('\n👤 User Account Information\n');
    
    const db = client.db('darkframe');
    const user = await db.collection('players').findOne(
      { username },
      {
        projection: {
          username: 1,
          email: 1,
          level: 1,
          isAdmin: 1,
          lastActive: 1,
          createdAt: 1,
          currentPosition: 1
        }
      }
    );
    
    if (!user) {
      console.error(`❌ User "${username}" not found in database\n`);
      process.exit(1);
    }
    
    console.log(`Username:     ${user.username}`);
    console.log(`Email:        ${user.email}`);
    console.log(`Level:        ${user.level || 1}`);
    console.log(`Admin:        ${user.isAdmin ? 'Yes ✓' : 'No'}`);
    console.log(`Position:     (${user.currentPosition?.x || 0}, ${user.currentPosition?.y || 0})`);
    console.log(`Last Active:  ${user.lastActive ? new Date(user.lastActive).toLocaleString() : 'Never'}`);
    console.log(`Created:      ${user.createdAt ? new Date(user.createdAt).toLocaleString() : 'Unknown'}`);
    console.log();
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

const username = process.argv[2];
if (!username) {
  console.error('\n❌ Usage: node scripts/simple-check-user.js <username>\n');
  process.exit(1);
}

checkUser(username);
