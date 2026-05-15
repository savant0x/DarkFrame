DarkFrame Complete Balance Analysis & Optimization Report
Date: May 8, 2026
Scope: Full-system numerical analysis using provided formulas and constants
Methodology: Direct computation from formalized math (Sections 21–25) with derived projections

Executive Summary
The DarkFrame economy suffers from three critical structural failures: extreme time-to-level pacing that alienates casual players, a completely ineffective resource decay system that cannot control inflation, and digger acquisition rates so high that permanent progression homogenizes within days. Additionally, RP is massively over-issued relative to sinks, rendering it a non-currency after early tier unlocks. Combat balance is generally sound, but the factory defense curve creates an impassable wall between L4 and L5 factories, and the army balance penalty for pure compositions is draconian. The auto-farm system, combined with a daily stamina reset, creates unhealthy 24/7 obligation mechanics rather than focused session-based play.

Below is the complete analysis of all 30 balance questions with specific numerical evidence and concrete recommendations.

1. Terrain & Distribution
Q1. Is 40% Wasteland the right amount?
Current State:
Non-wasteland tiles total 13,505 (60.02% of the map). Resource density is therefore 0.600, yielding a mean spacing between resource tiles of approximately 0.65 tiles. Manual travel time between resources is functionally sub-second.

Problem:
Wasteland is irrelevant. At 60% resource density, the map is saturated; players never need to travel more than one tile to find a harvestable node. The 40% Wasteland creates no navigation friction, no exploration tension, and no strategic chokepoints.

Recommendation:
Reduce non-wasteland tiles to achieve a resource density of ~25% (mean spacing ~1.4 tiles). This requires converting approximately 7,875 non-wasteland tiles to Wasteland. Target distribution:




Terrain	Current	Recommended
Wasteland	8,995	16,870
Metal	4,500	2,250
Energy	4,500	2,250
Cave	1,800	900
Forest	450	225
Factory	2,250	1,125
Specials	6	6
Impact:
Mean resource spacing increases to ~1.4 tiles, creating meaningful travel time and making map positioning, territory control, and auto-farm pathing efficiency strategically relevant.
Type: Config change (terrain allocation arrays).

Q2. Should Metal and Energy remain at 20% each?
Current State:
Metal:Energy cost ratio is exactly 2.00:1 across all five standard tiers (T1–T5). Both resources are required in identical proportions for every unit class.

Problem:
None. The symmetry is internally consistent. Because exchange banks allow conversion at 80% efficiency, any asymmetry in player demand self-corrects through arbitrage. Keeping them equal prevents one resource from becoming a "trash" currency.

Recommendation:
No change. Maintain 1:1 tile count and 2:1 cost ratio.

Q3. Are 1,800 caves (8%) the right count?
Current State:
A full auto-farm sweep visits all 1,800 caves (plus 450 forests with identical mechanics). Expected digger yield per sweep:




Source	Count
RNG drops (2.5% × 20% digger share)	~9
Guaranteed (1 per 75 caves)	~24
Total	~33
At VIP auto-farm speed (~5.6h/sweep), a player running continuously collects ~141 diggers per day. The guaranteed interval alone provides 102 diggers/day (24h ÷ 5.6h × 24).

Problem:
Diggers are far too abundant. A player reaches n=500 (196.3% bonus, effectively the cap) in under 4 days of passive auto-farming. This collapses the permanent progression curve and eliminates differentiation between active explorers and idle players.

Recommendation:

Reduce Cave + Forest count to 1,125 combined (5% of map).
Increase guaranteed digger interval from 75 to 200 caves.
Reduce base drop rate from 2.5% to 1.5%.
New expected yield per full sweep: ~2.8 RNG diggers + ~5.6 guaranteed = ~8.4 diggers/sweep. Time to n=200 extends from ~2 days to ~12 days at VIP continuous farming.
Type: Config change.

Q4. Should Forests (2%) have different mechanics from Caves?
Current State:
Forests use identical code to Caves. They are effectively just 450 extra cave tiles with a different name.

Problem:
Missed strategic depth. Forests could differentiate the exploration meta.

Recommendation:
Yes. Differentiate as follows (config + minor code):




Feature	Cave	Forest
Base drop rate	1.5% (with rec above)	3.0%
Digger share	20%	0%
Tradeable share	80%	100%
Theme	Diggers + permanent upgrades	Tradeable items + consumables
This creates two distinct farm routes: Caves for permanent power, Forests for economy liquidity.
Type: Code change (drop tables).

Q5. Are 2,250 factories (10%) too many, too few, or right?
Current State:
Factory spacing averages 1.6 tiles due to uniform random distribution—effectively everywhere. Factories per player at concurrency:




Players	Factories/Player
500	4.50
1,000	2.25
2,000	1.12
Problem:
At 2,000 concurrent players, there are only enough factories for each player to own 1.1, yet the max per player is 10. This creates extreme scarcity and guaranteed conflict, which may be intended, but the density is so high that factories are visually spammed across the map with no territorial meaning. At 500 players, 4.5 factories each means players quickly max out and factories become irrelevant.

Recommendation:
Reduce Factory count to 1,125 (5%) and implement dynamic respawn tied to active player count:



targetFactories = min(2250, max(1125, activePlayers × 1.5))
This ensures 1.5 factories per player at all concurrency levels, capping at 2,250 and flooring at 1,125. The reduced static count improves strategic competition, while the scaling prevents total deprivation at high pop.
Type: Config + code (dynamic spawn logic).

Q6. Should the 4 banks be increased?
Current State:
Average Euclidean distance from a random tile to the nearest bank: 40.6 tiles. At manual travel speed (~1 tile/sec), that's ~41 seconds of dead travel per banking trip.

Problem:
With only 4 banks and a 150×150 map, banking is inconvenient enough that players will hoard resources rather than deposit, increasing PvP theft surface area. The deposit fee (1,000 M/E) is trivial; the time cost is the real friction.

Recommendation:
Increase to 8 banks by converting Wasteland tiles. Place new banks at: (1, 75), (75, 1), (150, 75), (75, 150). This reduces average distance to ~28.3 tiles (~28s travel), a 30% improvement. Do not exceed 8—too many banks trivialize the risk/reward of carrying resources.
Type: Config change.

2. Economy & Progression
Q7. Is the XP curve appropriately paced?
Current State:
XP to Level 50: 4,419,417. Time-to-level from harvest-only (3 XP/tile):




Level	100 harv/day	500 harv/day	1,000 harv/day
10	264 days	53 days	26 days
20	1,491 days	298 days	149 days
30	4,108 days	822 days	411 days
50	14,731 days	2,946 days	1,473 days
With moderate mixed activity (500 harvests + 20 caves + 5 combat wins/day): 1,228 days to Level 50. Even a hardcore schedule (1,000 harvests + 50 caves + 10 wins + 2 captures/day) requires 559 days (~1.5 years).

Problem:
The curve is catastrophically slow for anyone below hardcore intensity. A casual player harvesting 100 tiles/day would need 40 years to reach Level 50. This is not "steep progression"; it is progression abandonment.

Recommendation:
The exponent 2.5 is fixed per constraints. Instead, add non-harvest XP multipliers:

Daily Quests: 3 quests/day awarding 500–2,000 XP each (configurable). At 2,000 XP/day, this alone reduces L50 time by ~22%.
Factory Production XP: Award 5 XP per unit built (currently 10, but slots regen fast—this is minor). Change to 20 XP per unit.
First-win-of-day bonus: +500 XP for first infantry win, +1,000 XP for first base attack win.
Combined, these add ~5,000–8,000 XP/day for active players, reducing moderate-path L50 from 1,228 days to approximately 500 days (still 16 months, but achievable). Hardcore paths should target 120–180 days to L50.
Type: Config change (XP reward tables) + minor code (quest system).

Q8. Is 1 RP per level sufficient?
Current State:
RP sources by Level 50 (moderate activity, ~1,228 days):




Source	RP
Level-ups (49)	49
Daily login (~130/day avg)	~159,590
Achievements	900
PvP (estimated)	~343,732
Total	~504,271
RP costs:




Cost	RP
Tier 2–5 unlocks	1,300
Specialization	25
Total required	1,325
Problem:
RP is not merely sufficient—it is hyper-inflated. Players earn 380× more RP than they need for mandatory progression. After tier unlocks, RP has no sink and becomes a dead currency.

Recommendation:
Add mandatory RP sinks throughout the economy:




Sink	Cost
Factory upgrade (per level)	25 RP
Clan bank upgrade (levels 2–6)	Add 50/100/200/400/800 RP respectively
WMD component surcharge	100 RP per component
Unit ability module unlock	10 RP per module
Digger reconfiguration (move metal→energy)	5 RP per digger
Target: A fully progressed player should have spent 15,000–25,000 RP by Level 50, creating genuine scarcity without breaking early progression.
Type: Config change (cost tables).

Q9. Is the digger exponential decay curve well-tuned?
Current State:
Marginal utility per digger:




n	Bonus	Marginal
10	15.4%	1.48%
50	65.9%	1.08%
100	110.1%	0.72%
200	159.6%	0.32%
300	181.9%	0.15%
348	—	<0.1%
Problem:
The curve shape is mathematically sound, but the acquisition velocity (see Q3) makes the curve irrelevant. Players reach n=500 in days, at which point the curve is essentially flat.

Recommendation:
Keep the formula, but tune the perceived curve by throttling acquisition (Q3). If acquisition is slowed to ~8 diggers/sweep, the n=100 mark (110% bonus) becomes a meaningful 2-week milestone, and n=200 becomes a 1-month achievement. No changes to the decay constants are needed.
Type: Config change (drop rates).

Q10. Is the max harvest (~5,681/tile) too high?
Current State:
T4 cheapest unit (Titan/Stronghold) costs 10,800 total resources (7,200 M + 3,600 E). At max realistic harvest (5,681), a T4 unit costs 1.9 tiles. The T4 tier unlock itself (2.5M Metal) requires only 441 max-harvest tiles—approximately 1.3 hours of VIP auto-farm.

Problem:
Late-game harvest values completely trivialize unit costs and tier unlocks. The intended 2.5M Metal gate for T4 becomes a single afternoon of passive farming.

Recommendation:
Reduce the digger bonus cap from 200% to 100% by changing the constant in the formula:



bonus = 100 × (1 - e^(-0.008 × n))   // new cap: 100%
This halves the max harvest to ~3,750/tile. A T4 unlock then requires ~667 tiles (~3.7h VIP), and T5 requires ~2,667 tiles (~15h). Unit costs remain trivial in absolute terms, but the tier unlocks regain some pacing integrity. Alternatively, increase tier unlock Metal costs proportionally: T4 to 5,000,000 and T5 to 25,000,000.

Preferred path: Increase tier unlock costs rather than nerf diggers, preserving the power fantasy while extending goals.




Tier	Current Metal	Recommended Metal
2	100,000	100,000
3	500,000	500,000
4	2,500,000	6,000,000
5	10,000,000	30,000,000
Type: Config change.

Q11. Is resource decay effective?
Current State:
Decay: 0.25% daily on amount above 1,000,000, max 250,000/day. Drain time to 1M:




Start	Days to Reach 1M
2,000,000	3,357
5,000,000	3,911
10,000,000	4,235
50,000,000	4,912
Problem:
Decay is functionally inert. A 10M stockpile takes 11.6 years to decay to the threshold. It does not prevent runaway inflation, hoarding, or whale dominance.

Recommendation:
Adopt a tiered progressive decay system:




Bracket	Daily Rate	Max
0 – 1M	0%	0
1M – 5M	0.5%	20,000
5M – 25M	1.0%	200,000
25M+	2.0%	500,000
Under this model, 10M drains to 1M in approximately 90 days. This is aggressive enough to force resource deployment (units, factories, clan projects) while not punishing casual players who hover around 1–3M.

Additionally, change the threshold from 1,000,000 to 500,000 to broaden the sink.
Type: Code change (decay formula).

Q12. Is the PvP burn rate sufficient?
Current State:
Base theft: 20%. Burn: 20% of stolen. Rigorous model at 1,000 players:




Attacks/Player/Day	Avg Stockpile	Burn % of Daily Generation
1	500,000	3.5%
1	2,000,000	14.0%
3	2,000,000	42.0%
5	5,000,000	174.8%
Problem:
Burn rate is highly volatile. At low stockpiles, it's negligible. At high stockpiles with frequent attacks, it can exceed total generation, but only if whales are repeatedly targeted. The flat 20% burn does not scale with economic maturity.

Recommendation:
Make burn progressive with victim stockpile:



burnRate = 0.10 + 0.02 × log10(stockpile / 100000)
capped at 0.35 (35%)
At 500K stockpile: 20% burn. At 10M stockpile: 30% burn. This specifically targets inflationary whale wallets without crushing new players.
Type: Code change.

3. Combat & PvP
Q13. Is the factory defense curve appropriate?
Current State:
Army required to capture (90% success rate), assuming T2 Commando (STR 30) for L2, T4 Titan (STR 180) for L4–L5:




Factory Level	Defense	Commandos/Titans Needed	Resource Cost
1	1,000	30 T1	6,000 M
2	50,000	1,663 T2	~3.0M M
3	200,000	6,663 T2	~12.0M M
4	450,000	2,500 T4	~27.0M M
5	800,000	4,444 T4	~48.0M M
6	1,250,000	6,944 T4	~75.0M M
Problem:
The jump from L1 (1,000) to L2 (50,000) is a 50× spike. The quadratic scaling (L-1)² × 50,000 creates a brick wall at L5 (800,000 defense). A player with T4 units cannot reasonably capture L5 without thousands of units costing tens of millions. Meanwhile, factory upgrade costs are trivial (~170K to L10) and pay back in 17 hours.

Recommendation:
Flatten the defense curve to allow incremental capture:




Level	Current Defense	Recommended Defense
1	1,000	1,000
2	50,000	10,000
3	200,000	30,000
4	450,000	75,000
5	800,000	150,000
6	1,250,000	275,000
7	1,800,000	450,000
8	2,450,000	700,000
9	3,200,000	1,050,000
10	4,050,000	1,500,000
Formula: defense = floor(1000 × 1.6^(level-1))

This preserves difficulty scaling but makes L4–L6 factories achievable with tier-appropriate armies of ~500–1,500 units.
Type: Config change (defense table).

Q14. Is the PvP combat damage formula balanced?
Current State:
Damage = max(5, attackerSTR - defenderDEF/2).
HP: STR units 10, DEF units 15.

Problem:
The formula favors DEF heavily in absolute terms because DEF units have 1.5× HP and deal damage based on their DEF value. Example:




Matchup	Result
10× Rifleman (50 STR) vs 10× Bunker (50 DEF)	Defender wins in 5 rounds
20× Rifleman (100 STR) vs 10× Bunker (50 DEF)	Attacker wins in 3 rounds
An attacker needs 2:1 numeric superiority to overcome equal defense. This is acceptable for base defense but may make offensive play feel futile without overwhelming force.

Recommendation:
No change to the formula. However, add a flanking bonus for attackers who outnumber defenders 3:1 in army slot count:



if attackerSlots > defenderSlots × 3:
    attackerDamage ×= 1.15
This rewards massed offensives without breaking balanced armies.
Type: Code change.

Q15. Does level gap protection adequately protect new players?
Current State:
Gap >20: damage reduced by 5% per level, minimum 25% of calculated damage (floor at 5).




Level Gap	Damage Multiplier
20	100%
25	75%
30	50%
40	25%
Problem:
A Level 50 attacking a Level 10 (gap 40) still deals 25% damage. With a 1,000 STR advantage, 25% is still lethal. However, the absolute minimum damage of 5 per unit means a maxed player cannot one-shot an entire army.

Recommendation:
Add an absolute level block, not just reduction:



if levelGap > 25:
    attackBlocked = random() < (levelGap - 25) × 0.05  // up to 100% block at gap 45+
This prevents Level 50s from farming Level 1s entirely, while the damage reduction handles gaps of 20–25.
Type: Code change.

Q16. Is the army balance system too punishing?
Current State:
ratio = min(str, def) / max(str, def)




Ratio	Status	Power
0.0–0.69	CRITICAL	0.5×
0.7–0.84	IMBALANCED	0.8×
0.85–0.94	BALANCED	1.0×
0.95–1.0	OPTIMAL	1.1×
Problem:
A 2:1 STR:DEF army (ratio 0.5) suffers 50% power reduction and takes 30% more damage. This is excessively punishing for players who want to specialize. A "siege" composition (heavy STR) or "turtle" composition (heavy DEF) is rendered nonviable.

Recommendation:
Soften the CRITICAL bracket:




Ratio	Status	Power	Dmg Taken	Dmg Dealt
0.0–0.50	CRITICAL	0.65×	1.20×	0.85×
0.50–0.69	WEAK	0.80×	1.10×	0.90×
0.70–0.84	IMBALANCED	0.90×	1.05×	0.95×
0.85–0.94	BALANCED	1.0×	1.0×	1.0×
0.95–1.0	OPTIMAL	1.1×	0.95×	1.05×
This preserves the incentive for balance but allows 2:1 specialists to function at 65% power rather than 50%.
Type: Config change.

4. Strategic & Map Design
Q17. Should the Shrine move from (1,1) to center (75,75)?
Current State:
Average distance to Shrine (1,1): 114.1 tiles.
Average distance to Shrine (75,75): 57.5 tiles.

Problem:
The corner placement creates a "safe corner" where controlling the northeast quadrant dominates. It disincentivizes cross-map travel for 75% of the playerbase.

Recommendation:
Move Shrine to (75, 75). This creates a natural king-of-the-hill dynamic, reduces travel time by 50%, and makes flag-bearer traffic (which also spawns near resources/factories) more central to the conflict loop.
Type: Config change.

Q18. Should the Auction House move away from the Shrine?
Current State:
Auction House at (10,10), only 12.7 tiles from Shrine (1,1).

Problem:
The Shrine-AH cluster creates a single super-hub. All traffic converges, making the rest of the map feel empty.

Recommendation:
Move Auction House to (140, 140). This creates two economic poles: Shrine in the center (buffs) and AH in the southeast (trade). Travel distance between them (~197 tiles) forces logistics decisions and spreads player density.
Type: Config change.

Q19. Should the map use clustered biomes instead of pure random?
Current State:
Pure Fisher-Yates shuffle. Terrain is uniformly distributed.

Problem:
No strategic depth. Players cannot control territory because resources are everywhere equally. Clan warfare over "metal ridges" or "cave clusters" is impossible.

Recommendation:
Yes. Implement 9 biome clusters (3×3 grid of 50×50 sectors):




Sector	Bias
NW	Forest-heavy + Banks
N	Factory cluster
NE	Energy-rich
W	Mixed
C	Shrine + Wasteland (contested)
E	Metal-rich
SW	Cave-heavy
S	Mixed
SE	Auction House + Trade nodes
Each 50×50 sector maintains total tile counts globally but skews local distribution by ±15%. This creates fronts and resource wars without breaking the global constraint.
Type: Code change (generation algorithm).

Q20. Should new players spawn in an outer ring?
Current State:
Random spawn anywhere. Outer ring is 5,600 tiles (24.9% of map).

Problem:
Given 60% resource density, a random spawn anywhere already guarantees nearby resources. An outer ring spawn restriction is unnecessary and may strand players far from the Shrine/AH.

Recommendation:
No. Keep random spawn. If resource density is reduced per Q1, then add a "new player sanctuary" mechanic: for the first 24 hours, players receive a 50% defense buff and can only be attacked by players within ±3 levels. This solves retention without map changes.
Type: Code change.

Q21. Is the flag system well-tuned?
Current State:

Max hold: 12 hours
2× harvest, 2× XP, 1.5× auto-farm speed
Flee costs: 10%, 15%, 20%, 25%, 30% (cumulative 100% of session resources)
Respawn preference: Metal 40%, Cave 30%, Factory 30%
Problem:
A 12-hour hold with 2× harvest is enormous (~6M+ extra resources for an active player). The flee cost escalation is clever but the 5th flee wipes 100% of session resources, which may feel arbitrary. The 30-minute channel is vulnerable but fair.

Recommendation:

Reduce max hold to 4 hours. 12 hours is too long for a single player to dominate a daily cycle.
Keep flee mechanics—they create interesting risk decisions.
Add a "Flag Fatigue" debuff: each hour held reduces the holder's DEF by 5% (max -20%), making longer holds increasingly vulnerable.
Type: Config change.
5. Addiction & Retention
Q22. What is the optimal daily session length?
Current State:
Stamina thresholds:




Actions	Efficiency
0–1,999	100%
2,000–2,999	75%
3,000–3,999	50%
4,000+	25%
At VIP speed (~1.3s/tile), 4,000 actions take 1.4 hours. At Basic speed (~3.5s/tile), 4,000 actions take 3.9 hours.

Problem:
The daily reset creates a "burn it or lose it" obligation. Worse, the 25% floor means players are incentivized to run auto-farm 24/7 for diminished returns rather than play focused sessions.

Recommendation:
Replace daily stamina with regenerating stamina:

Cap: 2,000 actions at 100% efficiency
Regen: 100 actions/hour
Floor: 0% (no free farming at exhaustion)
This yields an optimal session of ~1.5–2 hours, after which players should log off and return later. It also eliminates the 24/7 auto-farm obligation because overnight regen only yields ~800 actions.
Type: Code change.

Q23. Does auto-farm create healthy engagement or unhealthy obligation?
Current State:
VIP: 5.6h full map. Basic: 11.6h full map. VIP is 2.69× faster.

Problem:
Basic auto-farm is literally longer than a healthy sleep schedule. This forces Basic players to choose between leaving a computer on 24/7 or falling severely behind. The speed gap is acceptable; the absolute time is not.

Recommendation:

Cap auto-farm duration to 6 hours per day for Basic, 10 hours for VIP.
Allow players to queue auto-farm routes (e.g., "farm only Metal quadrant") to get full value without full-map obligation.
This converts auto-farm from a lifestyle tax into a daily assignment.
Type: Code change.

Q24. Are daily login rewards sufficient?
Current State:
100–160 RP/day. Tier costs are 50–750 RP.

Problem:
Daily login RP is over-sufficient; it trivialize RP gating entirely (see Q8). The rewards do drive return behavior, but the currency lacks value.

Recommendation:
Keep the RP flow but add rotating daily login bonuses:




Day	Bonus
Mon	150 RP + 10% harvest boost (2h)
Tue	150 RP + free repair
Wed	150 RP + +1 cave drop chance (2h)
Thu	150 RP + PvP attack cost waiver
Fri	150 RP + 2× factory income (4h)
Sat	200 RP + 5,000 free units slots
Sun	200 RP + Flag Beacon charge
This preserves the login habit while attaching value to the otherwise useless RP via boost waivers.
Type: Config change.

Q25. Is the referral system well-calculated?
Current State:
25 referrals progressive rewards: ~1.17M Metal, ~1.17M Energy, ~1,424 RP. This is 0.78× the clan creation cost. Per-referral value grows at 5% compound, capped at 2×.

Problem:
The milestone at 25 referrals gives an "Ambassador Unit" and 10% XP boost. The metal/energy is trivial for the effort of recruiting 25 active players. The progressive scaling (1.05^(n-1)) is clever but the base values are too low to matter.

Recommendation:

Increase base per-referral to 25,000 M + 25,000 E + 25 RP + 5,000 XP.
At 25 referrals, grant 1,000,000 M + 1,000,000 E + permanent +5% harvest bonus.
Add a clan-wide referral milestone: if clan members recruit 100 total, entire clan gets +10% defense for 7 days.
This makes referrals an economic strategy, not a vanity metric.
Type: Config change.

Q26. Do achievement thresholds create meaningful goals?
Current State:
harvest_1m requires 1,000,000 harvests. At 500/day, this is 5.5 years.

Problem:
Only cave and combat achievements are achievable within a reasonable window. Harvest thresholds are absurdly high for a 2-year game lifecycle.

Recommendation:
Reduce harvest thresholds and add mid-tier achievements:




ID	Requirement	Reward
harvest_5k	5,000	25K M, 5 RP
harvest_25k	25,000	100K M, 15 RP
harvest_100k	100,000	250K M, 50 RP, 1 VIP day
harvest_500k	500,000	750K M, 100 RP, 3 VIP days
harvest_2m	2,000,000	2M M, 250 RP, 7 VIP days, cosmetic
Remove harvest_1m or increase its reward to be commensurate with 5+ years of play (e.g., unique Prestige Unit).
Type: Config change.

Q27. Is the bot ecosystem engaging enough?
Current State:
~200–300 static bots, 8 nests. At 2,000 players: 0.1–0.15 bots per player.

Problem:
Bots are functionally extinct at high concurrency. The variety (Hoarder, Raider, Fortress, Ghost, Balanced, Boss) is excellent, but encounter rates are too low to sustain a "hunter" playstyle.

Recommendation:
Implement dynamic bot spawning:



targetBots = activePlayers × 0.5  // 1 bot per 2 players
minBots = 500
maxBots = 5000
Bots spawn in nests and roamers proportional to player count, ensuring 0.5 bots/player always. Additionally, add a Bounty Board where players can spend 50,000 M to spawn a targeted bot type within 50 tiles. This creates a direct hunter economy.
Type: Code change.

6. Code & Design Hygiene
Q28. Should DIGGER_TIERS be removed?
Recommendation: Yes. If the constant is dead, remove it to prevent maintenance confusion.
Type: Code change (cleanup).

Q29. Should JSDoc in generateTerrainArray() be corrected?
Recommendation: Yes. Cave count should read 1,800, not 2,250.
Type: Documentation change.

Q30. Should Wasteland count in game.types.ts JSDoc be corrected?
Recommendation: Yes. Correct to 8,995.
Type: Documentation change.

Priority Ranking



Priority	Change	Impact	Effort
P0	Fix resource decay (Q11)	Prevents economic collapse	Low
P0	Add RP sinks (Q8)	Restores currency integrity	Low
P0	Reduce digger acquisition (Q3)	Fixes permanent progression speed	Low
P1	Flatten factory defense curve (Q13)	Unlocks mid-game capture loop	Low
P1	Replace daily stamina with regen (Q22)	Eliminates unhealthy obligation	Medium
P1	Add non-harvest XP sources (Q7)	Reduces casual time-to-level from 40yr to ~1.5yr	Medium
P2	Increase tier unlock costs (Q10)	Preserves late-game pacing	Low
P2	Move Shrine to center (Q17)	Improves map dynamics	Low
P2	Dynamic bot scaling (Q27)	Sustains PvE engagement	Medium
P2	Reduce map resource density (Q1)	Adds strategic travel	Low
P3	Cap auto-farm daily duration (Q23)	Reduces lifestyle obligation	Medium
P3	Clustered biomes (Q19)	Enables territorial strategy	High
P3	Softened army balance (Q16)	Supports diverse builds	Low
Documented Uncertainties & Assumptions
Player behavior assumptions: Attack frequency (1–5/day), average stockpiles, and harvest rates are modeled estimates. Actual telemetry may vary by ±50%.
Bot population baseline: The document does not specify a total bot count; assumptions of 200–300 are inferred from nest targets (15–20 × 8 nests).
Stamina scope: It is assumed stamina affects all yield-generating actions. If it currently affects only harvest, the effective obligation metrics shift but the design conclusion remains.
Exchange economy: The 80% bank exchange rate is assumed to create enough liquidity that 2:1 Metal:Energy costs do not bottleneck play.
Concurrent vs. total players: Analysis uses concurrent player estimates (500–2,000). Total registered players may be 10× higher, but economic sinks must balance against concurrent activity.