/**
 * @file scripts/simple-reset-password.js
 * @created 2025-10-31
 * @overview Simple script to reset user password (JavaScript for easier env loading)
 */

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

async function resetPassword(username, newPassword) {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    console.log('\n🔐 Password Reset Utility\n');
    console.log(`Target User: ${username}`);
    console.log(`New Password: ${'*'.repeat(newPassword.length)}\n`);
    
    await client.connect();
    
    // Hash the new password
    console.log('⏳ Hashing password...');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('✅ Password hashed successfully');
    
    // Update the database
    console.log('⏳ Updating database...');
    const db = client.db('darkframe');
    const result = await db.collection('players').updateOne(
      { username },
      { $set: { password: hashedPassword } }
    );
    
    if (result.matchedCount === 0) {
      console.error(`❌ Error: User "${username}" not found in database`);
      process.exit(1);
    }
    
    if (result.modifiedCount === 0) {
      console.warn(`⚠️  Warning: Password was not changed (may already be set to this value)`);
    } else {
      console.log(`✅ Password updated successfully for user "${username}"`);
    }
    
    console.log('\n✨ Password reset complete!\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

const [username, newPassword] = process.argv.slice(2);

if (!username || !newPassword) {
  console.error('\n❌ Usage: node scripts/simple-reset-password.js <username> <new-password>\n');
  console.error('Example: node scripts/simple-reset-password.js FAME mynewpassword123\n');
  process.exit(1);
}

if (newPassword.length < 6) {
  console.error('\n❌ Password must be at least 6 characters long\n');
  process.exit(1);
}

resetPassword(username, newPassword);
