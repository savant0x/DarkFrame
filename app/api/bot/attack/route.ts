/**
 * @file app/api/bot/attack/route.ts
 * @overview Bot base attack — player attacks a bot/beer base at their tile.
 * Uses the factory/base attack power calculation (rank, STR, factory count)
 * vs bot's total STR+DEF. Enforces 24h cooldown and logs battles.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import { calculatePlayerPower } from '@/lib/factoryService';
import { awardXP, XPAction } from '@/lib/xpService';
import { logger } from '@/lib';

const BOT_ATTACK_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.username;

    const supabase = createServiceClient();

    // Get player position and resources
    const { data: player } = await supabase
      .from('players')
      .select('current_x, current_y, resources_metal, resources_energy')
      .eq('username', username)
      .maybeSingle();

    if (!player) {
      return NextResponse.json({ success: false, message: 'Player not found' }, { status: 404 });
    }

    // Find bot at player's position
    const { data: bot } = await supabase
      .from('players')
      .select('*')
      .eq('is_bot', true)
      .eq('current_x', player.current_x)
      .eq('current_y', player.current_y)
      .maybeSingle();

    if (!bot) {
      return NextResponse.json({ success: false, message: 'No bot at this location' }, { status: 404 });
    }

    // Check player has army (must have total_strength or total_defense > 0)
    if (!bot.total_strength && !bot.total_defense) {
      return NextResponse.json({ success: false, message: 'This bot has no defenses.' }, { status: 400 });
    }

    // Cooldown check
    const { data: recentBattle } = await supabase
      .from('battle_logs')
      .select('created_at')
      .eq('attacker_username', username)
      .eq('defender_username', bot.username)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentBattle?.created_at) {
      const timeSince = Date.now() - new Date(recentBattle.created_at).getTime();
      if (timeSince < BOT_ATTACK_COOLDOWN_MS) {
        const hoursLeft = Math.ceil((BOT_ATTACK_COOLDOWN_MS - timeSince) / 3600000);
        return NextResponse.json({
          success: false, message: `Already attacked this bot. Wait ${hoursLeft}h before attacking again.`,
        }, { status: 429 });
      }
    }

    // Calculate player's base attack power (same formula as factory attacks)
    const playerPower = await calculatePlayerPower(username);
    if (playerPower <= 0) {
      return NextResponse.json({ success: false, message: 'Your army is too weak to attack. Build more units first.' }, { status: 400 });
    }

    // Bot defense = total_strength + total_defense
    const botDefense = (bot.total_strength || 0) + (bot.total_defense || 0);

    // Combat resolution with randomness (same as factory attack pattern)
    const playerRoll = playerPower * (0.85 + Math.random() * 0.3);
    const botRoll = botDefense * (0.85 + Math.random() * 0.3);
    const playerWins = playerRoll > botRoll;

    // Log battle
    const now = new Date().toISOString();
    await supabase.from('battle_logs').insert({
      attacker_username: username,
      defender_username: bot.username,
      attacker_strength: Math.floor(playerRoll),
      defender_defense: Math.floor(botRoll),
      damage_dealt: Math.floor(Math.abs(playerRoll - botRoll)),
      outcome: playerWins ? 'attacker_win' : 'defender_win',
      resources_stolen: null,
      created_at: now,
    });

    if (playerWins) {
      await awardXP(username, XPAction.FACTORY_CAPTURE);

      // ISSUE-035 fix: Re-read player resources from DB to avoid stale reads
      const { data: freshPlayer } = await supabase
        .from('players')
        .select('resources_metal, resources_energy')
        .eq('username', username)
        .maybeSingle();

      // Loot 50% of bot's resources
      const metalLoot = Math.floor((bot.resources_metal || 0) * 0.5);
      const energyLoot = Math.floor((bot.resources_energy || 0) * 0.5);

      await supabase.from('players').update({
        resources_metal: ((freshPlayer?.resources_metal ?? player.resources_metal) || 0) + metalLoot,
        resources_energy: ((freshPlayer?.resources_energy ?? player.resources_energy) || 0) + energyLoot,
      }).eq('username', username);

      if (bot.is_special_base) {
        // ISSUE-036 fix: Clean up related rows before deleting the bot player row
        await supabase.from('player_units').delete().eq('player_username', bot.username);
        await supabase.from('bots').delete().eq('username', bot.username);
        await supabase.from('players').delete().eq('username', bot.username);
      }

      return NextResponse.json({
        success: true, victory: true,
        message: `Victory! Defeated ${bot.username}!`,
        rewards: { metal: metalLoot, energy: energyLoot },
        playerPower: Math.floor(playerRoll), botPower: Math.floor(botRoll),
      });
    } else {
      await awardXP(username, XPAction.INFANTRY_ATTACK_LOSS);

      return NextResponse.json({
        success: true, victory: false,
        message: `Defeated by ${bot.username}!`,
        playerPower: Math.floor(playerRoll), botPower: Math.floor(botRoll),
      });
    }
  } catch (error) {
    logger.error('Bot attack error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
