'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import GameLayout from '@/components/GameLayout';
import { StatsPanel, ControlsPanel, TopNavBar } from '@/components';

export default function HelpPage() {
  const router = useRouter();

  return (
    <>
      <TopNavBar />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={
          <div className="h-full w-full overflow-auto bg-[--void] text-white p-8">
            <div className="max-w-5xl mx-auto">
              <h1 className="text-4xl font-bold text-[--electric] mb-8">📖 Game Guide & Help</h1>

              <div className="space-y-6">
                <div className="bg-[--card] rounded-lg p-6 border-2 border-[--electric]/20">
                  <h2 className="text-2xl font-bold text-[--electric] mb-4">🚀 Quick Start</h2>
                  <div className="space-y-2 text-white/60">
                    <p>1. <strong>Move around the map</strong> using keyboard controls (QWEASDZXC or arrow keys)</p>
                    <p>2. <strong>Gather resources</strong> by pressing <kbd className="bg-[--card] border border-[--border] px-2 py-1 rounded">G</kbd> on Metal/Energy tiles</p>
                    <p>3. <strong>Build units</strong> at your base by pressing <kbd className="bg-[--card] border border-[--border] px-2 py-1 rounded">U</kbd></p>
                    <p>4. <strong>Explore caves/forests</strong> by pressing <kbd className="bg-[--card] border border-[--border] px-2 py-1 rounded">F</kbd> for rare items</p>
                    <p>5. <strong>Upgrade your base</strong> by gaining XP through gathering and battles</p>
                  </div>
                </div>

                <div className="bg-[--card] rounded-lg p-6 border-2 border-[--electric]/20">
                  <h2 className="text-2xl font-bold text-[--electric] mb-4">⌨️ Keyboard Controls</h2>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-semibold text-[--neon-yellow] mb-3">Movement</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-white/60">Move North:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">Q</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Move West:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">A</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Move South:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">Z</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Move East:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">C</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Move NE/NW/SE/SW:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">W E D X</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Return to Base:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">Shift+H</kbd>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-[--neon-yellow] mb-3">Actions</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-white/60">Harvest/Gather:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">G</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Explore Cave/Forest:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">F</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Attack Factory:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">R</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Open Bank:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">B</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Visit Shrine:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">S</kbd>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-[--neon-yellow] mb-3">Panels</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-white/60">Build Units:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">U</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Manage Factory:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">M</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Specialization:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">N</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Tier Unlock:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">T</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Inventory:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">I</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Discovery Log:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">V</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Achievements:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">H</kbd>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-[--neon-yellow] mb-3">Navigation</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-white/60">Close Panel:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">ESC</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Back Button:</span>
                          <span className="text-white/60">Click ← Back</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-[--neon-pink] mb-3">🤖 Auto-Farm (Premium)</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-white/60">Start/Pause/Resume:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">R</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Stop Auto-Farm:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">Shift+R</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Toggle Stats:</span>
                          <kbd className="bg-[--card] border border-[--border] px-3 py-1 rounded font-mono">Shift+S</kbd>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[--neon-pink]/5 border-2 border-[--neon-pink]/20 rounded-lg p-6">
                  <h2 className="text-2xl font-bold text-[--neon-pink] mb-4">🤖 Auto-Farm System (Premium Feature)</h2>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-[--neon-pink] mb-2">What is Auto-Farm?</h3>
                      <p className="text-white/60">
                        Auto-Farm is an automated map traversal system that explores the entire 150x150 map in a snake pattern,
                        automatically harvesting resources, exploring caves/forests, and optionally engaging in combat with other players.
                      </p>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-[--neon-pink] mb-2">How It Works</h3>
                      <ul className="list-disc list-inside space-y-1 text-white/60 ml-4">
                        <li><strong>Snake Pattern:</strong> Moves left-to-right on odd rows, right-to-left on even rows</li>
                        <li><strong>Complete Coverage:</strong> Visits all 22,500 tiles on the map systematically</li>
                        <li><strong>Auto-Harvest:</strong> Automatically harvests Metal, Energy, Caves, and Forests</li>
                        <li><strong>Statistics Tracking:</strong> Session and all-time stats with detailed metrics</li>
                        <li><strong>Human-Like Speed:</strong> ~900ms between movements to avoid detection</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-[--neon-pink] mb-2">Combat Options</h3>
                      <ul className="list-disc list-inside space-y-1 text-white/60 ml-4">
                        <li><strong>Attack Players:</strong> Toggle on/off in settings</li>
                        <li><strong>Rank Filter:</strong> Attack All, Lower Rank, or Higher Rank players</li>
                        <li><strong>Resource Target:</strong> Target players based on what YOU need most (Metal/Energy/Lowest)</li>
                        <li><strong>Unit Selection:</strong> Automatically selects strongest units for efficiency</li>
                        <li><strong>Note:</strong> "Lowest" option targets players when YOUR metal/energy is low</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-[--neon-pink] mb-2">Controls</h3>
                      <ul className="list-disc list-inside space-y-1 text-white/60 ml-4">
                        <li><strong>Start:</strong> Begin auto-farming from current position</li>
                        <li><strong>Pause:</strong> Temporarily halt auto-farm (keeps progress)</li>
                        <li><strong>Resume:</strong> Continue from last position</li>
                        <li><strong>Stop:</strong> End session and merge stats to all-time totals</li>
                        <li><strong>Settings:</strong> Configure combat options and preferences</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-[--neon-pink] mb-2">Statistics Tracked</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm text-white/60">
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

                    <div className="bg-[--neon-pink]/10 border border-[--neon-pink]/20 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-[--neon-yellow] mb-2">⚠️ Important Notes</h3>
                      <ul className="list-disc list-inside space-y-1 text-white/60 ml-4">
                        <li>Auto-Farm respects all game cooldowns (12-hour harvest resets)</li>
                        <li>Session stats are cleared when you stop auto-farm</li>
                        <li>All-time stats persist across sessions in localStorage</li>
                        <li>Auto-Farm stops automatically if an error occurs</li>
                        <li>You can manually move while auto-farm is paused</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-[--card] rounded-lg p-6 border-2 border-[--electric]/20">
                  <h2 className="text-2xl font-bold text-[--electric] mb-4">⚙️ Core Mechanics</h2>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-[--synth] mb-2">🔹 Resource Gathering</h3>
                      <ul className="list-disc list-inside space-y-1 text-white/60 ml-4">
                        <li><strong>Metal Tiles:</strong> Harvest 800-1,500 metal per gather</li>
                        <li><strong>Energy Tiles:</strong> Harvest 800-1,500 energy per gather</li>
                        <li><strong>Cooldown:</strong> Each tile can only be harvested once per 12-hour reset period</li>
                        <li><strong>Resets:</strong> AM reset at 12:00 PM, PM reset at 12:00 AM (based on X coordinate)</li>
                        <li><strong>Boosts:</strong> Use shrine sacrifices for +25% gathering bonus per tier</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-[--neon-pink] mb-2">🔹 Cave & Forest Exploration</h3>
                      <ul className="list-disc list-inside space-y-1 text-white/60 ml-4">
                        <li><strong>Caves:</strong> 30% chance to find items (diggers, traders, combat items)</li>
                        <li><strong>Forests:</strong> 50% chance to find items (better loot than caves!)</li>
                        <li><strong>Discoveries:</strong> Rare ancient technologies with permanent bonuses</li>
                        <li><strong>Same rules:</strong> Once per reset period per location</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-[--electric] mb-2">🔹 Unit Building</h3>
                      <ul className="list-disc list-inside space-y-1 text-white/60 ml-4">
                        <li><strong>Tiers:</strong> Unlock with Research Points (RP) - 5 tiers available</li>
                        <li><strong>Costs:</strong> Each unit requires metal and energy</li>
                        <li><strong>Balance:</strong> Maintain STR/DEF ratio for optimal army efficiency</li>
                        <li><strong>Factories:</strong> Capture enemy factories to produce units passively</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-[--neon-yellow] mb-2">🔹 XP & Leveling</h3>
                      <ul className="list-disc list-inside space-y-1 text-white/60 ml-4">
                        <li><strong>Gain XP:</strong> From gathering, exploring, and winning battles</li>
                        <li><strong>Level Up:</strong> Unlock new features and base upgrades</li>
                        <li><strong>Research Points:</strong> Earned from leveling, used to unlock unit tiers</li>
                        <li><strong>Specialization:</strong> Choose doctrine at level 15 for unique bonuses</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-[--neon-red] mb-2">🔹 Banking System</h3>
                      <ul className="list-disc list-inside space-y-1 text-white/60 ml-4">
                        <li><strong>Metal Bank:</strong> Store metal safely (1,000 deposit fee)</li>
                        <li><strong>Energy Bank:</strong> Store energy safely (1,000 deposit fee)</li>
                        <li><strong>Exchange Bank:</strong> Convert Metal ↔ Energy (20% fee)</li>
                        <li><strong>Safe Storage:</strong> Banked resources cannot be stolen in combat</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-[--card] rounded-lg p-6 border-2 border-[--electric]/20">
                  <h2 className="text-2xl font-bold text-[--electric] mb-4">💡 Tips & Strategy</h2>

                  <div className="space-y-3 text-white/60">
                    <div className="bg-[--void] p-4 rounded-lg border-l-4 border-[--synth]">
                      <p className="font-semibold text-[--synth] mb-1">Early Game Priority</p>
                      <p className="text-sm">Focus on gathering resources and exploring forests for rare items. Bank your resources to keep them safe!</p>
                    </div>

                    <div className="bg-[--void] p-4 rounded-lg border-l-4 border-[--electric]">
                      <p className="font-semibold text-[--electric] mb-1">Build Balanced Armies</p>
                      <p className="text-sm">Maintain a good STR/DEF ratio (close to 1:1). Imbalanced armies suffer penalties in combat!</p>
                    </div>

                    <div className="bg-[--void] p-4 rounded-lg border-l-4 border-[--neon-pink]">
                      <p className="font-semibold text-[--neon-pink] mb-1">Use the Shrine Wisely</p>
                      <p className="text-sm">Sacrifice trader items for permanent +25% gathering boosts. Higher tier items = bigger bonuses!</p>
                    </div>

                    <div className="bg-[--void] p-4 rounded-lg border-l-4 border-[--neon-yellow]">
                      <p className="font-semibold text-[--neon-yellow] mb-1">Capture Factories</p>
                      <p className="text-sm">Factories produce units automatically. Capture enemy factories to grow your army passively!</p>
                    </div>

                    <div className="bg-[--void] p-4 rounded-lg border-l-4 border-[--neon-red]">
                      <p className="font-semibold text-[--neon-red] mb-1">Unlock Specializations</p>
                      <p className="text-sm">At level 15, choose Offensive, Defensive, or Tactical doctrine for unique bonuses. Choose wisely - it's permanent!</p>
                    </div>

                    <div className="bg-[--void] p-4 rounded-lg border-l-4 border-[--electric]">
                      <p className="font-semibold text-[--electric] mb-1">Explore Forests First</p>
                      <p className="text-sm">Forests have 50% discovery chance vs caves at 30%. Prioritize forests for better loot!</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[--card] rounded-lg p-6 border-2 border-[--electric]/20">
                  <h2 className="text-2xl font-bold text-[--electric] mb-4">🗺️ Terrain Types</h2>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[--void] p-3 rounded-lg">
                      <p className="font-semibold text-[--electric]">⚙️ Metal</p>
                      <p className="text-sm text-white/60">Harvest metal for construction</p>
                    </div>
                    <div className="bg-[--void] p-3 rounded-lg">
                      <p className="font-semibold text-[--neon-yellow]">⚡ Energy</p>
                      <p className="text-sm text-white/60">Harvest energy for power</p>
                    </div>
                    <div className="bg-[--void] p-3 rounded-lg">
                      <p className="font-semibold text-[--solar]">🕳️ Cave</p>
                      <p className="text-sm text-white/60">30% discovery chance</p>
                    </div>
                    <div className="bg-[--void] p-3 rounded-lg">
                      <p className="font-semibold text-[--synth]">🌲 Forest</p>
                      <p className="text-sm text-white/60">50% discovery chance (premium)</p>
                    </div>
                    <div className="bg-[--void] p-3 rounded-lg">
                      <p className="font-semibold text-[--neon-red]">🏭 Factory</p>
                      <p className="text-sm text-white/60">Attack to capture for production</p>
                    </div>
                    <div className="bg-[--void] p-3 rounded-lg">
                      <p className="font-semibold text-white/60">🏜️ Wasteland</p>
                      <p className="text-sm text-white/60">Empty - safe for bases</p>
                    </div>
                    <div className="bg-[--void] p-3 rounded-lg">
                      <p className="font-semibold text-[--neon-yellow]">🏦 Bank</p>
                      <p className="text-sm text-white/60">Store or exchange resources</p>
                    </div>
                    <div className="bg-[--void] p-3 rounded-lg">
                      <p className="font-semibold text-[--neon-pink]">⛩️ Shrine</p>
                      <p className="text-sm text-white/60">Sacrifice for gathering boosts</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[--card] rounded-lg p-6 border-2 border-[--electric]/20">
                  <h2 className="text-2xl font-bold text-[--electric] mb-4">❓ Frequently Asked Questions</h2>

                  <div className="space-y-4">
                    <div>
                      <p className="font-semibold text-[--neon-yellow] mb-1">Q: How do I get more Research Points?</p>
                      <p className="text-sm text-white/60">A: Earn RP by leveling up. Each level grants Research Points to unlock new unit tiers.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-[--neon-yellow] mb-1">Q: Why can't I harvest this tile again?</p>
                      <p className="text-sm text-white/60">A: Each tile has a 12-hour cooldown. Wait for the next reset period (12:00 PM or 12:00 AM based on X coordinate).</p>
                    </div>

                    <div>
                      <p className="font-semibold text-[--neon-yellow] mb-1">Q: What's the best specialization?</p>
                      <p className="text-sm text-white/60">A: Offensive = +damage, Defensive = +defense, Tactical = +resource yield. Choose based on your playstyle!</p>
                    </div>

                    <div>
                      <p className="font-semibold text-[--neon-yellow] mb-1">Q: How do I attack other players?</p>
                      <p className="text-sm text-white/60">A: PvP combat is coming soon! Currently, you can attack factories to capture them.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-[--neon-yellow] mb-1">Q: Where do I find my inventory?</p>
                      <p className="text-sm text-white/60">A: Press 'I' to open your inventory and view collected items from cave/forest exploration.</p>
                    </div>
                  </div>
                </div>

                <div className="text-center text-white/40 text-sm pt-8 pb-4">
                  <p>Need more help? Contact the game developer or check the leaderboard for top players!</p>
                </div>
              </div>
            </div>
          </div>
        }
      />
    </>
  );
}
