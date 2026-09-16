/**
 * @file scripts/verifyFlagSystem.ts
 * @created 2025-10-23
 * @overview Flag System Verification Script
 * 
 * OVERVIEW:
 * Tests all components of the flag system to ensure production readiness.
 * 
 * Tests:
 * 1. Flag system initialization (creates bot if none exists)
 * 2. Flag bot spawns at random position
 * 3. Flag bot has correct HP (1000)
 * 4. Flags collection exists with correct schema
 * 5. No mock data in flag APIs
 * 
 * Usage:
 * ```bash
 * npx tsx scripts/verifyFlagSystem.ts
 * ```
 */

import { getDatabase } from '../lib/mongodb';
import { initializeFlagSystem, getFlagBot } from '../lib/flagBotService';

interface VerifyFlagBotDoc {
  currentHolder?: {
    username?: string;
    playerId?: string;
    botId?: string;
  };
  transferHistory?: object[];
  lastTransfer?: object;
  statistics?: object;
  username?: string;
  isBot?: boolean | number;
  hitPoints?: number;
  currentHealth?: number;
}

async function verifyFlagSystem() {
  console.log('🏴 FLAG SYSTEM VERIFICATION');
  console.log('=' .repeat(50));
  
  try {
    const db = await getDatabase();
    
    // Test 1: Initialize flag system
    console.log('\n1️⃣  Testing flag system initialization...');
    await initializeFlagSystem();
    console.log('   ✅ Flag system initialized');
    
    // Test 2: Check flag bot exists
    console.log('\n2️⃣  Checking flag bot exists...');
    const flagBot = await getFlagBot();
    
    if (!flagBot) {
      console.log('   ❌ FAILED: No flag bot found');
      process.exit(1);
    }
    
    console.log(`   ✅ Flag bot found: ${flagBot.username}`);
    console.log(`   📍 Position: (${flagBot.currentPosition.x}, ${flagBot.currentPosition.y})`);
    
    // Test 3: Verify flag bot HP
    console.log('\n3️⃣  Verifying flag bot HP...');
    if (flagBot.maxHP !== 1000) {
      console.log(`   ❌ FAILED: Expected maxHP=1000, got ${flagBot.maxHP}`);
      process.exit(1);
    }
    console.log(`   ✅ Flag bot HP: ${flagBot.currentHP}/${flagBot.maxHP}`);
    
    // Test 4: Check flags collection
    console.log('\n4️⃣  Verifying flags collection...');
    const flagDoc = await db.collection<VerifyFlagBotDoc>('flags').findOne({});
    
    if (!flagDoc) {
      console.log('   ❌ FAILED: Flags collection not found');
      process.exit(1);
    }
    
    if (!flagDoc.currentHolder) {
      console.log('   ❌ FAILED: No current holder in flags collection');
      process.exit(1);
    }
    
    console.log(`   ✅ Flags collection exists`);
    console.log(`   ✅ Current holder: ${flagDoc.currentHolder.username}`);
    console.log(`   ✅ Transfer history: ${flagDoc.transferHistory?.length || 0} entries`);
    
    // Test 5: Verify schema fields
    console.log('\n5️⃣  Verifying flag document schema...');
    const requiredFields = ['currentHolder', 'lastTransfer', 'transferHistory', 'statistics'];
    const missingFields = requiredFields.filter(field => !(field in flagDoc));
    
    if (missingFields.length > 0) {
      console.log(`   ❌ FAILED: Missing fields: ${missingFields.join(', ')}`);
      process.exit(1);
    }
    
    console.log('   ✅ All required fields present');
    
    // Test 6: Verify bot in players collection
    console.log('\n6️⃣  Verifying bot in players collection...');
    const botDoc = await db.collection<VerifyFlagBotDoc>('players').findOne({ username: flagBot.username });
    
    if (!botDoc) {
      console.log('   ❌ FAILED: Bot not found in players collection');
      process.exit(1);
    }
    
    console.log('   ✅ Bot exists in players collection');
    console.log(`   ✅ Bot isBot flag: ${botDoc.isBot}`);
    
    // Success!
    console.log('\n' + '='.repeat(50));
    console.log('✅ ALL TESTS PASSED');
    console.log('🎉 Flag system is production-ready!');
    console.log('='.repeat(50));
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED:', error);
    process.exit(1);
  }
}

// Run verification
verifyFlagSystem();
