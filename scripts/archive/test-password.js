/**
 * @file scripts/test-password.js
 * @created 2025-10-31
 * @overview Test if password verification is working
 */

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

async function testPassword(username, testPassword) {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('\n🔐 Password Verification Test\n');
    console.log(`Username: ${username}`);
    console.log(`Testing Password: ${testPassword}\n`);
    
    const db = client.db('darkframe');
    const user = await db.collection('players').findOne({ username });
    
    if (!user) {
      console.error(`❌ User "${username}" not found`);
      process.exit(1);
    }
    
    console.log(`✅ User found: ${user.email}`);
    console.log(`✅ Password hash exists: ${user.password ? 'Yes' : 'No'}`);
    console.log(`   Hash preview: ${user.password.substring(0, 20)}...`);
    
    // Test password verification
    console.log('\n⏳ Testing password verification...');
    const isValid = await bcrypt.compare(testPassword, user.password);
    
    if (isValid) {
      console.log('✅ ✅ ✅ PASSWORD MATCHES! ✅ ✅ ✅\n');
    } else {
      console.log('❌ ❌ ❌ PASSWORD DOES NOT MATCH ❌ ❌ ❌\n');
      console.log('The password in the database does not match what you entered.');
      console.log('This could mean:');
      console.log('1. The password reset did not work');
      console.log('2. There is a different password stored');
      console.log('3. The hash is corrupted\n');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

const [inputUsername, inputPassword] = process.argv.slice(2);

if (!inputUsername || !inputPassword) {
  console.error('\n❌ Usage: node scripts/test-password.js <username> <password>\n');
  process.exit(1);
}

testPassword(inputUsername, inputPassword);
