# **Dark Frame: Comprehensive Game Balance and Macro-Economic Systems Research Report**

## **Executive Macro-Economic Overview and the Hyperinflationary Crisis**

The underlying economic framework of any persistent massively multiplayer online (MMO) strategy game dictates its long-term viability, player retention, and competitive equilibrium. The current mechanical implementation of the title *Dark Frame* has demonstrated critical failures in fundamental economic theory, leading to rapid hyperinflation, unbounded progression, and the immediate exhaustion of available content. When a player can reach level 36, accumulate four million metal and three million energy, generate 710,000 strength, and achieve a \+973% gathering bonus within a single gameplay session, the game's mathematical models lack both constraints and necessary friction.

The core systemic issue stems from an extreme imbalance in the game's faucet-to-sink ratio. Faucets—mechanisms that introduce resources into the economy, such as tile harvesting and daily resets—are operating without mathematical boundaries \[1, 2, 3\]. With a 150 by 150 grid yielding 22,500 harvestable tiles per day across two resets, the baseline economy introduces massive raw capital. Compounded by unchecked multipliers, this results in a daily income exceeding 193 million resources for a player conducting a full sweep. Conversely, the game lacks sufficient hard sinks—mechanisms that permanently destroy value, such as maintenance costs, exponential upkeep, or resource burn \[1, 4, 5\]. Without hard sinks, wealth accumulates infinitely, purchasing power drops to zero, and the progression loop collapses \[1\].

The proposed redesign shifts the paradigm from an unchecked, multiplicative economy to an additive, asymptotically bounded economy heavily reliant on active engagement, continuous resource destruction, and psychological reinforcement. This report provides an exhaustive evaluation of the proposed mechanical changes, analyzing the mathematical models, behavioral psychology implications, and macro-economic projections required to stabilize the economy for a multi-year lifecycle, directly addressing the developer's core inquiries regarding sustainability, engagement, and competitive balance.

## **Mathematical Models for Progression and Scaling**

### **Multiplicative Escalation Versus Additive Diminishing Returns**

The most critical flaw in the current iteration of the economy is the multiplicative nature of its bonus system. In the existing model, applying a VIP bonus (2x), a Flag Bearer bonus (2x), and a Shrine bonus (2x) results in an 8.8x multiplier before external factors like digger bonuses are even calculated. Multiplicative systems encourage extreme snowballing and power creep, as every new bonus compounds exponentially with existing bonuses, rendering baseline values irrelevant \[6, 7, 8\]. In modern game design, while multiplicative scaling provides massive power fantasies for the player, it ultimately destroys competitive balance, trivializes content pacing, and makes future expansions nearly impossible to balance \[7, 9\].

The proposed transition to an additive system with soft diminishing returns is mathematically sound and highly recommended for establishing a stable baseline. Under an additive framework, a \+50% VIP bonus and a \+50% Flag bonus combine to a \+100% total increase, rather than compounding recursively \[9, 10\]. Additive systems possess built-in diminishing returns inherently; increasing a total multiplier from 100% to 150% represents a smaller relative gain to the player's total output than increasing from 0% to 50% \[7\].

To further control extreme endgame scaling and prevent the accumulation of minor buffs from breaking the economy, the proposed soft diminishing returns on additive stacking are structured as follows:

| Bonus Tier (Cumulative) | Effectiveness Rate | Actual Yield Contribution |
| :---- | :---- | :---- |
| First \+100% | 100% | \+100% |
| Next \+100% (101% \- 200%) | 75% | \+75% |
| Next \+100% (201% \- 300%) | 50% | \+50% |
| Beyond \+300% | 10% | \+10% per subsequent 100% |

This scaling model ensures that players always receive a mathematical benefit for acquiring new buffs, avoiding a hard, frustrating cap that disincentivizes gameplay, but the mathematical impact flattens significantly \[11, 12, 13\]. This preserves the baseline economy and ensures that no player can infinitely out-scale the underlying resource generation curves, answering the developer's philosophy of maintaining a constant sense of progression without compromising the mathematical integrity of the server.

### **Asymptotic Scaling in Collectibles: Restructuring the Digger System**

The current digger system relies on unbounded linear percentage growth, offering \+0.1% per digger indefinitely, which is fundamentally incompatible with a persistent strategy economy. A player achieving a \+973% bonus indicates an absolute failure of upper limit constraints. The proposed solution introduces a bounded exponential decay formula:

![][image1]  
Where ![][image2] represents the absolute maximum possible bonus (the asymptote) set at 200%, ![][image3] represents the decay constant at 0.008, and ![][image4] is the total number of diggers collected.

This specific equation is highly effective in game design for resolving collectible inflation while maintaining reward psychology \[11, 12, 14\]. It provides rapid early-game gratification while enforcing strict late-game boundaries. The first few diggers acquired provide substantial, highly noticeable increases, fulfilling the psychological desire for immediate power gains. As the player approaches hundreds of diggers, the marginal utility of each new digger approaches zero, though it technically never hits zero, satisfying the requirement to avoid hard ceilings \[13, 15\].

At a drop rate adjusted down to 2.5% on cave and forest tiles, combined with a 20% digger chance from those drops, the projected daily yield is approximately 22 diggers per day for a highly active player conducting two full map sweeps. Over a 30-day period, yielding roughly 660 diggers, a dedicated player will achieve approximately a \+190% bonus. Because the formula asymptotes strictly at 200%, the subsequent months and years of gameplay will only yield a maximum additional 10% \[13\].

Regarding the developer's inquiry into digger rarity and whether this pacing feels rewarding enough, the mathematical decay operates flawlessly for long-term retention. However, to mitigate severe early-game variance and prevent statistical anomalies where a player experiences extreme dry spells, implementing a guaranteed digger drop mechanism every defined number of cave explorations is highly recommended. This ensures that the highly impactful first few diggers are reliably obtained by all players, establishing baseline engagement before the exponential decay renders individual digger drops less statistically urgent.

### **Polynomial Experience Curves and Long-Term Content Pacing**

Experience progression dictates the lifecycle and content consumption rate of an MMO. The previous system, which utilized a linear 1,000 XP requirement per level up to level 30, resulted in players consuming all early-game content and reaching the mid-game in a single session \[16, 17\]. The transition to a polynomial curve is a vast improvement over both linear and purely exponential models for long-term player retention.

The proposed formula for leveling is polynomial:

![][image5]  
While exponential curves eventually create an insurmountable mathematical "wall" that causes player churn due to perceived impossibility, polynomial curves flatten out in their relative rate of change over time \[17, 18\]. This means that while each sequential level takes progressively longer in absolute terms, the relative increase in time required between higher levels does not feel significantly more punishing \[17, 18\].

| Target Level | Cumulative XP Required | Estimated Progression Time |
| :---- | :---- | :---- |
| Level 5 | \~14,000 XP | Day 1 |
| Level 10 | \~79,000 XP | Week 1 |
| Level 30 | \~1,230,000 XP | Month 2 |
| Level 50 | \~4,420,000 XP | Month 6 |
| Level 70 | \~10,300,000 XP | Year 1.5 |
| Level 100 | \~26,700,000 XP | Year 4+ |

In conjunction with the drastic reduction of harvest XP from 20 to 3, passive farming is aggressively decoupled from primary leveling. This forces players to seek active play achievements, combat, and exploration to advance. Regarding the developer's inquiry into pacing, reaching level 50 in six months is an industry-standard benchmark for strategy MMOs, optimizing the Lifetime Value of players and aligning with long-term retention benchmarks \[19, 20\].

Addressing the question of the optimal level cap, establishing a soft cap at level 100 provides an aspirational "cliff" for the most dedicated players \[21\]. It provides enough runway for the development team to introduce seasonal content and expansions over a four-year lifecycle before a critical mass of players reaches the absolute endgame \[22, 23, 24\]. The curve is neither too steep to cause early churn nor too gentle to allow content exhaustion, representing an ideal mathematical equilibrium for the proposed timeline.

## **Active Engagement Loops and Psychological Reinforcement**

### **The Shrine-Centric Loop and Variable Ratio Reinforcement**

The Shrine system is meticulously positioned to become the primary daily engagement driver. By reducing the cave and forest drop rate to 2.5% and adjusting the loot pool to 80% tradeable items and 20% diggers, the economy generates approximately 90 tradeable sacrifice items per day for an active player who completes two full map sweeps.

This drop mechanic utilizes a variable ratio reinforcement schedule, a psychological framework closely associated with habituation and highly retentive engagement loops \[25, 26, 27\]. Because players cannot predict exactly which tile will yield a tradeable item or a rare digger, dopamine responses are heightened, mimicking the psychological hooks of risk and reward mechanisms \[28\].

The Shrine sacrifice costs are structured to facilitate active decision-making and continuous daily logins rather than passive hoarding:

| Buff Tier | Cost (Tradeable Items) | Duration | Yield Bonus |
| :---- | :---- | :---- | :---- |
| Spade | 2 items | 30 minutes | \+25% |
| Heart | 5 items | 1 hour | \+25% |
| Diamond | 12 items | 3 hours | \+25% |
| Club | 25 items | 6 hours | \+25% |

Generating approximately 90 items per day allows a player to afford three 'Club' tier buffs, costing 75 items, which provides 18 hours of coverage. However, the game restricts maximum buff stacking to \+70% via diminishing returns (+25%, \+20%, \+15%, \+10%) rather than a flat \+100% \[29, 30\]. A dedicated player must choose between spreading their buffs out sequentially to maintain a constant \+25% yield throughout the day, or stacking them for a massive \+70% burst during highly active, focused farming windows.

When a Shrine buff expires, the immediate loss of yield creates psychological friction and a fear of missing out, which drives the player back into the cave exploration loop to hunt for more sacrifice items \[31, 32\]. Answering the developer's first inquiry: this creates a closed, self-sustaining daily loop that directly converts active gameplay into economic efficiency. A daily use limit on the Shrine is entirely unnecessary and counterproductive; the diminishing returns naturally discourage excessive stacking, while allowing players the freedom to exhaust their inventory dynamically based on their real-world schedule. The variable durations perfectly bridge short commuter play sessions and prolonged weekend engagement.

### **Session Pacing via Soft Stamina Constraints**

Stamina and energy systems are historically polarizing within the gaming community. When implemented as strict hard caps that entirely lock a player out of the game, they generate immense player frustration, breaking immersion and forcing artificial session limits that lead to negative sentiment and review bombing \[33, 34\]. However, from a macro-economic standpoint, infinite action economies inevitably ruin systemic balance, allowing automated scripts, account sharing, and hyper-engaged users to accumulate mathematically insurmountable advantages over the broader player base \[35, 36\].

The proposed soft stamina system resolves this tension by applying diminishing returns to output rather than restricting the input:

| Daily Harvest Actions | Yield Efficiency |
| :---- | :---- |
| Actions 1 \- 2,000 | 100% |
| Actions 2,001 \- 3,000 | 75% |
| Actions 3,001 \- 4,000 | 50% |
| Actions 4,001+ | 25% (Floor) |

With an open map providing 22,500 harvestable tiles per day, a player can theoretically sweep the entire map multiple times. However, the soft cap establishes a psychological stopping point. Once a player drops to 25% efficiency, the return on time invested plummets. This accomplishes three critical macroeconomic goals. First, it habituates session lengths, ensuring players leave the game slightly unsatisfied, eager to return for the next daily reset, which is a proven method for driving long-term retention \[35\]. Second, it protects the overall economy from runaway inflation caused by bots, as infinite farming yields heavily penalized returns, keeping the total daily faucet within predictable parameters.

Third, and most importantly, it keeps casual players highly competitive. A casual player executing 2,000 actions operates at peak macroeconomic efficiency, capturing the vast majority of the available daily value. A hardcore player spending ten times the hours only extracts marginally more total value \[37, 38\]. Answering the developer's inquiry: the 2,000/1,000/1,000 threshold structure is an ideal deployment of the mechanic. It provides sufficient runway for satisfying gameplay sessions without suffocating the economy.

### **Auto-Farm Durability: Maintenance as an Economic Sink**

Introducing an auto-farm condition stat, effectively a durability system, adds a layer of required maintenance to the core loop. In modern game design, durability systems are frequently criticized as annoying busywork that serve merely to pad playtime and frustrate the user \[33, 34, 39\]. However, when functioning as a necessary economic sink in a game with infinite gathering potential, durability is mandatory to extract currency back out of the system \[40, 41\].

The proposed system elegantly avoids the standard pitfall of durability by penalizing speed rather than entirely breaking the tool. Operating at 100% condition yields 100% speed, degrading softly to 60% speed at half condition, and dropping to a painful 5% speed at 1% condition. Because the tool never formally breaks and disappears, the player is not hard-locked out of the game. Instead, the psychological frustration of watching the auto-farm crawl across the map at 5% speed acts as the catalyst to spend metal and energy on repairs.

The exponential scaling of repair costs prevents players from micro-managing repairs after every individual tile. Waiting until the tool reaches 10% requires massive resources, serving as a continuous hard sink that dynamically scales with the player's engagement level \[4, 42\]. Evaluating the developer's question on repair mechanics: the system feels like engaging maintenance rather than busywork precisely because it degrades performance rather than halting it. Offering real-time repair delays, such as 10 minutes per 10% condition, alongside an option for instant repairs using premium currency, introduces a highly effective monetization vector. It relies on the player's impatience and desire for efficiency rather than forcing a pay-to-win power disparity.

## **Combat Economics and Upkeep Systems**

### **Unit Upkeep and the Prevention of Doomstacks**

In traditional strategy games, if units only possess an upfront production cost with no ongoing maintenance, the optimal dominant strategy is to build a massive, unstoppable army over time, colloquially known as a "doomstack" \[43, 44\]. This phenomenon causes severe late-game stagnation, where new players cannot possibly compete with established accounts, and veterans hoard millions of units, severely degrading server performance and competitive dynamism \[44\].

To counter this inevitable stagnation, the game introduces a continuously calculating unit upkeep mechanism that functions as the primary macroeconomic drain:

![][image6]  
This exponential formula is a brilliant macroeconomic stabilizer. If a player maintains an army strictly within or below their supply cap, the hourly cost is fractional and easily sustained by casual resource generation, imposing no undue burden on standard gameplay \[45, 46\]. However, if a player attempts to field an army massively exceeding their supply cap, the exponential multiplier dictates an upkeep cost that quickly exceeds the army's base value per hour. This creates a hard mathematical ceiling on military size \[47, 48\].

The strategic depth of the game then shifts toward manipulating the supply cap. Players must invest heavily in factory levels, tech tree unlocks, and clan perks to incrementally raise their supply cap, inherently tying military supremacy to broad, holistic economic development rather than one-dimensional unit printing \[44, 48\]. Addressing the developer's question regarding ideal army size: for a mid-game player, the mathematically optimal army size sits exactly at 100% to 110% of their supply cap, where the marginal utility of fielding extra units matches the rising exponential upkeep cost. This forces strategic army composition and punishes thoughtless mass production. Small armies remain free, benefiting casual and recovering players, while massive sovereign armies require an entire supporting logistical infrastructure, acting as the ultimate continuous resource drain \[44\].

### **Resource Destruction in PvP Conflicts**

Perhaps the most aggressive and necessary economic control proposed is the 20% permanent resource destruction during Player versus Player (PvP) combat, coupled with fixed attack costs and permanent unit loss.

In many MMOs, player trading, auction houses, and PvP looting act exclusively as soft sinks; wealth is transferred between accounts but never actually leaves the global economy, leading to persistent, game-killing inflation \[1, 2\]. Introducing a 20% permanent burn rate transforms every single PvP engagement into a net negative for the global economy \[49, 50\]. As active PvP increases on the server, the total volume of resources in circulation mathematically decreases, countering the constant influx from harvesting.

Answering the developer's inquiry into whether a 20% loss rate is too high and might discourage combat: while a 20% destruction rate is steep and will induce some level of risk aversion among highly conservative players \[51, 52\], it is entirely necessary for a persistent game where tile generation produces infinite daily wealth. The victorious attacker still acquires 80% of the stolen wealth, which remains a massive, highly lucrative incentive to drive territorial conflict. Furthermore, granting the defender experience points and a small resource reward funded entirely by the attacker's fixed deployment cost mitigates the extreme negative sentiment of being farmed by superior players. This offers a slight consolation prize that maintains psychological engagement even after a crushing defeat \[53, 54\]. This makes PvP highly meaningful, shifting it from a casual activity to a strategic economic decision.

## **Monetization and Competitive Equilibrium**

### **The Target Power Gap: Whales Versus Free-to-Play**

In free-to-play mobile strategy games, a developer must explicitly define the intended power gap between massive financial spenders, commonly referred to as whales, and dedicated free-to-play participants. Setting this gap too wide alienates the broader player base, causing the server population to collapse as free players realize they exist only as targets. Setting it too narrow removes the incentive for high-tier monetization, crippling the game's revenue \[37, 55\].

Industry consensus for competitive 4X and strategy MMOs suggests a golden ratio regarding power disparity: if a mathematically optimized whale operates at 100% comparative power, an optimized, hyper-engaged free-to-play user should operate at approximately 80% \[37\]. At an 80% power dynamic, a whale will consistently win a one-on-one engagement, validating and satisfying their financial investment \[56\]. However, two coordinated free-to-play players utilizing superior tactics can overpower a single whale, preserving the strategic, social, and political integrity of the game \[38\].

### **VIP Value Proposition Restructuring**

The transition of the VIP system from a 2x multiplicative bonus to a \+50% additive yield is critical for achieving and maintaining this delicate 100:80 equilibrium. A 2x multiplicative bonus mathematically guarantees that free players can never compete on a macro-level, as the compounding math creates an impassable gulf, leading to inevitable server death due to a lack of a working-class player base \[55, 57\].

Addressing the developer's question on whether VIP remains compelling under these nerfed parameters: to compensate for the reduction in raw multiplier power, the revised VIP package injects immense value through aggressive Quality of Life and efficiency mechanics rather than raw combat superiority \[58, 59\].

* **Auto-Farm Efficiency:** Allowing VIP players to process the map at 2x auto-farm speed with a premium tool that degrades significantly slower directly translates to sustained economic dominance. Time is the ultimate bottleneck in strategy games; accelerating time fulfills the premium fantasy without breaking the math of a single tile \[60\].  
* **Advanced Logistics:** Priority factory slots and remote auction house access remove the friction of travel and queue times, allowing VIPs to manipulate the economy instantaneously.  
* **Cosmetic Prestige:** Exclusive titles, badges, and base skins fulfill the deep psychological desire for visible dominance, status, and recognition, which is fundamentally the primary driver for mega-whale spending \[61, 62, 63\].

This restructuring guarantees that the VIP tier remains highly compelling, mathematically superior, and capable of driving subscription revenue, while simultaneously preventing the free-to-play base from being mathematically eradicated from relevance.

## **Progression Mechanics, Gating, and Systemic Creep**

### **Tier Unlock Costs and Currency Hybridization**

The prior tier unlock system required a trivial 100 RP in total, enabling players to unlock all five overarching technological tiers in a single gameplay session. This removed long-term goals entirely, immediately exposing the player to the endgame without the requisite economic foundation. The revised structure scales aggressively, culminating in a total cost of 1,300 RP and 13.1 million metal by level 50\.

By creating a hybrid cost structure that demands both premium or time-gated currency alongside base economic currency, the game forces strategic allocation and diversified gameplay. Players cannot simply auto-farm RP; they must concurrently run efficient, massive metal-generating operations, likely requiring territory control and combat \[64\]. This dual-gating mechanism ensures that progression accurately reflects both active time invested through achievements and raw economic prowess.

Answering the developer's question on tier unlock appropriateness: the costs are perfectly calibrated for the proposed 6-month timeline to level 50\. However, higher tiers, particularly Tiers 4 and 5, should ideally require a baseline level of clan participation to unlock. Forcing social integration for endgame progression ensures that lone-wolf players are eventually absorbed into the political meta-game, which is the ultimate driver of late-game retention and conflict. Furthermore, reducing the daily passive harvest milestone from 6,000 RP down to 1,500 RP is a necessary austerity measure. By shifting RP generation from a passive consequence of auto-farming to an active reward via the Achievement System, RP is successfully re-established as a premium currency that commands respect and careful, strategic expenditure.

### **Achievement Systems and the Prevention of Power Creep**

The implementation of a comprehensive, multi-tiered Achievement System provides necessary intermediate goals across multiple gameplay verticals, including harvesting, exploration, combat, and social integration \[65\]. However, the nature of the rewards dispensed by this system must be strictly monitored by the design team to prevent vertical power creep.

Offering permanent stat boosts as rewards for achievements is mathematically dangerous. In MMOs, permanent, stacking stat rewards slowly inflate the baseline power level of older accounts. Over a two-year lifecycle, an old account with every achievement unlocked will possess a baseline power so artificially high that it creates an impassable gulf for new players, simultaneously rendering older content completely obsolete \[66, 67, 68\].

Game design principles suggest that achievement rewards should focus heavily on horizontal progression and temporary spikes \[65, 69\].

* **Optimal Rewards:** Heavy influxes of RP, unique cosmetics, VIP subscription days, and temporary 24-hour global buffs.  
* **Strict Avoidance:** The game must avoid dispensing permanent yield bonuses, permanent combat stat augmentations, or permanent speed increases as achievement rewards \[70, 71, 72, 73\].

If permanent rewards are strictly required to incentivize completion for certain monumental tasks, they must be capped linearly and forcibly incorporated into the additive soft-cap diminishing formula established for multipliers. This guarantees that an ancient account does not mathematically invalidate a three-month-old account.

## **End-Game Stabilization and Clan Megaprojects**

### **The Weapon of Mass Destruction System**

For veteran players and dominant clans, individual upkeep costs, repair fees, and stamina limits eventually lose their macroeconomic impact as daily income scales into the tens of millions through optimized logistics and territory control \[42\]. To prevent late-game stagnation and resource hoarding, MMOs require "megaprojects"—massive, collective resource sinks that demand the pooled wealth of entire organizations \[74, 75, 76\].

The proposed Weapon of Mass Destruction (WMD) system serves this precise economic function. Requiring 8.1 million RP across thirty localized technologies and tens of millions of metal and energy per individual warhead, the system demands exhaustive coordination from multiple high-level players. Crucially, the daily maintenance cost for storing constructed WMDs prevents indefinite stockpiling, ensuring that even the most dominant, wealthiest clans on the server are kept perpetually hungry for raw resources \[4, 75\].

Finally, because WMDs are completely consumed upon deployment, the system functions as a catastrophic, instantaneous hard sink. A single deployment permanently deletes vast quantities of aggregated wealth from the server environment, simultaneously resetting the geopolitical balance and destroying the target's infrastructure. This creates a perpetual cycle of armament and destruction, ensuring the faucet-to-sink ratio remains healthy even deep into a multi-year lifecycle.

### **Evaluating New Mechanics for Long-Term Engagement**

Addressing the developer's inquiries regarding the introduction of entirely new mechanics to support the two-to-three-year lifecycle, several proposals offer significant macroeconomic and engagement benefits without introducing mere restrictive friction.

**Resource Decay and Rot:**

Implementing a slow decay or "rot" on stored resources above a certain threshold is a highly effective, albeit controversial, method to prevent hoarding \[77, 78\]. In games where players amass billions of resources, rot forces active spending and constant reinvestment. If implemented, it should only apply to unprotected storage, incentivizing players to invest in bank upgrades or clan vaults \[79\]. This acts as a continuous, silent drain on inactive wealth, keeping the active economy fluid.

**Seasonal Resets and Soft Ladders:**

Given the eventual accumulation of wealth despite heavy sinks, MMO strategy games inevitably face end-of-lifecycle stagnation. Introducing a prestige system or seasonal resets provides a recurring economic flush \[80, 81\]. However, full character wipes generate massive player churn due to loss aversion \[82\]. A more sustainable approach is to implement "Soft Seasons." In a soft season, individual player levels, tech trees, and VIP statuses remain permanent. However, the world map, territorial control, clan structures, and highly specific endgame resources are wiped quarterly \[83\]. Coupled with a Seasonal Achievement ladder, this allows the economy to reset its most heavily contested elements while preserving the personal progression that players spent months achieving, retaining engagement through exclusive seasonal cosmetics \[84\].

**Territory Upkeep:**

Adding an upkeep cost to claimed tiles or clan territories adds geographic friction. If a clan wishes to control 30% of the map, they must pay an exponential tax to maintain those borders, preventing a single mega-clan from painting the entire map without massive, continuous effort. This naturally fractures massive alliances and promotes localized skirmishes.

**Tool Upgrade Progression:**

Allowing players to permanently upgrade their auto-farm tools through a branching tech tree (Basic to Advanced to Premium to Legendary) creates a long-term horizontal progression path. This allows players to specialize in gathering specific resources faster, adding identity to the economic game without strictly increasing the global faucet volume.

**Cave Difficulty Tiers:**

Introducing tiered caves ensures that the active exploration loop remains engaging for level 50 players. Harder caves could require specific combat loadouts or stamina expenditures, offering slightly better drop rates for Shrine items. This creates a natural progression gradient for the Shrine loop, ensuring it scales alongside the player's combat power.

**Combat Shrine Buffs:**

Expanding the Shrine system to offer temporary combat buffs (e.g., \+10% Attack for 1 hour) introduces an aggressive pre-combat preparation phase. If a clan plans an assault, all members must actively farm caves to secure combat buffs, explicitly linking the PvE exploration loop to the PvP dominance loop, creating a holistic gameplay ecosystem.

## **Addictive Loops and Final Economic Projections**

Addressing the developer's final inquiries regarding the overarching health of the economy and the creation of the "just one more run" feeling: the redesigned systems form an interlocking web of psychological loops that drive persistent engagement \[31, 32\].

The **Micro-Loop** consists of map sweeping and tile harvesting, constrained gently by the soft stamina cap and tool durability. This provides immediate, low-effort gratification.

The **Meso-Loop** consists of cave exploration, driven by the variable ratio reinforcement of digger drops and the impending expiration of Shrine buffs. This creates daily FOMO and forces active play sessions \[27\].

The **Macro-Loop** involves tech tree progression, leveling, and clan-based WMD construction, requiring weeks of coordinated economic planning and PvP resource destruction \[42\].

With the strict transition from multiplicative to additive modifiers, the introduction of exponential decay to diggers, and the massive hard sinks of unit upkeep and PvP resource burn, the game's economy is projected to stabilize completely. Rather than generating 193 million resources daily in a hyper-inflationary vacuum, wealth generation is mathematically bounded, and excess capital is violently destroyed in clan warfare and maintenance taxes.

If these mathematical formulas and psychological constraints are strictly maintained, the overarching economy will generate a continuous, healthy velocity of resource movement. Players will constantly cycle between generating wealth and burning it to maintain their logistical and military supremacy, ensuring *Dark Frame* remains competitive, monetizable, and engaging for a multi-year lifecycle without succumbing to the mathematical collapse of its current iteration.

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAiCAYAAADiWIUQAAAEWUlEQVR4Xu3dT6iUZRTH8SNppP0zszQMtBAiMkqiRRYZaYtAF1n0B2vRotKFRKUIQnVJIiVqYVHRXyKkf9ZGW0RRLUMhCCpBkm6Chi5aVYui8vx6nof73OM7c7veO3fmxe8Hftz3Pe/MXGdmcQ/neWY0AwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAuzvfM9pwWLwAAAKC/5nsers6/r44BAABOaWfFQh/M8HzgmVbVXso/51Q1mRnOa5rKnReLAABgcOgP+9+ef/PPP/Px7fWNWuBNS/9uJVKzovqvnvvCtZPxpeeKULvTsyjUeu0tzyexWHnSc7PngXx+lWeV5z3Pu54duS5q/tr2ngMAcErZ7Pkn1Joan0H3oudgqC2y1LjE+slaklOoGbzJ87vnmqo+FdSsbanOz/VMr87VrOn6wqomn4XzQk0cAAAYULs8w6HWxobtNs9XNnq5Us3o9ZaeYxMtJ9ZLisWZsZDp8c6IRetPw7bO0vMVLWveP3LpP5qs6XmoYZUNnqc8Oz0rPDfmerHWWBoFAGBg/eXZ7rnIs8bzk+ec6vpdnkc9d3te9lxsaQlyv2e3pT/0h/NttbSmqc5z+fwyz9F8LLquSc4Tno+q+kRdaqmR0jKfjkWfnNQETE3WDbnW5FnPpnx8uXVfZvw5FrLJbNiWe16w9FyeD9ea6H1rajoj3eZsS+9Bk/L+AwCAAaMltGHPgnyuP+baG7Uyn6sJ2ZqPRY2JGqALPcequva/yXrPdZaaO3ndsy8fi+77oOfKnMkylH+uzhFNoPS8hm30UmETPe/X7MTlw+hQLGSdGjY1SWoc1Qw1JfrO87Wl++kDBVO5r0yTyadjEQAA9J8aGk2U6mU+NTxqtERTnno6Vfa66fb1JOqX6njIc0k+VrOmBrC4xdJyq/ZRXVDVJ+qd/PNaS9NATdbUKKnxjPvzOjliY0+qxtuw6bvRtnle7ZBIr81vns89i8O1XlPDVt53AAAwQDTxKtM0UZOz17PU0v4nNQ5lT5imaloCFd3n1nxcJmrPeE630cuGf1hqou61tAR6INfVyD1UblS5o0vK72tSpoDzPN94Hs/nairH+sDB1Z5P87GWasvyaBM1dU06NWzjFR+n0166XtD+NTW7AABgQKgx05RLEx0tbWpypMmOlgW1R63QJw+/tdRgla+B0Ab3921kKqcJ3B4b2Rv1mOcNz8eWJm9fWJpcPWLpcd62tE9rMmiypuegzM01NYfyQ3XtnlyLZtmJy6B6fstCrainhaKGSl8XUn7P/9lz1o2a0h8tvX56HTvtN+sFvY9laRwAALSMlvVi4xC/OFYNYE2TLt1HTV19Ted6vLbSJLHXn6TU6xZfz6kwZGPv9QMAAGiFD637/xzQVq/EAgAAQFtpArYxFltMX/XBp0MBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYDAdBxbZnXRE16MfAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAYCAYAAAAVibZIAAABS0lEQVR4Xu2TLUsEURSGj2BQ0LIKBg2LzbiIxQ8waNSoP8Cy2aK2LQZBBLNRxGJUEDH4J4yCQTGJIGpQ/HjeOfeycx2RnbBtXniYYc6Zc89977lmlbqtaXiA78A1DCcZqRbh0zxXz0sYSjJy2oV7uIOxX7Eo/XwMz3ACvWk41QAcwj68wmQaztQDTdiCL1hPw0WNwwGsmG9rKQ1napgX3YQPmE3DRS2bdzAFb1bsoh9aMApncAMj+YS/1IIFmIBH2E6iZqvmcRW9tRJ+6nC0uro4MvdQqsOGeREVLuVnn/kCVwG9q5AK1j01ey/lp6Tu1GX0TJ1p65IWLe1nlPyUr/OwY35IkuzRDHfkp4ZZFkTJL02AftYYRXXs5wycwmDum2ZUsypL4mFJ2sG/fs7Bk7Xv+zushZhu04W17/MevIS8mHsOtRCvVKkb+gFM/0ZwbSwG7gAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAYCAYAAAAlBadpAAABEElEQVR4Xu3TvUoDQRSG4RMkEDEQQkAUIlliGvUOhIBICktBe9u0sdIgksbSwspGRO1yASKkCgpaeAdaBULsRSwUou9xZ9dxsu6WAfGDB4ZzdhjmZ0X+ZLJYwSYWMGHqUyia8UgWcYcXtLGNC3SwhCvUwq9N0tjDG3Yw+bMtVTyjL87KOvEY79iwG1YyuDR0HKaOD+wiZTecnKNpFyoY4BFzdiMiJ+LstyX+qgd28ZfkxN/iV/Q6uhhKxAkmZRY9PKHs9BITTFY6jose6rJdyONekicXcIppt3Eo/p7X3IaJXp2+ssj7L+EB15hxevrK9tGQmPv3cItXnGELR7jBqsRMDKIfeFg35uX7T/rPWPMJCSkp/c7RsHEAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAYCAYAAAAs7gcTAAAAyklEQVR4Xu3RsQtBURTH8SMpokRSVslgYDAbKMrfIKtZFgMjo1JmyYBRFrNdKYPJ5A+wKJOB73n3vZIno+n96jPczjm3+84T8fLv+FFEDWH4kEUVobc+iWKJDno4YowhplgjqI16wwAla0wkhQtWyOOKHSJajKMv9iQp4IYGAmgiZ9dc0aa7mPf/jD5phj1iHzUr+nETtJDAScyADmp0G1qzUscTI5TxQNeu6UVzZOyzpHHAAhu0cRazsi0qTqMT3URSzI/5dvbiygvC9RzA6VnpHQAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAiCAYAAADiWIUQAAADGElEQVR4Xu3cTcimUxgH8EsoGqWMMKKQ1JSyMNhQs6BMsvFRahYjG6OUfNeUGgsrZcFCTYoZmVIoSc1ikq/9NGVJGYmVjdiQj+vqnHue0+15Z8zM+8xL/X717zn3ue/nc3V1nXM/EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABsjPMyezIXZg5mzh/OPZ/5I3PFMAcAwFm2JXOsj3/I3DSc2z2MAQBW6uvMXz13ZF4bjm/o17wzzH3fH49kzunnz1QVRi9kXhzmLsjc2B+vylwznHsisy/a89bDpZkvYvEdpyJtUp221/vj5Mlon+25WL/fAQBgTYcyf/bxsz1zVcg8NRzfm/l4OD5dtdz4SObczObMr5mbMxdlvsp8k7nt+NURb8SicHop2vPXS33HZZ7OXJa5pB/XZ3u7j7+L9nkBAFbqoWjFSu3Rerk/zv2euX043pl5bzg+XdUl+zkWy41TYVhF0bIO2o/D+L5YXixdHf/8Dptmx3PVLRtfe3Jr5srMM9E6fY9F68h92M8fzVzexwAAK1Xdqs/nk93WaMXZ1Nm6P1oBNy+KzlS9fm3k3x6tYHslWpdtKo7K2AWrLl9t/p+rJcrHY/H56saAKrxO5M5ov8GpWFZQAgCsRBVkn8RiWXTu1cyD0QqUyqr2bB2ORSes3mN6n1sye/v43xRskyraPoqTF2vVXavl3euGuVqiBQD4z6gO1vXRiqFxY/3k02jLgatU3bDqqC1Ty55TMXcqBVstjR6Ik3cCq1Cr5dBx2fTuYQwAsKE+GMZ7e+bW2ow/VwXPPZkH1kh18papTf1112V5NNretP2Zu/pcddjejNZx+7bPlbp2rdesArM6a/Wch+PERVsthc6/Y90ZCwCwoX6LVqTUnrFJjae5uiPyrcwvfe6zaJvt11stsU5/p1GpTld1vKrAej+zK/PT8asjLs68m9mR+XKYH9VfhGybzVXBuMz4dx51x+c0vna8CACA5ep/4KrQqj1mo1oirXn7zAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/o/+BoiAcsJwA8c2AAAAAElFTkSuQmCC>

[image6]: <data:image/png;base64,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>