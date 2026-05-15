DarkFrame Balance & Optimization Research Report
Date: May 8, 2026 Subject: Game Balance and Systems Optimization Scope: Full-System Analysis (Economy, Combat, Progression, Map)

1. EXECUTIVE SUMMARY
This report analyzes the core mechanics of DarkFrame. While the game possesses robust foundational formulas, several systemic risks—specifically regarding exponential resource accumulation, tier unlock RP bottlenecks, and PvP barrier-to-entry—threaten late-game stability. Recommendations focus on adjusting resource sinks and optimizing the progression curve.

2. ECONOMIC FLOW ANALYSIS (SECTION 21.1)
2.1 Resource Faucets vs. Sinks
Faucets: Harvesting (Primary), Factory Passive Income, Bot Drops, Daily Login (Resources), Referrals, Achievements.
Sinks: Unit Production, Factory Upgrades, Tier Unlocks (Metal), Clan Creation, WMD/Missile production, Auction Listing Fees, PvP Burn.
Critical Imbalance: The resource accumulation rate from harvesting significantly outpaces the mid-game sink rate. At level 20, a player needs 500,000 Metal for a T3 unlock. A player harvesting 500 tiles/day at an average of 1,800/tile generates 900,000 Metal daily. This creates an inflationary surplus.
2.2 Time-to-Goal Analysis (Section 21.2)
Based on the provided formulas and assuming moderate play (500 harvests/day):




Milestone	Req. Metal	Req. RP	Req. Level	Est. Time (Days)
First T2 Unit	100,000	50	10	~2–3 Days
First T3 Unit	500,000	150	20	~10–12 Days
First T4 Unit	2,500,000	350	35	~55–60 Days
First T5 Unit	10,000,000	750	50	~250+ Days
Observation: RP acquisition is the true bottleneck, not metal. Players reach metal goals long before achieving the required Level or RP (1 RP/level, total 50 RP by level 50). This suggests the XP curve and RP rewards are disconnected from progression goals.

3. KEY BALANCE ANALYSES & RECOMMENDATIONS (SECTION 22)
3.1 Economy & Progression (Questions 7, 8, 10)
Problem: The XP curve (
250
×
L
2.5
250×L 
2.5
 ) is extremely steep. Reaching Level 50 requires ~4.4M XP. Even with combat XP (300/win), the grind is excessive for casual players. Furthermore, the RP reward (1 per level) provides only 50 RP by Level 50, but a T5 unlock requires 750 RP.
Recommendation:
Increase baseline Level-Up RP reward to scaling: 
R
P
=
⌊
L
5
⌋
+
1
RP=⌊ 
5
L
​
 ⌋+1.
Introduce "Combat/Harvest milestones" for RP (e.g., 5 RP every 10,000 harvests).
Impact: Reduces the RP deficit without breaking the XP progression curve.
3.2 PvP Burn & Economy (Question 12)
Problem: The PvP burn rate (20% of stolen) is applied only to stolen resources. A successful attack on a stockpiled player provides a massive influx of wealth that is not sufficiently taxed.
Recommendation: Apply a "Tax on Attack" to the defender's total loss, not just the attacker's gain, to incentivize active spending rather than hoarding.
Proposed Change: Increase burn rate to 35% on stolen amounts, and implement a 5% "War Tax" on the defender's current total stockpile during a base attack.
3.3 Factory Defense & Combat (Question 13, 14)
Problem: Factory defense levels scale exponentially (
(
L
−
1
)
2
×
50
,
000
(L−1) 
2
 ×50,000), but player STR/DEF power scales linearly via unit counts. This creates a "wall" where mid-tier players cannot capture high-level factories.
Recommendation: Adjust Factory Defense formula to allow for strategic siege units.
Current L10 defense: 4,050,000.
Recommended L10 defense: 2,500,000.
Impact: Enables late-game competition without requiring excessive time for minimal gains.
4. FORMALIZED DESIGN CORRECTIONS
4.1 Map & Terrain Corrections (Section 22, Q29, Q30)
The documentation contains internal inconsistencies in the codebase metadata that should be reconciled to ensure generation accuracy.




System	Current Documentation Value	Corrected Value
Cave Count	2,250	1,800
Wasteland	8,500	8,995
Rationale: The total tiles must sum to 22,500. Using incorrect counts leads to array indexing errors during Fisher-Yates shuffling.

4.2 Digger Marginal Utility (Section 22, Q9)
The Digger Bonus formula: 
B
o
n
u
s
=
200
×
(
1
−
e
−
0.008
n
)
Bonus=200×(1−e 
−0.008n
 )

At 
n
=
200
n=200: 
200
×
(
1
−
e
−
1.6
)
≈
200
×
(
1
−
0.201
)
≈
159.8
%
200×(1−e 
−1.6
 )≈200×(1−0.201)≈159.8%.
At 
n
=
500
n=500: 
200
×
(
1
−
e
−
4
)
≈
200
×
(
1
−
0.018
)
≈
196.4
%
200×(1−e 
−4
 )≈200×(1−0.018)≈196.4%.
Conclusion: Marginal utility becomes negligible after ~150 diggers. The game provides 500 diggers in the progression estimates, which is inefficient. Players should be encouraged to trade excess diggers at the Auction House rather than hoarding them.
5. PRIORITY RANKING OF RECOMMENDATIONS



Priority	Area	Change Required	Rationale
1 (Critical)	Economy	Adjust RP Earnings	Tier progression is mathematically impossible for the average player under current RP rewards.
2 (High)	Data Integrity	Fix Array Counts	Prevents map generation crashes/idempotency failures.
3 (Medium)	PvP	Increase Burn Rates	Essential to prevent late-game hoarding and resource inflation.
4 (Low)	Balance	Adjust Factory Defense	Improves late-game engagement.
6. CODED FORMULA VERIFICATION (STRESS TEST)
To verify the "Time to Level 50" logic:

Total XP Required
=
4
,
419
,
417
Total XP Required=4,419,417
Harvests at 500/day
≈
4
,
419
,
417
3
 XP/harvest
≈
1
,
473
,
139
 harvests
Harvests at 500/day≈ 
3 XP/harvest
4,419,417
​
 ≈1,473,139 harvests
Days
=
1
,
473
,
139
500
≈
2
,
946
 days
Days= 
500
1,473,139
​
 ≈2,946 days
Observation: 2,946 days (approx. 8 years) is clearly balanced toward combat-heavy play rather than passive harvesting. If the developer intends to support a 500–2,000 concurrent player base, this curve requires high-frequency PvP. If combat XP does not scale with target level, active players will hit the Level 50 cap significantly faster than harvesters, creating a massive power disparity.

Final Recommendation:
Introduce a dynamic combat multiplier:

Combat XP
=
Base XP
×
(
1
+
Target Level
10
)
Combat XP=Base XP×(1+ 
10
Target Level
​
 )
This allows lower-level players to catch up by defeating higher-level threats, fostering competitive gameplay rather than purely grinding.