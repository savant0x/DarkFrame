I have ingested the **DarkFrame Version 2.0** codebase specifications. I am now operating as your Lead Game Designer and Economy Balance Specialist. I will strictly adhere to the provided formulas, constants, and constraints.

Because of the sheer volume of the analysis required in Section 22 and 23, I will deliver this in **modular reports**. Attempting to answer all 30 balance questions in a single response would compromise the mathematical depth required for "Impact Projections."

Here is the **Analysis Roadmap** I will follow:
1. **Report A: Economic Flow & Progression** (Questions 7–12, 22–26)
2. **Report B: Combat, PvP & Power Curves** (Questions 13–16, 27)
3. **Report C: Map Strategy, Terrain & Bot Ecosystem** (Questions 1–6, 17–21)
4. **Report D: Technical Hygiene & Final Optimization** (Questions 28–30)

---

# Report A: Economic Flow & Progression

## 1. Current State Analysis: The "Harvest-to-Army" Pipeline

### 1.1 Resource Faucets vs. Sinks
**The Faucet (Late Game Max):**
A maxed player (VIP + Flag + Shrine + 200% Diggers + Optimal Balance) harvests **~6,249** resources per tile. 
- Full map sweep (22,500 tiles) = **140,602,500 resources**.
- Time to complete (VIP + Flag): **~3.7 hours**.
- **Hourly Revenue (Harvesting only): ~38 Million / hr**.

**The Sink (Late Game):**
- **Unit Costs:** An *Apocalypse* unit costs 21,600 Metal. A maxed player can build **~6,500 Apocalypse units per hour** using only one map sweep's worth of resources.
- **Resource Decay:** 0.25% above 1M (max 250k/day). This is **negligible**. 250k/day is less than the yield of 40 tiles.
- **Upkeep:** This is the primary governor. 
  - T5 Unit avg cost $\approx 15,000$.
  - Base upkeep: $15,000 \times 0.01 = 150/hr$ per unit.
  - If a player hits the supply cap (e.g., L50, 10 factories $\approx 1,000$ cap), upkeep is $150 \times 1,000 = 150,000/hr$.

**Numerical Conclusion:** The resource faucet (38M/hr) dwarfs the primary sink (150k/hr upkeep). In the late game, resources become meaningless.

### 1.2 Time-to-Goal (Progression)
**The XP Wall:**
- Level 50 requires **4,419,417 XP**.
- Harvesting 1 full map sweep: $22,500 \times 3 = 67,500 \text{ XP}$.
- Sweeps required for L50: $\approx 65.5 \text{ sweeps}$.
- Total time (Basic): $65.5 \times 11.6 \text{ hrs} \approx 760 \text{ hours}$.
- Total time (VIP + Flag): $65.5 \times 3.7 \text{ hrs} \approx 242 \text{ hours}$.

**The RP Bottleneck:**
- T5 Unlock costs **750 RP**.
- Leveling to 50 provides **50 RP**.
- Gap: **700 RP**.
- Daily Login (Max): 160 RP/day.
- Time to reach T5 via login: $\approx 4.4 \text{ days}$.
- **Conclusion:** RP is not the bottleneck; Metal and Level are.

---

## 2. Problem Identification

1. **Hyper-Inflation (Late Game):** Once a player achieves the "Max Harvest" state, the cost of units becomes irrelevant. The "Sinks" (decay and upkeep) are tuned for a mid-game economy, not a late-game engine producing 38M/hr.
2. **The "Passive" Trap:** The "Days at 100 harvests/day" estimate in the docs (14,731 days for L50) proves that the game is mathematically impossible without the Auto-Farm. If the Auto-Farm is a "feature," the manual harvest values are irrelevant.
3. **Digger Utility Collapse:** Due to the exponential decay $200 \times (1 - e^{-0.008n})$, the jump from 100 to 200 diggers only increases the bonus from $110\%$ to $159\%$. The effort to find the last 100 diggers is far higher than the reward.

---

## 3. Recommendations

### Recommendation 1: Scale Resource Decay (The "Anti-Hoard" Patch)
Change Decay from a flat max to a percentage-based cap that scales with level.
- **Current:** $\min(\text{floor}((\text{stored} - 1\text{M}) \times 0.0025), 250,000)$
- **New:** $\min(\text{floor}((\text{stored} - 1\text{M}) \times 0.01), \text{Level} \times 50,000)$
- **Impact:** At L50, max decay becomes 2.5M/day. Still low, but starts to pressure the hoard.

### Recommendation 2: Pivot Upkeep to Exponential Cost
The current upkeep is linear based on unit count. It must be exponential to punish massive "spam" armies.
- **Current:** $\text{multiplier} = (1 + \text{overRatio})^{1.5}$
- **New:** $\text{hourlyCost} = (\text{unitCount} \times \text{avgUnitCost} \times 0.01) \times (1 + \text{overRatio})^{2.5}$
- **Impact:** Increasing the exponent from $1.5 \rightarrow 2.5$ creates a "hard ceiling" where the cost of maintaining an army exceeds the hourly harvest rate of a non-Flag bearer.

### Recommendation 3: Tune Digger Decay Constant
To make the grind for 500 diggers meaningful, we need to flatten the curve.
- **Current:** $0.008$
- **New:** $0.004$
- **Impact:** 
  - Old (100 diggers): $110\%$
  - New (100 diggers): $65\%$
  - This forces players to acquire *more* diggers to reach the same power, extending the mid-game loop.

---

## 4. Impact Projection (The Math)

**Scenario: Maxed Player with 1,500 Units (Over Cap by 50%)**
- $\text{overRatio} = 1,500 / 1,000 = 0.5$
- **Current Upkeep:** $150,000 \times (1.5)^{1.5} = 150,000 \times 1.83 = \mathbf{274,500/hr}$
- **Proposed Upkeep:** $150,000 \times (1.5)^{2.5} = 150,000 \times 2.75 = \mathbf{412,500/hr}$
- *Observation:* Even with this change, the 38M/hr revenue makes upkeep irrelevant. **Conclusion:** We must increase the base upkeep rate from $1\%$ to $5\%$ for T4/T5 units specifically.

---

## 5. Priority Ranking

| Priority | Change | Type | Impact |
|---|---|---|---|
| **CRITICAL** | Base Upkeep Rate ($1\% \rightarrow 5\%$ for T4/T5) | Config | Prevents total economic collapse. |
| **HIGH** | Upkeep Exponent ($1.5 \rightarrow 2.5$) | Code | Punishes over-capping. |
| **MEDIUM** | Digger Decay ($0.008 \rightarrow 0.004$) | Config | Extends progression timeline. |
| **LOW** | Resource Decay Scaling | Code | Slows long-term accumulation. |

**Next Step:** I am ready to move to **Report B: Combat, PvP & Power Curves**, where I will analyze if these massive armies can actually be defeated or if the "DefenderDEF / 2" formula creates invincible fortresses. Shall I proceed?