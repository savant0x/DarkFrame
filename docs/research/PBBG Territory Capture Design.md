# **Siege Warfare Redesign: Economy, Psychology, and Mechanics in Persistent Browser Strategy MMOs**

## **Executive Verdict and Strategic Risk Assessment**

The architectural transition from a stochastic, globally accessible territory capture system to a topological, army-based siege framework represents a mature paradigm shift for persistent browser-based games (PBBGs). By demanding geographic contiguity and enforcing real military commitments, the design naturally addresses systemic inflation and unearned dominance. The replacement of arbitrary dice rolls with a multi-stage siege model successfully integrates core tenets of behavioral economics, specifically the Zeigarnik effect and asymmetric loss aversion, to drive ethical player retention.

However, the current architectural draft presents three critical structural risks that must be mitigated before deployment:

> 1. **The Asynchronous Vulnerability Risk (Sleep Deprivation Farming):** The intentional omission of a defender warning window in a 48-hour continuous war season heavily incentivizes nocturnal raiding. Without systemic friction to slow down uncontested attacks, the design risks fostering severe player burnout.  
> 2. **Macroeconomic Spoils Laundering:** The introduction of a 15% treasury spoils mechanic within chained feuds creates a massive vector for wealth consolidation. If allied clans engage in cartel wars—purposefully losing to transfer wealth—the game's economy will rapidly destabilize.  
> 3. **Database Concurrency Exploits:** Moving from a simple numerical deduction to a multi-stage state machine involving decaying wall health, garrison commitments, and counter-captures introduces complex race conditions. Without rigid transaction locks, players will utilize siege-logging to bypass the intended friction of the design.

Overall, the design is fundamentally sound and aligns with the most successful sovereignty and territory mechanics observed in the strategy MMO space. The remainder of this report provides a comprehensive analysis of the proposed mechanics, citing established precedents and offering concrete numerical frameworks to calibrate the game's economy.

## **Topological Conflict and the Architecture of Frontlines**

The imposition of frontline geography fundamentally alters the macro-strategy of territory control. In the previous iteration, global-reach captures allowed dominant clans to project power instantaneously, reducing the 150×150 grid to an abstract ledger of passive income. By mandating geographic contiguity, the map transforms into a physical theater governed by logistics, distance, and terrain.

This design choice echoes the sovereignty mechanics observed in expansive strategy games such as EVE Online and Foxhole. In Foxhole, the necessity of maintaining forward operating bases and physically transporting supplies to the front creates organic chokepoints and secure backlines1. Similarly, the PBBG redesign forces clans to "eat toward" high-value resource clusters, slowing the velocity of conquest. Deep tiles become safe havens that generate the economic fuel necessary to sustain border conflicts. The geographical constraint effectively neutralizes the ability of a high-level clan to execute surgical strikes on vulnerable, low-level entities across the map, naturally throttling the pace of warfare and providing defenders with the spatial buffer necessary to organize a strategic response.

## **Multi-Stage Sieges and the Mathematics of Persistence**

A fundamental deficiency of the legacy capture system was its instantaneous resolution. A contested tile that resolves in a single calculation denies both combatants the narrative arc of warfare, reducing engagement to a momentary transaction. By disaggregating the capture into discrete, sequential stages—Breach, Assault, and Occupation—the system establishes a progressive investment loop that escalates tension over the 48-hour war season.

### **The Mechanics of the Breach**

Precedent from established persistent strategy titles underscores the necessity of decoupling fortification destruction from primary infantry engagements. In Travian, defensive infrastructures utilize compounding mathematical formulas to calculate wall strength. For instance, the Roman City Wall applies a multiplier of 1.03 to the power of the wall's level, yielding a substantial 80% defensive bonus at maximum level3. To overcome such fortifications, attackers are compelled to deploy specialized siege units, such as rams or catapults, which calculate damage based on a secondary "virtual level" formula before infantry combat is even resolved5.

The redesign's Breach stage mirrors this effectively. By requiring attackers to dismantle a fortification layer prior to engaging the garrison, the game introduces a specialized economic sink. The persistent state of this destruction (e.g., "Wall at 12%") leverages the Zeigarnik effect, a psychological phenomenon where individuals experience an intrusive drive to complete interrupted or incomplete tasks7.

### **Siege Decay and Maintenance Friction**

To prevent the Zeigarnik effect from manifesting as a costless, perpetual re-roll machine for the attacker, persistent siege progress must be counterbalanced by rigorous decay and upkeep mechanics. In games with extensive persistent building, the upkeep of forward structures scales to prevent server stagnation and map clutter. Foxhole manages this via Garrison Supplies (Gsupps/Msupps), where maintenance costs scale dynamically based on the subregion's structural density, sometimes reaching a modifier of 8x to 12x the base maintenance cost1.

For a 48-hour PBBG season, siege progress must decay significantly if unmaintained. The evidence suggests an aggressive decay rate—approximately 25% to 33% of maximum wall health regeneration per 12 hours of inactivity. This forces the attacking clan to commit continuous economic and military resources to hold their progress. If the attacker's logistics falter, the siege naturally resets, relieving the defender from perpetual, low-effort harassment and preventing the mechanic from feeling Sisyphean.

### **The Assault Phase and the Mathematics of Attrition**

Once a breach is secured, the Assault phase forces a direct confrontation between the garrisoned armies. Transitioning from a clan-level deterministic roll to a resolved unit power system introduces the necessary risk of catastrophic loss. In mathematical models governing persistent browser combat, casualties are typically calculated via a ratio of total offense points to total defense points. For example, Travian calculates proportional losses using the formula (loser\_strength / winner\_strength)^1.54. A stronger attacker loses fewer troops proportionally, but a victorious assault is never entirely bloodless; the ratio dictates that even an overwhelming force will suffer measured attrition4.

By forcing players to commit real units that are subject to permanent death, the game economy establishes a massive resource sink. This attrition model ensures that territory gains are economically meaningful but heavily paid for, acting as a natural governor against runaway expansion.

## **Army Commitment and Economic Equilibrium**

The fundamental flaw of the legacy system was the macroeconomic asymmetry between the cost of conflict and the passive income generated by the territory. When war declarations cost a flat 50,000 currency and captures require only an abstract fee, the relationship between investment and territorial yield becomes highly inflationary. The macroeconomic analysis of virtual economies dictates that without proportional resource sinks, currency valuations collapse, and player engagement diminishes as wealth loses its utility10.

By demanding real army commitments, the cost of a siege is dynamically linked to the industrial capacity required for troop production. A balanced macroeconomic framework requires that the cost of capturing a tile be intricately balanced against its expected lifetime value. Given that a tile yields between 1,000 and 3,900 materials/energy per day in this PBBG ecosystem, a successful capture should incur military losses equivalent to roughly three to five days of that tile's production value. Therefore, a victorious siege should bleed approximately 12,000 to 20,000 resources worth of units from the attacker. A failed siege, resulting in a total rout, should cost the attacker upward of 30,000 to 50,000 resources.

The concept of Gross User Product (GUP), which measures aggregate economic activities in virtual spaces, indicates that player-driven production must be continually offset by systemic entropy to prevent hyperinflation12. Army casualties function as the ultimate systemic entropy. By shifting the capture mechanism from a treasury tax to actual unit destruction, the game directly ties the velocity of the war to the industrial output of the clans. A clan can only sustain territorial expansion as long as its logistics and troop training queues can replenish the front lines, creating a self-regulating economic equilibrium.

## **Defender Agency and the Absence of Warning Windows**

The operator's decision to omit a formalized warning window—such as a 4-hour invulnerability buffer post-declaration—fundamentally alters the pacing of the war. It heavily rewards continuous vigilance and asynchronous coordination, removing the artificial scheduling of battles known as appointment mechanics13. However, replacing structured vulnerability with an environment of persistent vulnerability introduces severe risks regarding offline raiding.

### **Mitigating Offline Raiding: The Activity Defense Multiplier**

Without a warning window, defenders who are offline are highly susceptible to being systematically dismantled by localized timezone advantages. In games with massive, un-warned sieges, coordination across global timezones becomes a prerequisite for survival, often leading to severe player burnout and churn. To mitigate this without reintroducing invulnerability timers, the system must rely on structural, algorithmic friction.

The Activity Defense Multiplier (ADM) utilized in EVE Online provides an elegant architectural precedent. In EVE's "Fozzie Sov" sovereignty system, a solar system's defensive resilience scales from a 1.0x to a 6.0x time multiplier based on the economic activity (such as mining or NPC hunting) recently conducted by its owners14. This ensures that actively utilized space is exponentially harder to capture than abandoned space.

In the absence of a warning window, the PBBG redesign must implement an analog to the ADM. A tile that has been actively harvested, or a frontier where the defending clan has exhibited high recent login activity, should receive a massive, invisible structural buff to its wall health and baseline garrison resolve. This ensures that active clans cannot be blitzkrieged while they sleep; the sheer time and resource cost required to breach a high-activity tile will naturally stall the attacker's progress until the defending clan logs in to mount a response. This creates an organic warning window generated purely by the defender's prior economic engagement.

### **Bidirectional Capture and Loss Aversion**

The introduction of bidirectional capture—allowing defenders to recapture lost tiles or counter-siege the attacker's staging ground—is a critical component of ethical retention. The behavioral economic principle of loss aversion, a core tenet of Prospect Theory developed by Kahneman and Tversky, demonstrates that human beings experience the psychological pain of losing an asset roughly twice as intensely as the pleasure of gaining an equivalent asset17.

By granting defenders the systemic agency to physically counterattack and reclaim their property, the game channels this psychological friction into intense, revenge-driven engagement rather than helpless frustration. Furthermore, the capacity to execute emergency fortification protocols provides a vital economic sink. While permanent fortifications (watchtowers, bastions) act as deterrence, the ability to rapidly dump treasury funds into a temporary defensive spike upon noticing an active siege allows a smaller, wealthy clan to survive against a larger, militarily superior clan by financially out-enduring the attacker's infantry reserves.

## **Anti-Dominance, Feud Escalation, and Comeback Mechanics**

A persistent threat in 4X and grand strategy game design is the "snowball effect," wherein the victor of an early conflict secures an economic advantage that mathematically guarantees their dominance in all subsequent conflicts, rendering the late-game a tedious, deterministic slog20. The redesign counters this through the implementation of chained feuds and war weariness mechanics.

### **Rivalry Mechanics and Escalation Brakes**

Consecutive 48-hour wars between the same clans chaining into a persistent feud with an escalating rivalry score is a profound narrative and mechanical tool. As feuds escalate, spoils percentages and grudge mechanics increase, amplifying the stakes. However, to prevent a dominant clan from continuously bleeding a weaker rival dry via the 15% treasury spoils mechanic, strict escalation caps must be enforced.

War weariness mechanics, heavily utilized in grand strategy titles like the Civilization franchise and Humankind, disrupt the snowball by penalizing the aggressor's domestic economy or military morale the longer they remain in a state of sustained conflict20. In the context of the PBBG, as a feud's rivalry score increases, the base cost of declaring subsequent 48-hour seasons against the same target must scale geometrically (e.g., 50,000, 150,000, 450,000 M/E). Additionally, troops deployed into a high-rivalry feud should suffer from exhaustion debuffs, simulating logistical overextension and forcing dominant clans to seek new targets rather than perpetually farming a single victim.

### **Asymmetrical Determination and Division Scaling**

Allowing a Level 50 clan to declare war on a Level 10 clan, even with adjacency constraints, will result in immediate player churn due to a lack of meaningful agency for the defender. Games like eRepublik solve this through Division formatting, where battles are segregated by player strength, ensuring that lower-level entities can still contribute meaningfully to a campaign24.

While physical map adjacency restricts some extreme matchmaking, the war system must include asymmetrical comeback mechanics. Drawing inspiration from eRepublik's resistance war mechanics—where oppressed regions gain up to a 2.5x influence multiplier against their occupiers over time24—the PBBG should implement a "Determination Bonus." If a clan with a massive power differential attacks a significantly smaller clan, the defending garrison should receive a scaling resolve multiplier. This does not make the smaller clan invincible, but it guarantees that the larger clan will suffer disproportionately high, inefficient casualties to secure the tile, transforming a trivial farm into a pyrrhic victory.

## **Retention Architecture: Ethical Loops vs. Dark Patterns**

The architecture of player retention must carefully navigate the boundary between ethical behavioral reinforcement and predatory manipulation. Dark patterns in game design intentionally obfuscate costs, utilize forced continuity, or deploy psychological traps—such as pay-to-skip grind walls or deceptive scarcity—to coerce engagement contrary to the player's best interests26. Conversely, ethical design respects player agency, utilizing transparent mechanics that reward mastery, social obligation, and strategic foresight while providing clear exit points26.

### **Variable-Ratio Schedules and Progress Visibility**

The transition from a guaranteed deterministic capture roll to a contested, multi-stage assault represents a shift toward a variable-ratio reward schedule. Because the defender has the agency to reinforce, and the combat mathematics include slight variances, the exact outcome of a siege is uncertain. Behavioral psychology establishes that variable-ratio schedules yield the highest and most resilient rates of engagement, as the unpredictability of the reward triggers sustained neurochemical responses.

Coupled with this is the transparent disclosure of progress. Displaying that a wall is "12% from a breach" creates a powerful completion pull. In dark pattern design, this pull is monetized via premium currency skips29. In ethical PBBG design, this pull is resolved through strategic patience and logistical planning. The cost of maintaining the siege is paid in standard in-game resources (upkeep), ensuring the player's agency is preserved; they can mathematically calculate the exact cost of abandoning the siege versus completing it, with hard caps preventing irreversible sunk-cost spirals27.

### **Social Obligation over Arbitrary Timers**

Social obligation is a vastly superior retention tool compared to arbitrary login timers. The broadcast of map-visible siege banners, shared war-score UIs, and post-war spoils ceremonies creates a shared communal narrative. A player logs in not because an artificial timer expired, but because their clan's frontline is buckling and their specific garrison is required to hold a vital chokepoint. This transforms the game from a solitary clicking exercise into a collaborative logistical effort.

To safeguard against pathological engagement, hard caps are essential. The proposed limit on the maximum number of assaults per tile per day acts as an ethical brake. It prevents a clan from completely liquidating its years of accumulated military assets in a single, tilted session of revenge-driven gambling. The 7-day cooldown after a 48-hour season enforces a mandatory cooling-off period, preventing war fatigue and ensuring that conflicts remain highly anticipated, strategic events rather than continuous, exhausting chores.

## **Database Concurrency and Anti-Abuse Vectors**

The implementation of complex state-machines (multi-stage sieges, decay, treasury spoils, and counter-captures) in a single-PostgreSQL environment exposes the architecture to severe exploitation if not rigorously guarded by strict server-side logic.

> 1. **Spoils Laundering and Cartel Wars:** The 15% treasury spoils mechanic creates a vector for wealth consolidation. Two allied clans could declare war on each other, purposefully lose, and transfer 15% of a massive treasury back and forth to launder resources or bypass trade restrictions. To mitigate this, the 15% spoils must be strictly capped against the actual economic value of the troops physically destroyed during the conflict. Wealth cannot be transferred without an equivalent deletion of virtual capital from the game world.  
> 2. **Siege-Logging and Ghosting:** Without warning windows, attackers might initiate a siege micro-seconds before the daily server decay tick, or pull their troops out instantly when a defender logs on to counterattack. The database must enforce a strict "Combat Lock." In mechanics like EVE's Entosis links, a committed ship cannot cloak, dock, or receive outside assistance30. Similarly, once units are garrisoned onto a frontier tile for an assault, they must be locked in a read-only database state for a minimum of 15 to 30 minutes, preventing attackers from teleporting away to dodge consequences.  
> 3. **Database Race Conditions:** Multiple players from a clan assaulting a breached wall simultaneously could trigger negative health integers or duplicate occupation states. Standard PostgreSQL SELECT ... FOR UPDATE row-level locks must be utilized on the target tile's UUID during the combat resolution calculation to prevent concurrent writes from corrupting the capture sequence.

## **Synthesized Parameters and Design Frameworks**

The following tables synthesize the qualitative analysis into actionable, structural parameters. These benchmarks are specifically calibrated for a 22,500-tile map with tile yields of 1,000–3,900 resources per day, ensuring macroeconomic stability and pacing.

### **Foundational Pattern Matrix**

&nbsp;

| Mechanic | Source Game(s) | Observed Effect | PBBG Implementation Strategy |
| :---- | :---- | :---- | :---- |
| **Percentage-Based Wall Defense** | Travian3 | Forces attackers to build specific siege units, delaying instant infantry wipes and creating staging phases. | Breach stage requires heavy resource expenditure; walls mitigate 10-50% of garrison casualties. |
| **Activity Defense Multiplier (ADM)** | EVE Online14 | Prevents offline farming by tying structural defense to recent player activity within the territory. | Tiles owned by highly active players take 3x-5x more damage/resources to breach, acting as an organic warning window. |
| **Escalating Upkeep (Msupps)** | Foxhole1 | Acts as an economic brake on massive, sprawling fortifications, preventing map stagnation. | Persistent watchtowers/bastions incur exponential daily upkeep costs based on clan tile density. |
| **Divisional / Determination Combat** | eRepublik24 | Allows smaller/weaker players to meaningfully engage against juggernauts via scaling resistance. | Asymmetrical combat modifiers; smaller clans receive a defensive resolve bonus against top-tier attackers. |
| **War Weariness / Grievance** | Civilization, Humankind20 | Stops endless snowballing by crippling the domestic economy and morale of constant warmongers. | Chained feuds increase the base declaration cost geometrically and increase troop exhaustion per subsequent season. |
| **Multi-stage Loyalty/Chiefing** | Tribal Wars32, Travian34 | Spreads the capture climax across multiple attacks, heightening narrative tension. | Staged sieges (Breach \-\> Assault \-\> Occupy) preventing one-click territorial transfers. |

### **Economic and Combat Parameter Benchmarks**

| Parameter | Recommended Value / Formula | Justification (Macroeconomic Balance) |
| :---- | :---- | :---- |
| **Failed Siege Cost (Attacker)** | \~35,000 \- 50,000 equivalent resources | A complete wipe should penalize the attacker heavily, effectively equal to losing the 50k declaration fee. |
| **Successful Capture Cost** | \~12,000 \- 20,000 equivalent resources | A victory must bleed the attacker's military by 3 to 5 days of the tile's passive yield, preventing infinite expansion. |
| **Siege Decay Rate** | 25% wall health regeneration per 12h | Ensures unmaintained sieges reset within a 48h season; forces attackers to pay constant upkeep to utilize Zeigarnik effect. |
| **Spoils Cap** | 15% Treasury (Strictly capped by Total Casualties) | Prevents cartel laundering. A clan cannot win more in spoils than the economic value of the troops destroyed during the war. |
| **Daily Capture Cap** | 6 to 12 tiles per clan per 48h season | Paces the war. Allows topological progression without allowing a dominant clan to sweep 50 tiles in a single night. |
| **Fortification Upkeep** | **![][image1]** | Exponential scaling prevents clans from creating impenetrable walls across 1,000 owned tiles. |

### **48-Hour Season Beat Sheet (Ideal Narrative Arc)**

| Time | Phase | Player Actions and System Responses |
| :---- | :---- | :---- |
| **T-0:00** | Declaration | War fee paid (scales based on feud level). Map updates with visible war banners. Adjacency targets unlocked. |
| **T+0:00 to 12:00** | The Probing | Attackers launch initial Breach attempts against border tiles. Defenders notice map pings and begin rushing garrisons and emergency treasury fortifications to key chokepoints. |
| **T+12:00 to 24:00** | The Attrition | Walls are breached on primary targets. Brutal infantry assaults begin. Both sides bleed units. Attackers set up persistent siege camps; upkeep costs begin draining attacker reserves. |
| **T+24:00 to 36:00** | The Counter-Offensive | Defenders utilize counter-capture mechanics on vulnerable attacker staging tiles, attempting to sever supply lines or flank the primary siege. Momentum score fluctuates wildly. |
| **T+36:00 to 47:59** | The Climax | Both clans hit their daily capture caps or exhaust their infantry reserves. High levels of online concurrency as final occupation timers tick down. |
| **T+48:00** | Settlement | System locks combat. War momentum resolves. Spoils (capped by casualties) and XP swings distributed in the Spoils Ceremony. 7-day cooldown initiated. |

## **Strategic Recommendations and Deficiencies**

### **Top 5 Concrete Recommendations (Ranked)**

> 1. **Implement an Activity Defense Multiplier (ADM) to replace the missing warning window.** Without a formalized warning window, the system is exceptionally vulnerable to nocturnal farming, leading to rapid player burnout. By linking the defensive strength of a tile's wall to the recent login activity or economic harvesting of the owning clan, active players are organically protected while offline. It preserves the "no warning" design while mathematically requiring the attacker to spend hours breaching an active tile, effectively generating a dynamic, systemic warning.  
> 2. **Cap the 15% Treasury Spoils against the total economic value of casualties inflicted.** A flat 15% transfer of a loser's treasury invites massive macroeconomic abuse via shell-clans and win-trading. By restricting the maximum payout to the equivalent material/energy cost of the troops physically destroyed during the specific 48-hour season, the reward is aligned with actual effort. This guarantees that wealth cannot be transferred without an equivalent deletion of virtual capital from the game world, preserving anti-inflationary stability.  
> 3. **Enforce an exponential upkeep curve on persistent fortifications.** If watchtowers (+10%) and bastions (+25%) carry only a flat, linear cost, dominant clans will blanket their entire territory in them, creating a stagnant, impenetrable map. Implementing a density-based upkeep formula—where each additional fortification a clan builds geometrically increases the daily maintenance cost of all fortifications—forces clans to make strategic choices about which specific borders to heavily defend, naturally creating weak points that drive conflict.  
> 4. **Instantiate a strict 15-minute "Combat Lock" for committed garrisons.** To prevent siege-logging (where an attacker withdraws their army the exact second a defender logs in to respond), any army committed to a frontier tile for an assault must be locked in state. During this window, the army cannot be recalled and is fully vulnerable to defender counter-attacks. This guarantees consequence for aggression and provides defenders with guaranteed tactical agency.  
> 5. **Introduce Asymmetrical Determination Bonuses for lower-tier clans.** Since army power strictly resolves combat, the influence of a Level 50 clan against a Level 10 clan is mathematically absolute. To maintain a healthy ecosystem where lower-tier clans are not merely farmable content, apply a "Determination Multiplier" to the defensive stats of a smaller clan when attacked by a significantly higher-tier clan. This ensures the larger clan will suffer immense, inefficient casualties to take the territory, serving as a soft-cap against outright bullying while leaving the physical capture mechanics intact.

### **Critical Deficiencies (The Missing List)**

* **Supply Line Mechanics:** The design requires adjacency but lacks a penalty for extreme salients. If a clan captures a single-tile wide corridor 20 tiles deep into enemy territory, those frontlines should suffer severe logistical debuffs compared to a consolidated, circular empire. The current system treats all adjacent tiles equally, regardless of supply line integrity.  
* **Scouting and Information Warfare:** The design currently moves from war declaration immediately to the breach phase. Strategy games rely heavily on information asymmetry. There is no mechanism described for defenders to obscure their garrison size, or for attackers to risk resources (such as scout units) to probe a wall's strength prior to committing a massive army.  
* **Intra-Clan Contribution Ledgers:** While the war generates social obligation, there is no mention of a systemic contribution ledger. High-retention games display exactly which clan members inflicted the most casualties, donated the most resources to emergency fortifications, or achieved the highest siege progress. This drives intra-clan competition, social validation, and deepens investment.

### **Redundancies (The Cut List)**

* **Clan Level as a Direct Combat Modifier:** If the system resolves using the pure mathematical power of the physical units committed, applying an additional \+/- 10-20% modifier based on clan level double-counts the systemic advantage. Higher-level clans already possess the economic bandwidth to field vastly superior unit compositions. Adding a flat mathematical modifier on top of their economic advantage artificially accelerates the snowball effect. It is recommended to remove this entirely, allowing unit composition and strategic placement to dictate the outcome.  
* **Pre-calculated 50,000 War Declaration Fee (In Later Feud Stages):** If the redesign properly forces armies to commit and die (acting as the primary resource sink), a flat, upfront currency fee is a vestigial mechanic from the old "pay-to-roll" design. While useful as a baseline deterrent, it unnecessarily restricts smaller clans from participating in topological conflict. The true cost of war should be the blood of the units, the exponential upkeep of the siege engines, and the risk of the counter-capture, rendering flat bureaucratic toll booths obsolete.

#### **Works cited**

> 1. Am I the only 1 who feels Maintainence Supplies are way too, [https://www.reddit.com/r/foxholegame/comments/11vot6e/am\_i\_the\_only\_1\_who\_feels\_maintainence\_supplies/](https://www.reddit.com/r/foxholegame/comments/11vot6e/am_i_the_only_1_who_feels_maintainence_supplies/)  
> 2. r/foxholegame \- Decay and maintenance completely overhauled., [https://www.reddit.com/r/foxholegame/comments/11l93g4/decay\_and\_maintenance\_completely\_overhauled/](https://www.reddit.com/r/foxholegame/comments/11l93g4/decay_and_maintenance_completely_overhauled/)  
> 3. Travian Calculations and Formulae, [https://travianlibrary.wordpress.com/2009/03/15/travian-calculations-and-formulae/](https://travianlibrary.wordpress.com/2009/03/15/travian-calculations-and-formulae/)  
> 4. Game Secrets \~ Combat bonuses: own village defense, [https://unofficialtravian.com/2025/01/game-secrets-combat-bonuses-own-village-defense/](https://unofficialtravian.com/2025/01/game-secrets-combat-bonuses-own-village-defense/)  
> 5. Cant understand ram formula \- Math Stack Exchange, [https://math.stackexchange.com/questions/3238329/cant-understand-ram-formula](https://math.stackexchange.com/questions/3238329/cant-understand-ram-formula)  
> 6. Combat Simulator \- Travculator, [https://travculator.com/combat](https://travculator.com/combat)  
> 7. Gamification for Improving Cybersecurity \- Torino \- WebThesis \- PoliTO, [https://webthesis.biblio.polito.it/22846/1/tesi.pdf](https://webthesis.biblio.polito.it/22846/1/tesi.pdf)  
> 8. Current Supply System Is Unpredictable, Poorly Understood ... \- Reddit, [https://www.reddit.com/r/foxholegame/comments/11x8iry/current\_supply\_system\_is\_unpredictable\_poorly/](https://www.reddit.com/r/foxholegame/comments/11x8iry/current_supply_system_is_unpredictable_poorly/)  
> 9. Very poor can get to over 8 bunker supplies per structure ... \- Reddit, [https://www.reddit.com/r/foxholegame/comments/11w852o/very\_poor\_can\_get\_to\_over\_8\_bunker\_supplies\_per/](https://www.reddit.com/r/foxholegame/comments/11w852o/very_poor_can_get_to_over_8_bunker_supplies_per/)  
> 10. Virtual Economy: A Complete Overview – WUAB, [https://wuab.org/magazine-articles/virtual-economy-a-complete-overview/](https://wuab.org/magazine-articles/virtual-economy-a-complete-overview/)  
> 11. Designing an Open Game Economy (Part 1\) \- Paragraph, [https://paragraph.com/@lordheimdall/designing-an-open-game-economy-part-1](https://paragraph.com/@lordheimdall/designing-an-open-game-economy-part-1)  
> 12. Macroeconomic indicators in a virtual economy \- Helda, [https://helda.helsinki.fi/bitstreams/b22c4145-6dfb-494b-8c0d-ec2e31249cf6/download](https://helda.helsinki.fi/bitstreams/b22c4145-6dfb-494b-8c0d-ec2e31249cf6/download)  
> 13. The Pyramid of Game Design: Designing, Producing and Launching, [https://dokumen.pub/the-pyramid-of-game-design-designing-producing-and-launching-service-games-9780429815676-0429815670-9781138298897-9781138298996.html](https://dokumen.pub/the-pyramid-of-game-design-designing-producing-and-launching-service-games-9780429815676-0429815670-9781138298897-9781138298996.html)  
> 14. Activity Defense Multiplier \- EVE Online support, [https://support.eveonline.com/hc/en-us/articles/203354271-Activity-Defense-Multiplier](https://support.eveonline.com/hc/en-us/articles/203354271-Activity-Defense-Multiplier)  
> 15. Entosis Link | The Ancient Gaming Noob, [https://tagn.wordpress.com/tag/entosis-link/](https://tagn.wordpress.com/tag/entosis-link/)  
> 16. Summer 2015 Nullsec and Sov Status Report \- EVE Online, [https://www.eveonline.com/news/view/summer-2015-nullsec-and-sov-status-report](https://www.eveonline.com/news/view/summer-2015-nullsec-and-sov-status-report)  
> 17. Innovation and Entrepreneurship: The Role of Prospect Theory in, [https://www.intechopen.com/chapters/86997](https://www.intechopen.com/chapters/86997)  
> 18. What Is Prospect Theory? Loss Aversion & Kahneman-Tversky, [https://yukaichou.com/behavioral-analysis/prospect-theory-loss-aversion-kahneman-tversky/](https://yukaichou.com/behavioral-analysis/prospect-theory-loss-aversion-kahneman-tversky/)  
> 19. Prospect theory \- Wikipedia, [https://en.wikipedia.org/wiki/Prospect\_theory](https://en.wikipedia.org/wiki/Prospect_theory)  
> 20. Best feature to prevent snow-balling : r/4Xgaming \- Reddit, [https://www.reddit.com/r/4Xgaming/comments/1f9vx9e/best\_feature\_to\_prevent\_snowballing/](https://www.reddit.com/r/4Xgaming/comments/1f9vx9e/best_feature_to_prevent_snowballing/)  
> 21. 4X games largely have not figured out late game : r/4Xgaming \- Reddit, [https://www.reddit.com/r/4Xgaming/comments/18gs97z/4x\_games\_largely\_have\_not\_figured\_out\_late\_game/](https://www.reddit.com/r/4Xgaming/comments/18gs97z/4x_games_largely_have_not_figured_out_late_game/)  
> 22. What Can Civ VII Learn From Humankind and other games? | Page 2, [https://forums.civfanatics.com/threads/what-can-civ-vii-learn-from-humankind-and-other-games.669762/page-2](https://forums.civfanatics.com/threads/what-can-civ-vii-learn-from-humankind-and-other-games.669762/page-2)  
> 23. War is too powerful : r/civ \- Reddit, [https://www.reddit.com/r/civ/comments/17wo24l/war\_is\_too\_powerful/](https://www.reddit.com/r/civ/comments/17wo24l/war_is_too_powerful/)  
> 24. Basic Knowledge to Grow as a Player \- published by Zur1en on day, [https://www.erepublik.com/en/article/2761775](https://www.erepublik.com/en/article/2761775)  
> 25. Changes to Campaigns and Epic Battles \- eRepublik, [https://www.erepublik.com/en/main/latest-updates/0/203](https://www.erepublik.com/en/main/latest-updates/0/203)  
> 26. GDnD Wiki Index, [https://gdad.wiki/](https://gdad.wiki/)  
> 27. Dark Patterns in Game Design Analysis | PDF | Experience \- Scribd, [https://www.scribd.com/document/841651699/DarkPatterns-Zagal-Et-Al](https://www.scribd.com/document/841651699/DarkPatterns-Zagal-Et-Al)  
> 28. \[2305.07392\] The Ethics of AI in Games \- ar5iv \- arXiv, [https://ar5iv.labs.arxiv.org/html/2305.07392](https://ar5iv.labs.arxiv.org/html/2305.07392)  
> 29. Developer Perspectives on Temporal Design in Video Games, [https://minerva-access.unimelb.edu.au/server/api/core/bitstreams/10ec965c-1a6e-4699-baa0-5f56ac8eface/content](https://minerva-access.unimelb.edu.au/server/api/core/bitstreams/10ec965c-1a6e-4699-baa0-5f56ac8eface/content)  
> 30. Carnyx | The Ancient Gaming Noob, [https://tagn.wordpress.com/tag/carnyx/](https://tagn.wordpress.com/tag/carnyx/)  
> 31. Battle Mechanics | Travian: Legends, [https://support.travian.com/en/articles/63-battle-mechanics](https://support.travian.com/en/articles/63-battle-mechanics)  
> 32. Unraveling some myths regarding the battle engine | Tribal Wars 2, [https://en.forum.tribalwars2.com/index.php?threads/unraveling-some-myths-regarding-the-battle-engine.3959/](https://en.forum.tribalwars2.com/index.php?threads/unraveling-some-myths-regarding-the-battle-engine.3959/)  
> 33. Battles \- Tribalwars Wiki EN, [https://help.tribalwars.net/wiki/Battles](https://help.tribalwars.net/wiki/Battles)  
> 34. chief | Travian Library, [https://travianlibrary.wordpress.com/tag/chief/](https://travianlibrary.wordpress.com/tag/chief/)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALEAAAAaCAYAAAD48r3oAAAHaklEQVR4Xu2ad4gkRRTGPzFgzpjFNZ2IZ06cARcTBhRRQcUIciqKiorhxLAm5DB7nn+ohwGMGDEHvD0VM6KiKKKgYkBFBTnFw/h+9/rd1NT0zM7OzewOe/3Bx2xXd1dXv/rqheqVKlSoUKFPcYjxbeMXxleNw8Xvw8aBBVd1H0sapxrXS9qWKtorjCNWUn9NAmNhTCPhaLl4l0/aDjO+Y1wjaesmEO8dxrWL4yWM9xsPWnBFhTHHgcbr1H8ivtF4aH4iA2K6OWtbRe6h98/ae4U1jW8YN89P9Aq7GL82/pdwrvG74u9/jE8bJ8UNExzbGmerudcaMB6ZN7YJ+t43bzQsbTzOOLn4e3G5dztJ9WnAasZnjDslbSlCrAeXtOOJzy6Ol5G/A2kGixUPv6HxPuPhxl2ND8oXTer9lzNeLB8DHn8x427GJ1RbICcaHzP+YLzTuJVxVeMM4+Xyxch9PL/rImf1/mHcMWvfVJ5jfaL6nGcigsllQnKRYuxTjS/LF/Xd9adbYmfjeXIR4RTOrz89Hysb31K9I4HXqjEa7Gd8QfXpQmBr42dqFAfHP8mFhigRGSkGII8+wHi6fIF9bpxSnOM9IyVAeFfLRbuZ8dni9xh5X4iexQdOVi0acN8pxu2Mrxs3MK4uz9UZb9eAQYaNH8sfkIOXwagTPcdBIB/Iw2EKRMBkE7W+0ehFjN0Qyu8qFzH2J9p9JHcYd8nvQwA5ECFiyBcaKMuHo51x420RGEI9Vj4WPDEeHmfFObwnz6UPFsvechAhYoxnGdeRe9i1int4BiAfxsNH2sMxfRMdHiqOcZQ4BCJE17CR8XvVXiBFCHyeaiu0H8A4B4rfZmByCIHtgH54/zyfTEHh8pVGJ+LA9motYvqMwmgkXCUXCoIINBs/fZMenVMc85zparRb3B9iJLWZo3qntrHxJuOPcvEDFsZrxS/gep6XRoO8bxYLuXtXwSrB09J5jiPkIfQW1RstgNciTK2fn8iAByFc4ZUQVxlY7YNqfU2AsVwo9wr5hACMiOcgfLUDjE8kalU49YuIsTfjSNO7snyY9IiU5BrV0hJEno4BT4qNuP9F+TgB17BY9pJ7Y1KQuA8bDRV/h/fGwe0hTzeeN64gTzUQN+/3pNwDM1f3qiboroHB4mkxDoaEvNil8gT9KNXynQAebqZ8cIQ2JgEREIJy78dLkxNSvJxgfNO4RXKe6zHu+/LCgOtY3ek1ZWBimKBzVS/k0QoYMHkUuDGJZeiliMkpr5eH62/luflAck0K+iI9iPqFecMz/ykX223yLS484p6qtw02eUAuIsZygVzs5KcUbFHI4blvMJ4p3/OdZjxNXmzSP+IHzBf9cZ5+mLPh4pj0DPB85ohCcUj+fj3Jh0n8WVEMEM6Si/JK44pxcQHEwzWvqPbSzVISPPW78hUKEDyePXItno/x0r4Anp/JGQm5kDsRMMD7M37eoxl6KWK8F1GPd4BXyIu0sveIcXRao+CQiDxp0UjbsskxwLmkc8k4YQ68burkiKgwwLN4f+aXRcV8l/XTMZqJDwzIC433VL/lhGdFiGlxwcr6TY0pSUwei4KcClEPqmZAKtd/VesrtpseVXub+yCEfLs6EzBAEAijVUjvlYixO0JI7Y+XZbdoKGkLxDi6HpJ7hFvlTokUkeKu2RZhx2iVDwMmjPPhFaNKzb0WBmWS8nCM+AmR9AHx+LsX51jpLxXt7Et/Khc7e5WEptFgB3kfF6lxMbaD8RRxGeJ67JOnZzGO2Pftd0wyXiKfm55s0zbbHwYI6Tm5p4zwHwZEyGnIoNok/SjboiMdIcknX0OwMTFRTA1r4cLLNvJwzFYOxorUYjQYTxFPN/5l3Cdpi+uH1WibhU0nJhQiH24mPjzmPNVvrocB0y2S+CJE1cnfFAQId6o87YgEH1BExgIghLLpXSYKUgQKipEQAo4Ugvs6ETI5O568VcExkohJf9g/LXtuKxHTH3ZKRRzpRFmaRwRkrO3UDBMeFEE/y8WXGookHQP9Kk8F0hwzvHMYF/JFCg/LBE2Rf9kBCJ0UgXACWAjci1cODMkXQLrxzSY6/Ucx2AwI+Ck15sCdCBlbIIyIOGUIEef2AuR7fChh0WODHCFitgVzUA+wSxB98jtNbv+y/BGBU6sw5kUWeFgmI/JUvABbNmwx8fu38Uv5p8iy3BTxfGi8Ry5KtmEQLLsQj6smKvJUJhZPw24GW2sIK62K8V5sB80pruH+2Rr5fzWopCnmcgEHWIhnyL+ytYOISmW1AcLGLtgpbDZXboMti2tilyXfUaBwZXHEffAXeQSKYhl7zDQ+YjxeblecSzNP2+zLXIVRAsOz0xB5Md4Db5TmyQAxMVkw32tOwf8P4Ony+8cSQ2r8EjZWwH4sXIraQTW3A2Nj0Q9l7RUqzMcm8g8uk/MTfQTGSETjt0KFUvClii9nec7bD2BMl8lrkH4cX4U+AWnSDNX+VbGfQC1DutPuR6AKizDYw+azb6tP0GONdeXbk5WAK1SoUKFChQoVKlSooP8B19qI+0npR5kAAAAASUVORK5CYII=>