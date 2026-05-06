/**
 * @file scripts/validate-referrals-cron.ts
 * @created 2025-10-24
 * @overview Daily cron job for automatic referral validation
 * 
 * OVERVIEW:
 * Automated script that runs daily to check pending referrals for validation.
 * Validates referrals that meet criteria (7 days + 4 logins) and distributes rewards.
 * Invalidates referrals that exceed 7 days without meeting login requirement.
 * 
 * Validation Criteria:
 * - Referral must be at least 7 days old
 * - Referred player must have 4+ logins
 * - Referral must not be flagged
 * - Rewards not already distributed
 * 
 * Schedule: Run daily at 3:00 AM UTC
 * Command: node --loader ts-node/esm scripts/validate-referrals-cron.ts
 * 
 * Dependencies: Supabase, referralService
 */

import { createServiceClient } from '../../lib/supabase/server';
import { validateReferral } from '../../lib/referralService';

/**
 * Configuration
 */
const VALIDATION_PERIOD_DAYS = 7;
const REQUIRED_LOGINS = 4;

/**
 * Main validation function
 * Processes all pending referrals and validates/invalidates based on criteria
 */
async function runValidation() {
  const supabase = createServiceClient();

  try {
    console.log('🔄 Starting referral validation cron job...');
    console.log(`⏰ ${new Date().toISOString()}`);

    // Calculate cutoff date (7 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - VALIDATION_PERIOD_DAYS);

    console.log(`📅 Cutoff date: ${cutoffDate.toISOString()}`);

    // Find pending referrals older than 7 days
    const { data: pendingReferrals, error: findError } = await (supabase
      .from('referrals') as any)
      .select('*')
      .eq('status', 'pending')
      .lte('created_at', cutoffDate.toISOString())
      .neq('flagged', true)
      .neq('rewards_distributed', true);

    if (findError) throw findError;

    console.log(`📊 Found ${pendingReferrals.length} pending referrals to process`);

    let validated = 0;
    let invalidated = 0;
    let errors = 0;

    // Process each referral
    for (const referral of pendingReferrals) {
      try {
        const loginCount = referral.login_count || 0;

        if (loginCount >= REQUIRED_LOGINS) {
          // Validate and distribute rewards
          console.log(`✅ Validating referral: ${(referral as any).referred_username} (${loginCount} logins)`);

          const result = await validateReferral(referral.id);

          if (result) {
            validated++;
            console.log(`   💰 Rewards distributed to ${referral.referrer_username}`);
          } else {
            errors++;
            console.error(`   ❌ Failed to distribute rewards`);
          }
        } else {
          // Invalidate (didn't meet login requirement in time)
          console.log(`❌ Invalidating referral: ${(referral as any).referred_username} (only ${loginCount} logins)`);

          await (supabase
            .from('referrals') as any)
            .update({
              status: 'invalid',
              invalidated_at: new Date().toISOString(),
              invalidation_reason: `Insufficient logins (${loginCount}/${REQUIRED_LOGINS}) within ${VALIDATION_PERIOD_DAYS} days`
            })
            .eq('id', referral.id);

          invalidated++;
        }
      } catch (error) {
        errors++;
        console.error(`❌ Error processing referral ${referral.id}:`, error);
      }
    }

    // Summary
    console.log('\n📈 Validation Summary:');
    console.log(`   ✅ Validated: ${validated}`);
    console.log(`   ❌ Invalidated: ${invalidated}`);
    console.log(`   🚨 Errors: ${errors}`);
    console.log(`   📊 Total Processed: ${pendingReferrals.length}`);

    // Log statistics
    const statuses = ['pending', 'valid', 'invalid', 'flagged'];
    console.log('\n📊 Current Referral Statistics:');
    for (const status of statuses) {
      const { count, error: countError } = await (supabase
        .from('referrals') as any)
        .select('*', { count: 'exact', head: true })
        .eq('status', status);
      if (!countError) {
        console.log(`   ${status}: ${count}`);
      }
    }

    console.log('\n✅ Cron job completed successfully');
  } catch (error) {
    console.error('❌ Fatal error in validation cron job:', error);
    process.exit(1);
  }
}

/**
 * Execute validation with error handling
 */
runValidation()
  .then(() => {
    console.log('✅ Exiting...');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// USAGE:
// - Run manually: ts-node scripts/validate-referrals-cron.ts
// - Schedule with cron: 0 3 * * * cd /path/to/app && npm run validate-referrals
// 
// PACKAGE.JSON SCRIPT:
// "scripts": {
//   "validate-referrals": "ts-node scripts/validate-referrals-cron.ts"
// }
// 
// CRONTAB EXAMPLE (3 AM daily):
// 0 3 * * * cd /home/darkframe && npm run validate-referrals >> /var/log/darkframe-cron.log 2>&1
// 
// DEPLOYMENT:
// - For production, use a proper job scheduler (Vercel Cron, AWS EventBridge, etc.)
// - Ensure Supabase environment variables are set
// - Monitor logs for errors and statistics
// - Consider adding Slack/Discord webhook notifications for failures
// 
// TESTING:
// - Test with mock data in development environment
// - Verify reward distribution doesn't cause duplicate rewards
// - Check that flagged referrals are skipped
// - Ensure idempotency (safe to run multiple times)
// ============================================================
