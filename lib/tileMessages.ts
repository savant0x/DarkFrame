/**
 * @file lib/tileMessages.ts
 * @created 2025-10-18
 * @updated 2026-05-06 — Massively expanded all pools (30-50 each)
 * @overview Randomized flavor text messages for all terrain types
 *
 * OVERVIEW:
 * Provides variety and immersion through randomized messages when viewing different tile types.
 * Tones include: military jargon, dark humor, lore/worldbuilding, jokes, philosophical,
 * pop culture nods, environmental storytelling, and player-facing strategy tips.
 */

import { TerrainType } from '@/types';

// ============================================================================
// WASTELAND — Empty, desolate terrain. Tone: bleak, opportunistic, eerie.
// ============================================================================
const WASTELAND_MESSAGES = [
  "Empty wasteland — Safe for base placement",
  "A barren stretch of desolation awaits your command",
  "The winds howl across this forgotten land",
  "Nothing but dust and memories remain here",
  "A perfect canvas for your empire's expansion",
  "The silence is deafening in this lifeless expanse",
  "Scorched earth — ready for new beginnings",
  "Your boots crunch on the dry, cracked ground",
  "This wasteland hungers for purpose and structure",
  "An empty slate awaits your strategic vision",
  "The locals call this place 'the nothing.' They're not wrong.",
  "Somewhere beneath this dust, an entire civilization is buried. Probably.",
  "No resources. No enemies. No excuses.",
  "The most dangerous thing about this tile is how boring it is.",
  "Even the radiation got bored and left.",
  "A perfect place to build — or to contemplate your life choices.",
  "The ground here is so dead, it makes philosophers look optimistic.",
  "Nothing grows here. Not even hope. Build a base anyway.",
  "This wasteland has been waiting 10,000 years for someone to care. That someone is you.",
  "Flat. Empty. Yours. Well, it will be.",
  "The last person who stood here is now part of the dust. Cheerful.",
  "Strategic value: low. Real estate value: somehow even lower.",
  "If silence had a zip code, this would be it.",
  "The wind here doesn't howl. It sighs. Resignedly.",
  "A blank check from the universe. Try not to waste it.",
  "This tile has seen empires rise and fall. Mostly fall.",
  "The ground is so dry, even your tears would evaporate on impact.",
  "Nothing here but potential and a faint smell of regret.",
  "The map says 'here there be nothing.' The map is accurate.",
  "You could build a monument here. To what, though?",
  "The wasteland doesn't judge. It just... is. Like your ex.",
  "A geologist's nightmare and a general's blank canvas.",
  "This place makes Mondays feel exciting by comparison.",
  "The only thing thriving here is your ambition. Barely.",
  "Somewhere, a real estate agent is calling this 'rustic charm.'",
  "The dirt here has given up. Don't you.",
  "Empty land, full possibilities. That's the pitch, anyway.",
  "If you listen closely, you can hear absolutely nothing. It's almost peaceful.",
  "This tile is the 'before' picture. You're the renovation.",
  "The wasteland stretches on. And on. And on. Bring snacks.",
  "No cover. No resources. No problem. You've had worse.",
  "The ground here remembers when it was an ocean. It doesn't like to talk about it.",
  "A monument to nothing in particular. Yet.",
  "The emptiness here is almost aggressive. Take that as a challenge.",
  "This is what 'starting from scratch' looks like. Literally.",
  "The horizon is flat, the ground is dead, and your dreams are alive. For now.",
  "Even the crows flew somewhere else. Build anyway.",
  "This wasteland is like a blank page — terrifying and full of potential.",
  "The last war ended here. The next one starts with you.",
  "Nothing here but you, the dust, and the crushing weight of existential freedom.",
];

// ============================================================================
// METAL — Resource tile. Tone: industrial, greedy, strategic, gritty.
// ============================================================================
const METAL_MESSAGES = [
  "Resource tile — Gather metal for construction",
  "Rich metal deposits glint in the sunlight",
  "Your sensors detect high-grade ore concentrations",
  "The earth here is heavy with raw materials",
  "Metal veins run deep beneath this ground",
  "Industrial potential radiates from this site",
  "Your mining equipment will feast here",
  "The bedrock hums with metallic resonance",
  "Fortunes await those who excavate these deposits",
  "This metal could forge an army",
  "The ground here is basically a metal buffet. Dig in.",
  "Your geologist is practically vibrating with excitement.",
  "This isn't dirt — it's a solidified paycheck.",
  "The ore here is so rich, it's basically showing off.",
  "Metal enough to build a fleet. Or one really impressive sword.",
  "The earth's crust here is showing off its bling.",
  "Your refineries are going to need a bigger boat.",
  "This deposit has been cooking for a few million years. It's ready.",
  "The metal here is so pure, it almost feels wrong to mine it. Almost.",
  "Every shovel full is a step closer to total domination.",
  "The ground here is 40% metal, 60% ambition.",
  "This is what 'striking gold' feels like, except it's better.",
  "Your mining drones are going to need therapy after this haul.",
  "The ore concentration here would make a chemist weep with joy.",
  "Metal: the original currency. Also the current one. Also the future one.",
  "This tile is basically a 'you're going to be okay' from the universe.",
  "The last miner who worked here retired rich. Coincidence? Probably not.",
  "Your construction queue just got a whole lot happier.",
  "The metal here has been waiting for someone worthy. That's you. Probably.",
  "Dig deep enough here and you might hit the planet's wallet.",
  "This is the kind of deposit that starts wars. Or funds them.",
  "The ground here is so metal, it headbangs.",
  "Your resource bar is about to get a serious workout.",
  "This ore body is the geological equivalent of a trust fund.",
  "The metal here doesn't just glint — it screams 'take me.'",
  "Every empire was built on ground like this. You're welcome.",
  "The mining report says 'exceptional.' Your wallet says 'finally.'",
  "This is the tile your grandkids will hear about. 'The Great Metal Haul.'",
  "The earth here is basically a piñata full of industrial-grade ore.",
  "Your production capacity just found its new best friend.",
  "The metal here is so abundant, it's almost wasteful. Almost.",
  "This deposit could fund three wars and still have change for a base expansion.",
  "The ground here is a love letter to your construction budget.",
  "Your mining lasers are going to need new calluses.",
  "This is what happens when geology and ambition collide.",
  "The ore here is practically begging to be turned into something useful.",
  "Metal enough to make your enemies jealous and your allies nervous.",
  "The earth here is rich. Your strategy should be richer.",
  "This tile is proof that the planet still has a few tricks up its sleeve.",
  "The metal veins here run so deep, they probably have their own ecosystems.",
];

// ============================================================================
// ENERGY — Resource tile. Tone: electric, volatile, sci-fi, urgent.
// ============================================================================
const ENERGY_MESSAGES = [
  "Resource tile — Harvest energy for power",
  "Raw energy crackles across this terrain",
  "The air shimmers with untapped potential",
  "Your sensors overload with power readings",
  "Energy flows freely from this nexus point",
  "The ground pulses with electromagnetic force",
  "Harness this power to fuel your war machine",
  "Ancient generators still hum beneath the surface",
  "This energy could power your entire operation",
  "The very air tastes of electricity and possibility",
  "The energy here is so thick, you could spread it on toast.",
  "Your power grid just felt a disturbance in the Force.",
  "This tile is basically a planet-sized battery. With your name on it.",
  "The electromagnetic field here is strong enough to fry a satellite.",
  "Energy readings are off the charts. The charts are on fire.",
  "The ground here doesn't just hum — it screams in kilowatts.",
  "Your capacitors are going to need a bigger bucket.",
  "This energy nexus has been charging for millennia. It's at 100%.",
  "The air here ionizes your hair. Consider it a free styling service.",
  "Power enough to run a city. Or one very ambitious death ray.",
  "The energy here is so volatile, it makes your ex look stable.",
  "Your turbines are going to spin so fast they'll file for independence.",
  "This is what 'more power' looks like when the planet means it.",
  "The electromagnetic pulse here could restart a dead heart. Or a dead empire.",
  "Energy: the one resource you can never have too much of. Until you can.",
  "The ground here is basically a live wire with delusions of grandeur.",
  "Your power reserves just got a promotion.",
  "The energy concentration here would make Tesla cry. Happy tears.",
  "This tile is the universe's way of saying 'here, have a boost.'",
  "The power here doesn't flow — it stampedes.",
  "Your energy problems just ended. Your storage problems just began.",
  "The nexus here is so potent, nearby compasses have given up.",
  "This is the kind of power that makes gods nervous.",
  "The energy here has been building since before your species existed. Spend it wisely.",
  "Your reactors are going to need a bigger 'on' switch.",
  "The electromagnetic field here has its own weather system. It's always thunderstorms.",
  "Power enough to light up the wasteland. Or burn it down. Your call.",
  "The energy here crackles with ambition. Much like yourself.",
  "This tile is a reminder that the planet still has fight left in it.",
  "Your energy bar just went from 'concerning' to 'concerningly good.'",
  "The power here is so raw, it hasn't even decided what it wants to be yet.",
  "This energy could fuel a revolution. Or a really long gaming session.",
  "The ground here is basically vibrating with 'what if.'",
  "Your power grid just found its soulmate.",
  "The energy readings here are so high, they've been classified as 'ambitious.'",
  "This is what happens when tectonic plates have too much caffeine.",
  "The energy here is practically begging to be weaponized. Just saying.",
  "Your batteries are going to need therapy after this charge.",
  "The power nexus here is the planet's way of investing in your future.",
  "Energy enough to make the sun jealous. The sun is already jealous.",
];

// ============================================================================
// CAVE — Mysterious exploration sites. Tone: eerie, adventurous, ominous, curious.
// ============================================================================
const CAVE_MESSAGES = [
  "Mysterious cave — Explore for secrets",
  "Dark passages beckon the brave",
  "Ancient mysteries hide in these depths",
  "Your torchlight barely penetrates the darkness",
  "Strange echoes emanate from below",
  "What treasures lie in wait?",
  "The cave mouth yawns like a hungry beast",
  "Legends speak of riches hidden here",
  "Only the fearless dare enter these depths",
  "The darkness holds both danger and reward",
  "The cave doesn't want you to enter. That's how you know it's worth it.",
  "Something in here is older than language. It's not happy to see you.",
  "The darkness here has texture. You don't want to know what it feels like.",
  "Your echo comes back changed. Slightly judgmental.",
  "This cave has been waiting for visitors for 10,000 years. Try to be interesting.",
  "The walls here have ears. And opinions.",
  "Enter at your own risk. The risk is mostly to your sanity.",
  "The cave goes down further than your courage. Good thing you brought a flashlight.",
  "Something moved in the darkness. Probably nothing. Probably.",
  "The air in here tastes like secrets and poor decisions.",
  "This cave was old when old was new. It's not impressed by you.",
  "The darkness here isn't empty — it's just being polite.",
  "Your footsteps echo for an uncomfortably long time. The cave is thinking.",
  "The last explorer who entered here came out... different. Richer, but different.",
  "This cave has more layers than your favorite onion. And it'll make you cry more too.",
  "The entrance is a mouth. The tunnels are a throat. You get the idea.",
  "Something ancient lives here. It pays rent in mystery.",
  "The cave doesn't judge. It just watches. And remembers.",
  "Your light creates shadows. The shadows create questions. The questions create dread.",
  "This cave has seen things. It's not sharing.",
  "The darkness here is so complete, it has its own gravitational pull.",
  "You're not the first to enter. You might not be the last. Statistically unlikely, actually.",
  "The cave whispers. You can't make out the words, but the tone is 'don't.'",
  "Every step deeper is a step further from common sense.",
  "The walls here are covered in symbols. They probably say 'turn back.' Or 'free gold.' Hard to tell.",
  "This cave is the planet's way of saying 'I have secrets.'",
  "The echo here doesn't just repeat — it editorializes.",
  "Something in the deep is breathing. It's probably the wind. Probably.",
  "The cave is dark, damp, and full of potential. Like your first apartment.",
  "Your courage is being tested. The cave is winning.",
  "The entrance smells like adventure and mild regret.",
  "This cave has more twists than a soap opera. And more monsters.",
  "The darkness here is patient. It's been waiting longer than you've been alive.",
  "You shine your light into the cave. The cave shines its darkness back.",
  "The cave doesn't charge admission. The exit fee is steeper.",
  "Something glitters in the deep. It's either treasure or teeth. Fifty-fifty.",
  "The cave is a reminder that the best things are hidden in the scariest places.",
  "Your map ends here. Your courage shouldn't.",
  "The cave has a certain... ambiance. If ambiance means 'impending doom.'",
];

// ============================================================================
// FOREST — Premium exploration. Tone: mystical, lush, ancient, rewarding.
// ============================================================================
const FOREST_MESSAGES = [
  "🌲 Ancient Forest — Explore for rare treasures (Better loot than caves!)",
  "🌲 Towering trees conceal untold riches",
  "🌲 The forest whispers of ancient secrets",
  "🌲 Rare artifacts are said to rest here",
  "🌲 Nature's bounty awaits the persistent seeker",
  "🌲 These woods have seen countless ages pass",
  "🌲 Premium loot lies hidden among the roots",
  "🌲 The canopy shields mysteries from prying eyes",
  "🌲 Your chances of discovery increase dramatically here",
  "🌲 Legendary items have been found in these groves",
  "🌲 The trees here are older than your civilization. They're not impressed.",
  "🌲 This forest doesn't just grow — it plots.",
  "🌲 The canopy is so thick, the sun needs a reservation.",
  "🌲 Something magical lives here. It pays rent in rare items.",
  "🌲 The forest floor is a treasure map written in moss and shadow.",
  "🌲 These trees have roots deeper than your student loans.",
  "🌲 The forest is alive. Not metaphorically. Actually alive. Proceed accordingly.",
  "🌲 Birds here sing in frequencies that make your loot detector tingle.",
  "🌲 This forest was ancient when ancient was a flex.",
  "🌲 The undergrowth hides more secrets than a politician's email.",
  "🌲 Every step here is a step through history. Comfy history. With loot.",
  "🌲 The forest doesn't give up its secrets easily. But it does give them up.",
  "🌲 These groves have been growing since before 'rare' was a loot tier.",
  "🌲 The trees here don't just stand — they stand guard.",
  "🌲 Your metal detector is going to need a bigger display.",
  "🌲 The forest floor here is basically a piñata of premium items.",
  "🌲 Something rustles in the canopy. It's either a bird or a legendary artifact. Either way, exciting.",
  "🌲 This forest has better loot tables than most dungeons.",
  "🌲 The mushrooms here glow. That's either magical or radioactive. Either way, collect them.",
  "🌲 The forest remembers every explorer. It's rooting for you. Pun intended.",
  "🌲 These trees have been composting treasure for centuries. You're welcome.",
  "🌲 The deeper you go, the better the loot. Also the higher the chance of getting lost. Balance.",
  "🌲 This forest is the planet's way of saying 'I believe in you.'",
  "🌲 The canopy here filters sunlight into something that feels like approval.",
  "🌲 Every root hides a story. Every story hides loot.",
  "🌲 The forest is generous to those who respect it. Ruthless to those who don't.",
  "🌲 These woods have more layers than a parfait. And more surprises.",
  "🌲 The forest doesn't just contain treasure — it cultivates it.",
  "🌲 Your inventory is about to get a significant upgrade. The forest has decided.",
  "🌲 The trees here have seen empires rise. They're still growing. Take notes.",
  "🌲 This forest is proof that good things grow in dark, mysterious places.",
  "🌲 The undergrowth parts for the worthy. You're either worthy or lost. Possibly both.",
  "🌲 The forest hums with an energy that makes your hair stand up. In a good way.",
  "🌲 These groves are where legends come to drop loot.",
  "🌲 The forest floor is soft, the air is thick, and the loot is legendary.",
  "🌲 Something ancient and generous lives at the heart of this forest. Go say thanks.",
  "🌲 The trees here don't just grow — they grow opportunities.",
  "🌲 This forest is the premium experience. The deluxe edition of exploration.",
  "🌲 The canopy above is a cathedral. The loot below is the offering.",
];

// ============================================================================
// FACTORY — Strategic production buildings. Tone: industrial, militaristic, urgent.
// ============================================================================
const FACTORY_MESSAGES = [
  "Factory building — Attack to capture or manage production",
  "Industrial machinery churns day and night",
  "This factory is a strategic asset worth fighting for",
  "Production lines create an endless supply of units",
  "The smokestacks rise like pillars of power",
  "Whoever controls this controls the battlefield",
  "Your forces could turn the tide with this factory",
  "The clang of metal on metal echoes constantly",
  "This industrial complex is a force multiplier",
  "Capture this and your army will grow unstoppable",
  "The factory doesn't sleep. Neither should your ambition.",
  "This building produces units faster than excuses at a post-battle debrief.",
  "The assembly line here has one speed: relentless.",
  "This factory is the reason 'industrial capacity' is a flex.",
  "The smokestacks here don't just emit smoke — they emit power.",
  "Capture this and your production queue will weep with joy.",
  "The factory floor is a ballet of efficiency and noise.",
  "This complex turns raw materials into raw power. Literally.",
  "The last commander who held this factory won three wars. Correlation? Probably not.",
  "This factory doesn't just build units — it builds empires.",
  "The production capacity here is 'concerning' if you're the enemy.",
  "Smoke on the horizon means someone's factory is working overtime.",
  "This factory is the beating heart of your war economy. Protect it.",
  "The assembly line here has produced more units than most commanders have had hot meals.",
  "This industrial complex is proof that manufacturing is warfare by other means.",
  "The factory hums with purpose. Your purpose.",
  "Capture this and your enemies will need to update their threat assessment.",
  "The production lines here don't take breaks. Neither should your strategy.",
  "This factory is where ambition gets a serial number.",
  "The smokestacks here are the skyline of your empire.",
  "This complex could produce an army before breakfast. A big army. A big breakfast.",
  "The factory floor is where metal becomes might.",
  "This factory has been running since before you were born. It's not stopping now.",
  "The production capacity here makes your logistics officer cry. Happy tears.",
  "This factory is the difference between 'some units' and 'all the units.'",
  "The assembly line here is a conveyor belt of destiny.",
  "This industrial complex is a monument to what happens when you take manufacturing seriously.",
  "The factory doesn't care who owns it. It just produces. But you should care.",
  "This factory is the reason your enemies check the map twice.",
  "The production lines here are calibrated for one thing: winning.",
  "This complex turns ambition into ammunition. Efficiently.",
  "The factory is loud, proud, and producing at maximum capacity.",
  "This factory is where your strategy gets physical.",
  "The smokestacks here are visible from three tiles away. That's the point.",
  "This industrial complex is the backbone of any serious operation.",
  "The factory floor doesn't negotiate. It produces.",
  "This factory is the reason 'production capacity' is a thing generals argue about.",
  "The assembly line here has one product: victory. In bulk.",
];

// ============================================================================
// BANK — Safe storage locations. Tone: secure, financial, reassuring, dry humor.
// ============================================================================
const BANK_MESSAGES = {
    metal: [
      "🏦 Metal Bank — Store metal safely (1,000 deposit fee)",
      "🏦 Secure vaults protect your hard-earned metal",
      "🏦 The safest place for your industrial wealth",
      "🏦 Armored doors guard untold riches within",
      "🏦 Your metal is protected from raiders here",
      "🏦 Banking fees are a small price for peace of mind",
      "🏦 Countless ingots rest in these vaults",
      "🏦 The bank's reputation for security is legendary",
      "🏦 Store now, build later — your metal stays safe",
      "🏦 These walls have never been breached",
      "🏦 Your metal sleeps here. Peacefully. Unlike you.",
      "🏦 The vault is rated for 'apocalypse.' Your metal is safe.",
      "🏦 This bank has survived three wars, two plagues, and one accounting error.",
      "🏦 The deposit fee is 1,000. The peace of mind is priceless. Probably.",
      "🏦 Your metal is safer here than in your base. Let's be honest.",
      "🏦 The vault door weighs more than your entire army. That's intentional.",
      "🏦 This bank doesn't just store metal — it stores trust.",
      "🏦 The security system here was designed by someone who really hates thieves.",
      "🏦 Your metal will be here when you get back. Guaranteed. Mostly.",
      "🏦 The bank's motto: 'Your metal is our metal. Just kidding. But we do protect it.'",
      "🏦 This vault has more protection than a dragon's hoard. And better customer service.",
      "🏦 The deposit slip is the most reassuring piece of paper in the wasteland.",
      "🏦 Your metal is earning interest. Emotional interest. We don't do actual interest.",
      "🏦 The bank manager has never lost a deposit. They take that personally.",
      "🏦 This is the only place in the wasteland where 'safe' isn't a relative term.",
      "🏦 The vault here is so secure, even the bank manager needs two keys and a prayer.",
      "🏦 Your metal is protected by walls, guards, and an unreasonable amount of paranoia.",
      "🏦 The bank's security budget is larger than most armies. That's not a coincidence.",
      "🏦 Deposit here and sleep tonight. That's the whole pitch.",
      "🏦 This bank has been standing since before the war. It'll be standing after.",
    ],
    energy: [
      "🏦 Energy Bank — Store energy safely (1,000 deposit fee)",
      "🏦 Power cells stack to the ceiling in perfect order",
      "🏦 Your energy reserves are shielded from theft",
      "🏦 Advanced containment keeps your power secure",
      "🏦 The hum of stored energy fills the air",
      "🏦 Banking fees ensure professional protection",
      "🏦 Massive capacitors store limitless potential",
      "🏦 This bank has weathered every storm",
      "🏦 Your energy will be here when you need it",
      "🏦 The most secure storage in the wasteland",
      "🏦 Your energy is stored at optimal voltage. And optimal security.",
      "🏦 The containment field here could survive a direct hit. We think.",
      "🏦 This bank stores power the way dragons hoard gold. Professionally.",
      "🏦 Your energy reserves are safer here than in your reactors. And cooler.",
      "🏦 The capacitors here have been charging since before you logged in.",
      "🏦 This vault doesn't just store energy — it respects it.",
      "🏦 The energy containment system was overengineered on purpose. You're welcome.",
      "🏦 Your power cells are monitored 24/7 by someone who really likes power cells.",
      "🏦 The bank's energy security protocol has 47 steps. We've never needed step 47. Yet.",
      "🏦 This is the only place where 'stored energy' doesn't mean 'ticking time bomb.'",
      "🏦 The containment field hums a lullaby to your energy reserves. Metaphorically.",
      "🏦 Your energy is stored with the same care you'd give a sleeping baby. A very electric baby.",
      "🏦 The bank's energy vault is climate-controlled, thief-proof, and slightly smug.",
      "🏦 Deposit here and your power grid will thank you. From a safe distance.",
      "🏦 This bank has never lost a watt. They're very proud of that.",
    ],
    exchange: [
      "🏦 Exchange Bank — Convert Metal ↔ Energy (20% fee)",
      "🏦 The exchange rate fluctuates with the market",
      "🏦 Convert your surplus into what you need",
      "🏦 Traders from across the wasteland gather here",
      "🏦 The 20% fee supports the exchange infrastructure",
      "🏦 Flexible resource management begins here",
      "🏦 Smart commanders know when to exchange",
      "🏦 Turn excess metal into pure energy",
      "🏦 Economic warfare starts with resource conversion",
      "🏦 Balance your reserves through strategic trading",
      "🏦 The 20% fee stings. Running out of resources stings more.",
      "🏦 This is where 'too much metal' becomes 'just enough energy.'",
      "🏦 The exchange rate is fair. 'Fair' by wasteland standards, anyway.",
      "🏦 Your accountant either loves or hates this place. Probably both.",
      "🏦 The exchange floor is where resource problems go to become different resource problems.",
      "🏦 Convert wisely. The fee is real, but so is the flexibility.",
      "🏦 This bank turns 'wrong resource' into 'right resource.' For a price.",
      "🏦 The traders here have seen it all. And traded most of it.",
      "🏦 Your surplus is someone else's shortage. This bank connects the two.",
      "🏦 The 20% fee is the cost of doing business in a world without refunds.",
      "🏦 Exchange here and feel the sweet relief of balanced reserves.",
      "🏦 This is the financial equivalent of 'having your cake and eating it too.' With a fee.",
      "🏦 The exchange rate updates in real-time. Real-time by wasteland standards.",
      "🏦 Smart resource management starts with knowing when to convert.",
      "🏦 This bank doesn't judge your resource imbalance. It just fixes it. For 20%.",
    ],
  };

// ============================================================================
// SHRINE — Sacred sacrifice locations. Tone: mystical, reverent, ominous, rewarding.
// ============================================================================
const SHRINE_MESSAGES = [
  "⛩️ Ancient Shrine — Sacrifice items for gathering boosts (+25% per tier)",
  "⛩️ The shrine hums with ancient power",
  "⛩️ Offerings made here echo through eternity",
  "⛩️ The gods reward those who sacrifice wisely",
  "⛩️ Your gathering potential increases dramatically here",
  "⛩️ Legends speak of commanders who gained divine favor",
  "⛩️ The shrine's magic amplifies your resource yield",
  "⛩️ Sacred ground blessed by forgotten deities",
  "⛩️ Trade items for power beyond mortal means",
  "⛩️ The wise invest in eternal bonuses here",
  "⛩️ The shrine doesn't speak. It just... knows.",
  "⛩️ Your offerings are noted. The gods are watching. They have popcorn.",
  "⛩️ This shrine has been accepting sacrifices since before 'currency' was invented.",
  "⛩️ The ancient ones don't need your items. But they appreciate the gesture.",
  "⛩️ Sacrifice here and feel the warm glow of divine approval. And +25% yield.",
  "⛩️ The shrine's power is old. Older than old. Older than 'old' knows.",
  "⛩️ Your items will be missed. Your boost won't be.",
  "⛩️ The gods here don't demand much. Just your stuff. And your respect. Mostly your stuff.",
  "⛩️ This shrine has seen empires sacrifice everything. You're just sacrificing items. Scale accordingly.",
  "⛩️ The altar is warm. That's either divine presence or old wiring. Either way, proceed.",
  "⛩️ Sacrifice wisely. The gods remember. So does the accounting department.",
  "⛩️ The shrine's blessing lasts longer than your regret about the items you sacrificed.",
  "⛩️ This is the only place where 'giving stuff away' is a power move.",
  "⛩️ The ancient power here doesn't judge. It just amplifies. Your yield, that is.",
  "⛩️ Your items go in. Power comes out. It's alchemy, basically.",
  "⛩️ The shrine has been here longer than the concept of 'fair trade.'",
  "⛩️ Sacrifice here and your resource tiles will feel the difference. Spiritually.",
  "⛩️ The gods of this shrine are generous. Suspiciously generous. Sacrifice anyway.",
  "⛩️ This shrine turns 'stuff' into 'bonus.' It's the best deal in the wasteland.",
  "⛩️ The altar accepts all items. It has no preferences. It's very diplomatic.",
  "⛩️ Your sacrifice echoes in the void. The void says 'thanks, +25%.'",
  "⛩️ The shrine's power is ancient, mysterious, and really good at math.",
  "⛩️ This is where items go to become something greater. Like your yield.",
  "⛩️ The shrine doesn't haggle. The rate is the rate. Take it or leave it.",
  "⛩️ Sacrifice here and join the ranks of commanders who understood the value of giving.",
  "⛩️ The gods here are practical. They want items. They give bonuses. Everyone wins.",
  "⛩️ This shrine is the closest thing to a 'fair deal' in the entire wasteland.",
  "⛩️ Your items will be used in ways you don't understand. That's the point.",
];

// ============================================================================
// AUCTION HOUSE — Trading hub. Tone: commercial, shrewd, opportunistic, lively.
// ============================================================================
const AUCTION_HOUSE_MESSAGES = [
  "🏛️ Auction House — Buy and sell items with other players",
  "🏛️ The marketplace buzzes with commerce and opportunity",
  "🏛️ Fortunes change hands beneath these ancient arches",
  "🏛️ Smart traders know the Auction House is where wealth begins",
  "🏛️ List your surplus, bid on treasures, dominate the economy",
  "🏛️ The wasteland's premier trading destination",
  "🏛️ Every transaction here reshapes the balance of power",
  "🏛️ Legendary items appear on these auction blocks",
  "🏛️ Economic warfare is waged in these hallowed halls",
  "🏛️ What you can't find, you can buy — what you can't use, you can sell",
  "🏛️ The auctioneer has seen it all. And sold most of it.",
  "🏛️ This is where 'one commander's trash' becomes 'another commander's treasure.'",
  "🏛️ The bidding wars here have ended friendships. And started empires.",
  "🏛️ Your credit limit is the only thing standing between you and everything.",
  "🏛️ The Auction House: where supply, demand, and mild desperation meet.",
  "🏛️ Every item here has a story. Every story has a price.",
  "🏛️ The auction block doesn't care about your feelings. It cares about your bid.",
  "🏛️ This is the only place where 'shopping' is a valid military strategy.",
  "🏛️ The market waits for no one. Except the next bidder.",
  "🏛️ Smart commanders don't just fight wars. They win auctions.",
  "🏛️ The Auction House has more drama than a soap opera. And better loot.",
  "🏛️ Your surplus is someone else's solution. List it.",
  "🏛️ The bidding starts low. The egos don't.",
  "🏛️ This is where 'retail therapy' meets 'strategic resource acquisition.'",
  "🏛️ The auctioneer's gavel is the most powerful weapon in the wasteland.",
  "🏛️ Every auction is a story. Every story ends with someone saying 'worth it.'",
  "🏛️ The market is open. Your wallet should be nervous.",
  "🏛️ This is where commanders come to turn 'oops' into 'opportunity.'",
  "🏛️ The Auction House: because looting is for amateurs.",
  "🏛️ Bid high, sell higher. That's not advice. That's a lifestyle.",
  "🏛️ The trading floor here has seen more action than most battlefields.",
  "🏛️ Your next game-changing item is here. You just need to outbid someone.",
  "🏛️ The Auction House doesn't sleep. Neither do the snipers.",
  "🏛️ This is where 'commerce' and 'warfare' become the same word.",
  "🏛️ The listing fee is small. The bragging rights are enormous.",
  "🏛️ Every item on the block is someone's regret and someone else's dream.",
  "🏛️ The market corrects all imbalances. Usually in favor of the highest bidder.",
  "🏛️ This is the only building where 'aggressive negotiation' is encouraged.",
  "🏛️ The Auction House: where your surplus becomes your empire.",
];

// ============================================================================
// GET RANDOM MESSAGE
// ============================================================================

export function getRandomTileMessage(
  terrain: TerrainType,
  bankType?: 'metal' | 'energy' | 'exchange'
): string {
  let messages: string[];

  switch (terrain) {
    case TerrainType.Wasteland:
      messages = WASTELAND_MESSAGES;
      break;
    case TerrainType.Metal:
      messages = METAL_MESSAGES;
      break;
    case TerrainType.Energy:
      messages = ENERGY_MESSAGES;
      break;
    case TerrainType.Cave:
      messages = CAVE_MESSAGES;
      break;
    case TerrainType.Forest:
      messages = FOREST_MESSAGES;
      break;
    case TerrainType.Factory:
      messages = FACTORY_MESSAGES;
      break;
    case TerrainType.Bank:
      if (bankType && BANK_MESSAGES[bankType]) {
        messages = BANK_MESSAGES[bankType];
      } else {
        messages = BANK_MESSAGES.metal;
      }
      break;
    case TerrainType.Shrine:
      messages = SHRINE_MESSAGES;
      break;
    case TerrainType.AuctionHouse:
      messages = AUCTION_HOUSE_MESSAGES;
      break;
    default:
      return 'Unknown terrain';
  }

  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
}

// ============================================================================
// GET CONSISTENT MESSAGE (same tile = same message)
// ============================================================================

export function getConsistentTileMessage(
  terrain: TerrainType,
  x: number,
  y: number,
  bankType?: 'metal' | 'energy' | 'exchange'
): string {
  let messages: string[];

  switch (terrain) {
    case TerrainType.Wasteland:
      messages = WASTELAND_MESSAGES;
      break;
    case TerrainType.Metal:
      messages = METAL_MESSAGES;
      break;
    case TerrainType.Energy:
      messages = ENERGY_MESSAGES;
      break;
    case TerrainType.Cave:
      messages = CAVE_MESSAGES;
      break;
    case TerrainType.Forest:
      messages = FOREST_MESSAGES;
      break;
    case TerrainType.Factory:
      messages = FACTORY_MESSAGES;
      break;
    case TerrainType.Bank:
      if (bankType && BANK_MESSAGES[bankType]) {
        messages = BANK_MESSAGES[bankType];
      } else {
        messages = BANK_MESSAGES.metal;
      }
      break;
    case TerrainType.Shrine:
      messages = SHRINE_MESSAGES;
      break;
    case TerrainType.AuctionHouse:
      messages = AUCTION_HOUSE_MESSAGES;
      break;
    default:
      return 'Unknown terrain';
  }

  const seed = (x * 997 + y * 991) % messages.length;
  return messages[seed];
}
