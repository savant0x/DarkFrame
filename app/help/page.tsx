/**
 * @file app/help/page.tsx
 * @created 2025-10-18
 * @last-modified 2026-09-08 (FID-20260908-012 neon-noir structural pass)
 * @overview Game help and tutorial page
 *
 * OVERVIEW:
 * Comprehensive help page with controls, gameplay mechanics, tips, and guides.
 *
 * FID-20260908-012 — STYLING:
 * Token primitives only (nn-panel / nn-table / nn-well / nn-kbd / nn-num);
 * legacy bg-glass and text-text utility families and decorative gradients
 * removed.
 *
 * FID-20260908-012 — KEYBOARD REFERENCE PROVENANCE:
 * Every binding below was verified against the live handlers on 2026-09-08:
 *   - types/hotkey.types.ts  (DEFAULT_HOTKEYS — panel/view/resource/combat keys)
 *   - app/game/page.tsx      (keydown handler — in-page key dispatch)
 *   - components/MovementControls.tsx (compass layout + titles)
 *   - components/DiscoveryLogPanel.tsx, SpecializationPanel.tsx (panel-local Shift+D / Shift+P)
 * If a binding changes, update the source of truth first, then this table.
 * INVARIANT (lib/hotkeyRegistry.ts): qweasdzxc are RESERVED for movement;
 * displaced actions bind as Shift+letter (or a free bare letter).
 */

'use client';

import React from 'react';
import BackButton from '@/components/BackButton';

/** Verified keycap row: action label + key glyph(s). */
const KEY_ROWS: Record<string, Array<[string, string]>> = {
  movement: [
    ['Northwest / North / Northeast', 'Q · W · E'],
    ['West / East', 'A · D'],
    ['Southwest / South / Southeast', 'Z · X · C'],
    ['Arrow keys / numpad', '↑←↓→ / 789 456 123'],
  ],
  actions: [
    ['Harvest Metal/Energy', 'G'],
    ['Explore Cave/Forest', 'F'],
    ['Attack Factory', 'R'],
    ['Open Bank (at Bank tile)', 'B'],
    ['Visit Shrine (at Shrine)', 'N'],
  ],
  panels: [
    ['Build Units', 'U'],
    ['Manage Factory', 'M'],
    ['Specialization', 'Shift+P'],
    ['Tier Unlock', 'T'],
    ['Inventory', 'I'],
    ['Discovery Log', 'Shift+D'],
    ['Achievements', 'V'],
    ['Auction House', 'H'],
  ],
  views: [
    ['Clan View', 'Shift+C'],
    ['Clan Leaderboards', 'L'],
    ['Player Leaderboard', 'P'],
    ['Bounty Board', 'O'],
    ['Bot Magnet', 'J'],
    ['Bot Summoning', 'Y'],
    ['Beer Bases', 'Shift+E'],
    ['Bot Scanner', 'Shift+X'],
    ['Close Panel', 'ESC'],
  ],
  autofarm: [
    ['Start / Pause / Resume', 'Shift+F'],
    ['Stop Session', 'Shift+R'],
    ['Toggle Statistics', 'Shift+S'],
  ],
};

function KeyTable({ rows }: { rows: Array<[string, string]> }) {
  return (
    <table className="nn-table">
      <tbody>
        {rows.map(([action, keys]) => (
          <tr key={action}>
            <td className="nn-table__dim">{action}</td>
            <td className="text-right">
              {keys.split(' · ').map((combo) => (
                <kbd key={combo} className="nn-kbd ml-1 first:ml-0">
                  {combo}
                </kbd>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function HelpPage() {
  return (
    <div
      className="min-h-screen text-[color:var(--nn-text-primary)]"
      style={{ background: 'var(--nn-void)' }}
    >
      <div className="max-w-5xl mx-auto p-8">
        <BackButton />

        <h1 className="nn-num nn-text-cyan text-4xl font-bold mb-8 mt-4 tracking-wider">
          GAME GUIDE &amp; HELP
        </h1>

        <div className="space-y-6">
          {/* Quick Start */}
          <div className="nn-panel">
            <div className="nn-panel__header">
              <span className="nn-panel__title">Quick Start</span>
              <span className="nn-panel__meta">Five steps to your first army</span>
            </div>
            <div className="nn-panel__body space-y-2 text-sm text-[color:var(--nn-text-primary)]">
              <p>1. <strong>Move around the map</strong> using keyboard controls (QWEASDZXC or arrow keys)</p>
              <p>2. <strong>Gather resources</strong> by pressing <kbd className="nn-kbd">G</kbd> on Metal/Energy tiles</p>
              <p>3. <strong>Build units</strong> at your base by pressing <kbd className="nn-kbd">U</kbd></p>
              <p>4. <strong>Explore caves/forests</strong> by pressing <kbd className="nn-kbd">F</kbd> for rare items</p>
              <p>5. <strong>Upgrade your base</strong> by gaining XP through gathering and battles</p>
            </div>
          </div>

          {/* Keyboard Controls — verified against DEFAULT_HOTKEYS + page.tsx handlers */}
          <div className="nn-panel">
            <div className="nn-panel__header">
              <span className="nn-panel__title">Keyboard Controls</span>
              <span className="nn-panel__meta">Movement keys qweasdzxc are reserved — displaced actions use Shift</span>
            </div>
            <div className="nn-panel__body grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="nn-lab nn-text-cyan mb-2 uppercase">Movement</h3>
                <KeyTable rows={KEY_ROWS.movement} />
              </div>

              <div>
                <h3 className="nn-lab nn-text-amber mb-2 uppercase">Actions</h3>
                <KeyTable rows={KEY_ROWS.actions} />
              </div>

              <div>
                <h3 className="nn-lab nn-text-violet mb-2 uppercase">Panels</h3>
                <KeyTable rows={KEY_ROWS.panels} />
              </div>

              <div>
                <h3 className="nn-lab nn-text-green mb-2 uppercase">Views &amp; Navigation</h3>
                <KeyTable rows={KEY_ROWS.views} />
              </div>

              <div className="md:col-span-2">
                <h3 className="nn-lab nn-text-magenta mb-2 uppercase">Auto-Farm (Premium)</h3>
                <KeyTable rows={KEY_ROWS.autofarm} />
              </div>
            </div>
          </div>

          {/* Auto-Farm System */}
          <div className="nn-panel nn-panel--violet">
            <div className="nn-panel__header nn-panel__header--violet">
              <span className="nn-panel__title">Auto-Farm System</span>
              <span className="nn-panel__meta">Premium feature</span>
            </div>

            <div className="nn-panel__body space-y-4">
              <div>
                <h3 className="nn-lab nn-text-violet mb-2 uppercase">What is Auto-Farm?</h3>
                <p className="text-sm text-[color:var(--nn-text-primary)]">
                  Auto-Farm is an automated map traversal system that explores the entire 150x150 map in a snake pattern,
                  automatically harvesting resources, exploring caves/forests, and optionally engaging in combat with other players.
                </p>
              </div>

              <div>
                <h3 className="nn-lab nn-text-violet mb-2 uppercase">How It Works</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-[color:var(--nn-text-primary)] ml-4">
                  <li><strong>Snake Pattern:</strong> Moves left-to-right on odd rows, right-to-left on even rows</li>
                  <li><strong>Complete Coverage:</strong> Visits all 22,500 tiles on the map systematically</li>
                  <li><strong>Auto-Harvest:</strong> Automatically harvests Metal, Energy, Caves, and Forests</li>
                  <li><strong>Statistics Tracking:</strong> Session and all-time stats with detailed metrics</li>
                  <li><strong>Human-Like Speed:</strong> ~900ms between movements</li>
                </ul>
              </div>

              <div>
                <h3 className="nn-lab nn-text-violet mb-2 uppercase">Combat Options</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-[color:var(--nn-text-primary)] ml-4">
                  <li><strong>Attack Players:</strong> Toggle on/off in settings</li>
                  <li><strong>Rank Filter:</strong> Attack All, Lower Rank, or Higher Rank players</li>
                  <li><strong>Resource Target:</strong> Target players based on what YOU need most (Metal/Energy/Lowest)</li>
                  <li><strong>Unit Selection:</strong> Automatically selects strongest units for efficiency</li>
                  <li><strong>Note:</strong> &quot;Lowest&quot; option targets players when YOUR metal/energy is low</li>
                </ul>
              </div>

              <div>
                <h3 className="nn-lab nn-text-violet mb-2 uppercase">Controls</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-[color:var(--nn-text-primary)] ml-4">
                  <li><strong>Start:</strong> Begin auto-farming from current position</li>
                  <li><strong>Pause:</strong> Temporarily halt auto-farm (keeps progress)</li>
                  <li><strong>Resume:</strong> Continue from last position</li>
                  <li><strong>Stop:</strong> End session and merge stats to all-time totals</li>
                  <li><strong>Settings:</strong> Configure combat options and preferences</li>
                </ul>
              </div>

              <div>
                <h3 className="nn-lab nn-text-violet mb-2 uppercase">Statistics Tracked</h3>
                <div className="grid grid-cols-2 gap-2 text-sm text-[color:var(--nn-text-primary)]">
                  <div>• Time Elapsed</div>
                  <div>• Metal Collected</div>
                  <div>• Energy Collected</div>
                  <div>• Tiles Visited</div>
                  <div>• Cave Items Found</div>
                  <div>• Forest Items Found</div>
                  <div>• Attacks Launched</div>
                  <div>• Battles Won</div>
                  <div>• Battles Lost</div>
                  <div>• Win Rate</div>
                </div>
              </div>

              <div className="nn-well items-start">
                <h3 className="nn-lab nn-text-amber mb-2 uppercase">Important Notes</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-[color:var(--nn-text-primary)] ml-4">
                  <li>Auto-Farm respects all game cooldowns (12-hour harvest resets)</li>
                  <li>Session stats are cleared when you stop auto-farm</li>
                  <li>All-time stats persist across sessions in localStorage</li>
                  <li>Auto-Farm stops automatically if an error occurs</li>
                  <li>You can manually move while auto-farm is paused</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Game Mechanics */}
          <div className="nn-panel">
            <div className="nn-panel__header">
              <span className="nn-panel__title">Core Mechanics</span>
              <span className="nn-panel__meta">Resources · exploration · units · banking</span>
            </div>

            <div className="nn-panel__body space-y-4">
              <div>
                <h3 className="nn-lab nn-text-green mb-2 uppercase">Resource Gathering</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-[color:var(--nn-text-primary)] ml-4">
                  <li><strong>Metal Tiles:</strong> Harvest 800-1,500 metal per gather</li>
                  <li><strong>Energy Tiles:</strong> Harvest 800-1,500 energy per gather</li>
                  <li><strong>Cooldown:</strong> Each tile can only be harvested once per 12-hour reset period</li>
                  <li><strong>Resets:</strong> AM reset at 12:00 PM, PM reset at 12:00 AM (based on X coordinate)</li>
                  <li><strong>Boosts:</strong> Use shrine sacrifices for +25% gathering bonus per tier</li>
                </ul>
              </div>

              <div>
                <h3 className="nn-lab nn-text-violet mb-2 uppercase">Cave &amp; Forest Exploration</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-[color:var(--nn-text-primary)] ml-4">
                  <li><strong>Caves:</strong> 30% chance to find items (diggers, traders, combat items)</li>
                  <li><strong>Forests:</strong> 50% chance to find items (better loot than caves!)</li>
                  <li><strong>Discoveries:</strong> Rare ancient technologies with permanent bonuses</li>
                  <li><strong>Same rules:</strong> Once per reset period per location</li>
                </ul>
              </div>

              <div>
                <h3 className="nn-lab nn-text-cyan mb-2 uppercase">Unit Building</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-[color:var(--nn-text-primary)] ml-4">
                  <li><strong>Tiers:</strong> Unlock with Research Points (RP) - 5 tiers available</li>
                  <li><strong>Costs:</strong> Each unit requires metal and energy</li>
                  <li><strong>Balance:</strong> Maintain STR/DEF ratio for optimal army efficiency</li>
                  <li><strong>Factories:</strong> Capture enemy factories to produce units passively</li>
                </ul>
              </div>

              <div>
                <h3 className="nn-lab nn-text-amber mb-2 uppercase">XP &amp; Leveling</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-[color:var(--nn-text-primary)] ml-4">
                  <li><strong>Gain XP:</strong> From gathering, exploring, and winning battles</li>
                  <li><strong>Level Up:</strong> Unlock new features and base upgrades</li>
                  <li><strong>Research Points:</strong> Earned from leveling, used to unlock unit tiers</li>
                  <li><strong>Specialization:</strong> Choose doctrine at level 15 for unique bonuses</li>
                </ul>
              </div>

              <div>
                <h3 className="nn-lab nn-text-magenta mb-2 uppercase">Banking System</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-[color:var(--nn-text-primary)] ml-4">
                  <li><strong>Metal Bank:</strong> Store metal safely (1,000 deposit fee)</li>
                  <li><strong>Energy Bank:</strong> Store energy safely (1,000 deposit fee)</li>
                  <li><strong>Exchange Bank:</strong> Convert Metal ↔ Energy (20% fee)</li>
                  <li><strong>Safe Storage:</strong> Banked resources cannot be stolen in combat</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Tips & Strategy */}
          <div className="nn-panel nn-panel--amber">
            <div className="nn-panel__header nn-panel__header--amber">
              <span className="nn-panel__title">Tips &amp; Strategy</span>
            </div>

            <div className="nn-panel__body space-y-3">
              <div className="nn-well items-start border-l-4 border-l-[color-mix(in_oklab,var(--nn-green)_50%,transparent)]">
                <div>
                  <p className="font-semibold nn-text-green mb-1">Early Game Priority</p>
                  <p className="text-sm nn-text-dim">Focus on gathering resources and exploring forests for rare items. Bank your resources to keep them safe!</p>
                </div>
              </div>

              <div className="nn-well items-start border-l-4 border-l-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]">
                <div>
                  <p className="font-semibold nn-text-cyan mb-1">Build Balanced Armies</p>
                  <p className="text-sm nn-text-dim">Maintain a good STR/DEF ratio (close to 1:1). Imbalanced armies suffer penalties in combat!</p>
                </div>
              </div>

              <div className="nn-well items-start border-l-4 border-l-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]">
                <div>
                  <p className="font-semibold nn-text-violet mb-1">Use the Shrine Wisely</p>
                  <p className="text-sm nn-text-dim">Sacrifice trader items for permanent +25% gathering boosts. Higher tier items = bigger bonuses!</p>
                </div>
              </div>

              <div className="nn-well items-start border-l-4 border-l-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)]">
                <div>
                  <p className="font-semibold nn-text-amber mb-1">Capture Factories</p>
                  <p className="text-sm nn-text-dim">Factories produce units automatically. Capture enemy factories to grow your army passively!</p>
                </div>
              </div>

              <div className="nn-well items-start border-l-4 border-l-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)]">
                <div>
                  <p className="font-semibold nn-text-magenta mb-1">Unlock Specializations</p>
                  <p className="text-sm nn-text-dim">At level 15, choose Offensive, Defensive, or Tactical doctrine for unique bonuses. Choose wisely - it{"'"}s permanent!</p>
                </div>
              </div>

              <div className="nn-well items-start border-l-4 border-l-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]">
                <div>
                  <p className="font-semibold nn-text-cyan mb-1">Explore Forests First</p>
                  <p className="text-sm nn-text-dim">Forests have 50% discovery chance vs caves at 30%. Prioritize forests for better loot!</p>
                </div>
              </div>
            </div>
          </div>

          {/* Terrain Guide */}
          <div className="nn-panel">
            <div className="nn-panel__header">
              <span className="nn-panel__title">Terrain Types</span>
              <span className="nn-panel__meta">Glyphs match the map tiles exactly</span>
            </div>

            <div className="nn-panel__body grid grid-cols-2 gap-4">
              <div className="nn-well items-start">
                <p className="font-semibold nn-text-cyan">⚙️ Metal</p>
                <p className="text-sm nn-text-dim">Harvest metal for construction</p>
              </div>
              <div className="nn-well items-start">
                <p className="font-semibold nn-text-amber">⚡ Energy</p>
                <p className="text-sm nn-text-dim">Harvest energy for power</p>
              </div>
              <div className="nn-well items-start">
                <p className="font-semibold nn-text-amber">🕳️ Cave</p>
                <p className="text-sm nn-text-dim">30% discovery chance</p>
              </div>
              <div className="nn-well items-start">
                <p className="font-semibold nn-text-green">🌲 Forest</p>
                <p className="text-sm nn-text-dim">50% discovery chance (premium)</p>
              </div>
              <div className="nn-well items-start">
                <p className="font-semibold nn-text-magenta">🏭 Factory</p>
                <p className="text-sm nn-text-dim">Attack to capture for production</p>
              </div>
              <div className="nn-well items-start">
                <p className="font-semibold nn-text-dim">🏜️ Wasteland</p>
                <p className="text-sm nn-text-dim">Empty - safe for bases</p>
              </div>
              <div className="nn-well items-start">
                <p className="font-semibold nn-text-amber">🏦 Bank</p>
                <p className="text-sm nn-text-dim">Store or exchange resources</p>
              </div>
              <div className="nn-well items-start">
                <p className="font-semibold nn-text-violet">⛩️ Shrine</p>
                <p className="text-sm nn-text-dim">Sacrifice for gathering boosts</p>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="nn-panel nn-panel--amber">
            <div className="nn-panel__header nn-panel__header--amber">
              <span className="nn-panel__title">Frequently Asked Questions</span>
            </div>

            <div className="nn-panel__body space-y-4">
              <div>
                <p className="font-semibold nn-text-amber mb-1">Q: How do I get more Research Points?</p>
                <p className="text-sm text-[color:var(--nn-text-primary)]">A: Earn RP by leveling up. Each level grants Research Points to unlock new unit tiers.</p>
              </div>

              <div>
                <p className="font-semibold nn-text-amber mb-1">Q: Why can{"'"}t I harvest this tile again?</p>
                <p className="text-sm text-[color:var(--nn-text-primary)]">A: Each tile has a 12-hour cooldown. Wait for the next reset period (12:00 PM or 12:00 AM based on X coordinate).</p>
              </div>

              <div>
                <p className="font-semibold nn-text-amber mb-1">Q: What{"'"}s the best specialization?</p>
                <p className="text-sm text-[color:var(--nn-text-primary)]">A: Offensive = +damage, Defensive = +defense, Tactical = +resource yield. Choose based on your playstyle!</p>
              </div>

              <div>
                <p className="font-semibold nn-text-amber mb-1">Q: How do I attack other players?</p>
                <p className="text-sm text-[color:var(--nn-text-primary)]">A: PvP combat is coming soon! Currently, you can attack factories to capture them.</p>
              </div>

              <div>
                <p className="font-semibold nn-text-amber mb-1">Q: Where do I find my inventory?</p>
                <p className="text-sm text-[color:var(--nn-text-primary)]">A: Press <kbd className="nn-kbd">I</kbd> to open your inventory and view collected items from cave/forest exploration.</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center nn-lab pt-8 pb-4">
            <p>Need more help? Contact the game developer or check the leaderboard for top players!</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Comprehensive help page with all game mechanics
// - Keyboard reference: verified bindings (see provenance block in header);
//   sourced from DEFAULT_HOTKEYS, page.tsx handlers, MovementControls,
//   and panel-local Shift handlers
// - Strategy tips and terrain guide (in-world glyphs retained)
// - FAQ section for common questions
// - Mobile-friendly responsive design (max-w-5xl centered axis)
// - Token primitives only: nn-panel / nn-table / nn-well / nn-kbd / nn-num
// ============================================================
// END OF FILE
// ============================================================
