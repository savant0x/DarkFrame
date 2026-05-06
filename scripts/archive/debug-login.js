/**
 * @file scripts/debug-login.js
 * @created 2025-10-31
 * @overview Debug script to test exact login flow
 */

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

async function debugLogin(email, password) {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('\n🔍 DEBUG LOGIN FLOW\n');
    console.log(`Input Email: "${email}"`);
    console.log(`Input Password: "${password}"`);
    console.log(`Password Length: ${password.length} chars\n`);
    
    const db = client.db('darkframe');
    
    // Step 1: Normalize email (same as login route)
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Normalized Email: "${normalizedEmail}"\n`);
    
    // Step 2: Find user by email
    console.log('⏳ Looking up user by email...');
    const player = await db.collection('players').findOne({ 
      email: normalizedEmail 
    });
    
    if (!player) {
      console.error('❌ User not found with that email!');
      console.log('\nTrying to find ANY user with similar email...');
      const similarUser = await db.collection('players').findOne({
        email: new RegExp(email, 'i')
      });
      if (similarUser) {
        console.log(`Found user with email: "${similarUser.email}"`);
        console.log('Email case mismatch?');
      }
      process.exit(1);
    }
    
    console.log(`✅ User found: ${player.username}`);
    console.log(`   Email in DB: "${player.email}"`);
    console.log(`   Has password hash: ${player.password ? 'Yes' : 'No'}\n`);
    
    // Step 3: Verify password
    console.log('⏳ Verifying password...');
    console.log(`   Hash in DB: ${player.password.substring(0, 30)}...`);
    
    const passwordValid = await bcrypt.compare(password, player.password);
    
    if (passwordValid) {
      console.log('✅ ✅ ✅ PASSWORD VERIFICATION SUCCESS! ✅ ✅ ✅');
      console.log('\nLogin SHOULD work. If it doesn\'t, there may be:');
      console.log('1. A caching issue in the Next.js app');
      console.log('2. A middleware intercepting the request');
      console.log('3. A different database being used by the server\n');
    } else {
      console.log('❌ ❌ ❌ PASSWORD VERIFICATION FAILED ❌ ❌ ❌');
      console.log('\nThe password does not match. Double-check:');
      console.log('1. You are typing the exact password (case-sensitive)');
      console.log('2. No extra spaces or characters');
      console.log('3. The password reset completed successfully\n');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('\n❌ Usage: node scripts/debug-login.js <email> <password>\n');
  console.error('Example: node scripts/debug-login.js spencerhowell84@gmail.com MyPassword123\n');
  process.exit(1);
}

debugLogin(email, password);
