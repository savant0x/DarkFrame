# 🚩 **THE FLAG - Ultimate King of the Hill Feature**

**Feature ID:** FID-20251020-FLAG  
**Type:** Core Gameplay Feature (ALL PLAYERS)  
**Priority:** HIGH  
**Complexity:** 4/5  
**Estimated Effort:** 28-42 hours (reduced from initial 38-54 hours after simplifications)

---

## 🎯 **CORE CONCEPT**

**"There can be only one Flag Bearer - The Most Powerful Player in DarkFrame"**

A single **Golden Flag** exists in the DarkFrame world. Whoever holds it becomes **THE ULTIMATE POWERHOUSE** with massive bonuses to **EVERYTHING** in the game. But they also become a **glowing target** for all other players, leaving a visible particle trail as they move.

**Key Principles:**
- ✅ **Accessible to ALL** (free + VIP players)
- ✅ **MASSIVE rewards** (boost to literally every game system)
- ✅ **High visibility** (particle trail shows where you've been)
- ✅ **Strategic depth** (research tree tracking, timing, alliances)
- ✅ **Social dynamics** (betrayals, protection, bounties, drama)
- ✅ **Fair competition** (anyone can steal from anyone)

---

## 💎 **FLAG BONUSES** (While Holding - EVERYTHING BOOSTED!)

### **🌾 Resource Harvesting:**
- **+100% Metal harvest** (double all metal gains)
- **+100% Energy harvest** (double all energy gains)
- **+50% Cave item drop rate** (30% → 45% drop chance)
- **+50% Forest item drop rate** (boost to rare forest items)
- **3x rare item chance** (when items drop, significantly higher rarity)

### **⚡ Experience & Progression:**
- **+100% XP gain** (double XP from all activities)
- **+100% Mastery Points** (specialization progression 2x faster)
- **+100% Research Points** (tech tree advancement 2x faster)
- **+50% Achievement progress** (earn achievements 1.5x faster)
- **+25% Level up rewards** (bonus resources/items on level up)

### **⚔️ Combat & Military:**
- **+50% Battle rewards** (resources stolen from victories 1.5x)
- **+25% Unit strength** (all units deal 25% more damage)
- **+25% Unit defense** (all units take 25% less damage)
- **+50% Unit build XP** (gain more XP when building units)

### **🏦 Economic & Storage:**
- **+50% Bank capacity** (store 1.5x more resources safely)
- **+50% Inventory capacity** (carry 1.5x more items)
- **No bank deposit fees** (0% fee vs standard 1,000 Metal)

### **🤖 Automation & Efficiency:**
- **+50% Auto-farm speed** (auto-farming routes complete 1.5x faster)
- **+25% Movement cooldown reduction** (move between tiles 25% faster cooldown)

### **👥 Social & Clan:**
- **+100% Clan contribution** (your donations worth 2x to clan)
- **+50% Referral bonuses** (earn 1.5x from referrals)
- **+25% Clan XP bonus** (if in clan, all members get +25% XP)
- **Clan prestige bonus** (your clan gains prestige points hourly)

### **🎨 Prestige & Visual:**
- **Flag Bearer title:** "[⚡FLAG BEARER] Username" (golden animated text)
- **Golden aura** around character on map (pulsing effect)
- **Particle trail** on all tiles you move across (visible to all - see below)
- **Map indicator:** Golden flag icon on your location (everyone can see)
- **Homepage feature:** Listed as current Flag Bearer on main page
- **Leaderboard highlight:** Crown icon next to your name everywhere

### **🏆 Long-Term Bonuses:**
- **Permanent harvest bonus:** Hold Flag for 12 consecutive hours = **+2% permanent harvest bonus** (keeps forever, even after losing Flag)
- **Achievement unlocks:** Special badges, titles, and cosmetics earned by reaching hold time milestones
- **Leaderboard records:** Your name immortalized in hall of fame for longest reigns
- **Exclusive rewards:** Unique items and bonuses only available to Flag holders who reach 12-hour max hold

**Why Hold the Flag?**
- Massive immediate bonuses (+100% harvest, +100% XP, +3 factory slots unlocked when lost)
- Permanent progression (+2% harvest forever for 12hr completion)
- Prestige and bragging rights (leaderboards, achievements)
- Resource accumulation (double harvest + boosted drops = huge earnings)

---

## 🌟 **PARTICLE TRAIL SYSTEM** (Flag Bearer Only)

### **How It Works:**
When the Flag Bearer moves across the map, they leave a **visible golden particle trail** on every tile they traverse.

**Trail Mechanics:**
- **Duration:** Particles remain on tile for **8 minutes** after Flag Bearer leaves
- **Visual:** Golden sparkles/embers floating upward from tile (animated)
- **Visibility:** **ALL players** can see the trail (not just trackers)
- **Intensity:** Brighter/more particles = more recent (fades over 8 minutes)
- **Refresh:** Moving over same tile again refreshes the 8-minute timer

**Trail Appearance:**
- **Tile 1 (just left):** Bright gold particles, thick trail, clearly visible
- **Tile 2 (2 mins ago):** Medium gold particles, fading
- **Tile 3 (4 mins ago):** Dim particles, sparse
- **Tile 4 (6 mins ago):** Very faint, almost gone
- **Tile 5 (8+ mins ago):** Trail disappears completely

**Strategic Implications:**
- **Hunters:** Follow the trail to find Flag Bearer
- **Flag Bearer:** Trail makes you easier to track (counterbalance to massive bonuses)
- **Misdirection:** Can create fake trails by looping/zigzagging
- **Ambush points:** Hunters can predict your path from trail pattern
- **Clan protection:** Clan members can guard your trail route

**Visual Style (CSS/Animation):**
```css
/* Example - Golden particle effect */
.flag-trail-tile {
  position: relative;
  animation: fadeTrail 8s linear forwards;
}

.flag-trail-tile::after {
  content: '✨';
  position: absolute;
  animation: floatParticle 2s ease-in-out infinite;
  color: gold;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.8);
}

@keyframes floatParticle {
  0% { transform: translateY(0) scale(1); opacity: 1; }
  50% { transform: translateY(-10px) scale(1.2); }
  100% { transform: translateY(-20px) scale(0.8); opacity: 0; }
}

@keyframes fadeTrail {
  0% { opacity: 1; }
  75% { opacity: 0.5; }
  100% { opacity: 0; }
}
```

---

## 🎮 **HOW THE FLAG WORKS**

### **Initial Flag Spawn:**
1. **First-time spawn:** Flag spawns at random coordinates when feature launches
2. **Server announcement:** "🚩 The Golden Flag has appeared at coordinates (X, Y)! First to claim becomes the most powerful player!"
3. **After server restart:** Flag returns to last holder (if online within 24hr) or random spawn
4. **If no holder:** Flag spawns at random coordinates every 6 hours until claimed

### **Claiming the Flag (First Time):**
- Move **within 15 tiles** of where Flag is located (UI notification appears when within range)
- Click **"Claim Flag"** button (appears when within range)
- Instant acquisition (no battle required for unclaimed flag)
- **Site-wide notification to all players:** "**🚩 [Username] has claimed the Flag and is now the most powerful player!**"
  - Appears as screen notification (popup/toast) for all online players
- Immediately gain all bonuses + particle trail activates

### **Stealing the Flag:**

**Step 1: Locate the Flag Bearer**
- Use research tree tracking (Quadrant → Zone → Region → Precise)
- Follow particle trail (visual breadcrumbs)
- Check homepage widget ("Current holder: [Username]")
- Social intelligence (ask clan members, check chat)
- **Map distance calculator:** Shows your distance from Flag holder in real-time

**Step 2: Get Within Steal Range**
- Navigate to **within 15 tiles** of Flag Bearer (~706 tile radius around them)
- **Steal button appears:** "⚔️ CHALLENGE FOR FLAG (RANGE: 12 tiles)"
- Golden border around steal button (pulsing animation)
- Distance indicator updates in real-time: "Target moving... 8 tiles away"
- **Visual:** Orange circle overlay on map showing your 15-tile challenge range

**Step 3: Steal Mechanics (AUTO-LOCK SYSTEM)**
- Click **"Challenge for Flag"** button (appears when within 15-tile range)
- **30-second channel timer** starts (visible progress bar) - can extend to 60 seconds for balance
- **Auto-lock on Flag Bearer** (you both become temporarily locked in place for first 5 seconds)
- **Interactive prompt appears for BOTH players:**

**For Challenger:**
```
⚔️ CHALLENGING FOR FLAG!
━━━━━━━━━━━━━━━━━━━━━━
Channeling... [██████░░░░] 18s remaining

You are locked in place for 30 seconds!
Flag Bearer can flee after 5-second lock expires!

[❌ Cancel Challenge]
```

**For Flag Bearer:**
```
🚨 FLAG CHALLENGE!
━━━━━━━━━━━━━━━━━━━━━━
[Challenger] is trying to steal your Flag!
Channel time: [██████░░░░] 18s remaining

⚠️ You are locked for 5 seconds!
After 5s you can: [🏃 FLEE] (costs 10-30% session earnings)

Grace Period: ACTIVE / EXPIRED
```

**Step 4: Challenge Resolution**

**SCENARIO A: Successful Steal (Channel Completes)**
- 30-second channel completes uninterrupted
- **Flag Bearer didn't flee** (or couldn't flee - cooldown)
- **Instant transfer** (Flag moves to challenger)
- **Animations:**
  - Flag flies from previous holder to you (golden arc animation)
  - Explosion of golden particles around you
  - Your username changes to [⚡FLAG BEARER]
  - Previous holder's bonuses vanish instantly
- **Both players unlocked** (can move freely)

**SCENARIO B: Flag Bearer Flees (Escape Successful - COSTS RESOURCES)**
- Flag Bearer clicks **[🏃 FLEE]** after 2-second lock expires
- **PAYMENT REQUIRED:** Flag Bearer must pay challenger from SESSION EARNINGS
  - **Cost = % of resources earned while holding Flag** (not total resources):
    - **1st flee:** 10% of session earnings
    - **2nd flee:** 15% of session earnings (10% + 5%)
    - **3rd flee:** 20% of session earnings (15% + 5%)
    - **4th flee:** 25% of session earnings (20% + 5%)
    - **5th flee:** 30% of session earnings (25% + 5%)
    - **6th challenge:** AUTO-LOSE Flag (can't flee anymore)
  - **Session Earnings Tracking:**
    - Starts at 0 when you claim Flag
    - **Increments with ALL Metal/Energy gained while holding Flag:**
      - Manual harvest/farm actions (+800-1,500 per tile base, doubled with +100% harvest bonus = 1,600-3,000 per tile)
      - Auto-farm generation (if active, with +50% efficiency bonus)
      - Battle victories (if applicable)
      - ANY other Metal/Energy source (except clan donations - those go to bank)
    - **Only tracks what you EARNED with the Flag** (your original resources are safe)
    - **GROSS total** - Flee costs do NOT reduce session earnings
    - Resets to 0 when you lose Flag
  - **Flee Cost Calculation:**
    - Always based on **GROSS session earnings** (not net after flee costs)
    - Example: Earned 1M total → 1st flee (10%) = 100k, session still shows 1M → 2nd flee (15%) = 150k based on 1M
    - Uses `Math.floor()` for all calculations (rounds down, NO FRACTIONS EVER)
  - **Example:** Earned 1M Metal + 1M Energy this session:
    - 1st flee: Pay 100k Metal + 100k Energy (10%)
    - 2nd flee: Pay 150k Metal + 150k Energy (15%)
    - 3rd flee: Pay 200k Metal + 200k Energy (20%)
    - 4th flee: Pay 250k Metal + 250k Energy (25%)
    - 5th flee: Pay 300k Metal + 300k Energy (30%)
    - 6th challenge: Flag stolen automatically (no flee option)
  - **Payment goes directly to challenger** (instant transfer)
  - **If insufficient resources:** Flee button disabled (auto-lose Flag - cannot pay = cannot flee)
  - **Flee count resets when Flag lost** (not time-based)
  - **Boundary protection:** Flee destination validated against map limits (1-150), cannot flee off-map
- **If insufficient resources:** Flee button disabled (can't escape - auto-lose Flag)
- **Escape dash:** Instantly moves **5 tiles in a random direction** (validated against map boundaries 1-150)
- **Random direction:** System randomly chooses one of 8 directions (N, NE, E, SE, S, SW, W, NW) - Flag Bearer cannot predict or control direction
- Channel **broken** (steal fails, but challenger gets paid!)
- **Flee cooldown:** 60 seconds before can flee again
- **Visual:** Trail of golden particles shows flee direction
- **Notification to challenger:** "💰 You earned 50,000 Metal + 50,000 Energy! [Username] fled from you!"

**🚫 RESTRICTIONS While Holding Flag (Prevents Exploits):**
- ❌ **Unit Building DISABLED** - Can't build units to spend resources
- ❌ **Factory Capturing DISABLED** - Can't capture new factories
- ❌ **Factory Upgrades DISABLED** - Can't upgrade factories to spend resources
- ❌ **Auction House DISABLED** - Can't purchase items to spend resources
- ❌ **Banking DISABLED** - Can't deposit to hide resources from flee cost
- ✅ **Shrine boosts ENABLED** - Still allowed (doesn't use Metal/Energy)
- ✅ **Harvesting/Farming ENABLED** - Core mechanic (how you earn session resources)
- ✅ **Movement ENABLED** - Can move around map freely

**⚠️ IMMEDIATE RESTRICTIONS & FACTORY FREEZE:**
When you claim the Flag, ALL restrictions apply **immediately** (no grace period):

1. **Notification:** "⚠️ You claimed the Flag! All building, banking, auction, and factory actions are now DISABLED!"

2. **Factories FROZEN immediately:**
   - Cannot produce units
   - Cannot upgrade factories
   - Cannot build units from factories
   - **Cannot capture new factories** (factory attacks disabled while holding Flag)
   - All existing factories (up to 10) remain frozen entire session

3. **Following features DISABLED immediately:**
   - ❌ Unit Building (all types)
   - ❌ Bank deposits/withdrawals
   - ❌ Auction House (buying/selling)
   - ❌ Factory attacks/captures
   - ❌ Any action that would reduce on-hand Metal/Energy

4. **When Flag lost:** All restrictions lifted immediately, full functionality restored

**Why Immediate Restrictions (No Grace Period)?**
- Prevents "grab Flag → instantly build units → hide resources" exploit
- Forces Flag Bearer to hold earnings on-hand (creates real risk)
- Makes session earnings tracking accurate (can't spend away the flee costs)
- Simplifies implementation (no grace period state management)
- Creates meaningful decision: "Do I flee and pay 10-30%, or surrender and keep everything?"

**Why Factory Freeze (Not Removal)?**
- Easier to manage (no ownership transfer)
- Fair (you keep your factories, just can't use them temporarily)
- Restriction lifted when Flag lost (not permanent penalty)

**Strategic Implications:**
- ✅ **Fair for all players** - New player earns 50k → pays 5k to flee. Rich player earns 5M → pays 500k
- ✅ **Creates "bounty hunter" economy** - Challenge Flag Bearer for payment even if you fail
- ✅ **Predictable escalation** - Each flee adds 5% cost (10% → 15% → 20% → 25% → 30%)
- ✅ **Maximum 5 flees** - On 6th challenge, you auto-lose Flag (no escape)
- ✅ **Only risk what you earned** - Your original resources are safe (only Flag profits at risk)
- ✅ **Can't exploit by spending** - Building/banking disabled forces you to hold earnings
- ✅ **Eventually must surrender** - After 5 flees, you've paid 100% of earnings
- ✅ **Rewards persistence** - Keep challenging, earn payments each time they flee

**SCENARIO C: Flag Bearer Does Nothing (Default Loss)**
- Flag Bearer doesn't click Flee OR flee is on cooldown
- Channel completes after 30 seconds
- **Automatic transfer** to challenger (same as Scenario A)
- Flag Bearer loses all bonuses instantly

**SCENARIO D: Challenger Cancels**
- Challenger clicks **[❌ Cancel Challenge]**
- Channel stops, both players unlocked
- 5-minute cooldown before same challenger can try again (prevents spam)

**NO BATTLE OPTION:**
- ⛔ **There is NO defend/battle option** (prevents power players from dominating)
- ⛔ **Combat strength doesn't matter** (Rank 1 or Rank 100 - same mechanics)
- ✅ **Only defense = Flee** (run away, but has cooldown)
- ✅ **Fair for all players** (coordination beats individual power)

**Step 5: Grace Period (After Successful Steal)**
- **1-hour protection** where you cannot be challenged (reward for effort in catching Flag)
- Timer visible: "Grace Period: 58:32 remaining"
- **During grace period:** Players can still challenge you, but channel auto-fails
- Use this time to farm safely and build up session earnings
- Particle trail still active during grace period

### **Losing the Flag:**
- **Instant loss of ALL bonuses** (harvest, XP, combat, everything)
- Title removed immediately
- Visual effects disappear (aura, particles stop spawning)
- Particle trail remains for 8 minutes (evidence of your last path)
- **Notification:** "⚠️ You lost the Flag to [Username]! You earned XXX,XXX total resources while holding it."
- **Consolation:** Keep all resources/items earned while holding
- **Permanent bonus:** Keep the +2% harvest bonuses (per 24hr held)
- **Cooldown:** 30 minutes before you can challenge again

### **Maximum Hold Time:**

**12-Hour Maximum Hold (Prevents Hoarding):**
- **Hard limit:** No player can hold Flag for more than **12 consecutive hours**
- **Countdown visible:** "Max Hold Time: 11h 23m remaining"
- **Progressive warnings:**
  - 10 hours: "⏰ You've held Flag for 10 hours! Flag will be dropped when time runs out."
  - 11 hours: "🚨 FLAG WILL DROP IN 1 HOUR! Plan your session wrap-up."
  - 11:30: "⚠️ 30 MINUTES REMAINING! Flag drops soon!"
  - 11:45: "🔥 15 MINUTES! Flag drop imminent!"
  - 11:55: "💀 5 MINUTES! Final warning before Flag drops!"

**When 12-Hour Limit Reached:**
1. **Flag automatically dropped** from current holder (instant)
2. **Final rewards distributed:**
   - +2% permanent harvest bonus awarded (holds forever, even after losing Flag)
   - "12-Hour Legend" achievement unlocked
   - Bonus: +2,000,000 Metal + 2,000,000 Energy (for reaching max hold)
   
3. **Flag respawns randomly:**
   - **Random coordinates** on map (any terrain except Wasteland)
   - **Global broadcast:** "🚩 THE FLAG HAS RESPAWNED! New location: (X, Y) - First to claim wins!"
   - **Visible golden beacon** on map (massive particle effect, everyone can see)
   - **Homepage alert:** "FLAG AVAILABLE! Race to (X, Y)!"
   
4. **Previous holder:**
   - Cannot claim respawned Flag for **2 hours** (anti-hoard cooldown)
   - Keeps all earnings and bonuses
   - Can still challenge others who claim it (after 2hr cooldown)

**Why 12 Hours?**
- Allows dedicated players to benefit significantly (12hr = huge rewards)
- Prevents indefinite hoarding by power players/clans
- Creates regular "Flag available!" events (excitement for all players)
- Gives everyone (all timezones) a chance to compete
- Forces Flag into circulation even if no one can steal it

**Respawn Mechanics:**
- **Terrain preference:** 40% Metal/Energy tiles, 30% Cave/Forest tiles, 30% Factory tiles
- **Never spawns on:** Wasteland, player-occupied tiles, or within 5 tiles of any player
- **Minimum distance from edges:** At least 10 tiles from map border (prevents corner camping)
- **Countdown timer:** 30-minute countdown with site-wide notifications (screen notification/toast for all online players)
  - 30min: "🚩 Flag will respawn in 30 minutes! Prepare to race for coordinates."
  - 15min: "🚩 Flag respawns in 15 minutes!"
  - 5min: "🚩 Flag respawns in 5 minutes! Get ready!"
  - 1min: "🚩 FLAG RESPAWNS IN 1 MINUTE!"
  - 10s: "🚩 FLAG RESPAWNING IN 10... 9... 8..."
  - 0s: "🚩 FLAG HAS RESPAWNED at (X, Y)! First to claim wins!"

**Respawn Race:**
- First player to reach tile and click **"Claim Flag"** wins
- If multiple players arrive simultaneously: **Random selection** (fair chance)
- No grace period on first claim after respawn (steal protection starts AFTER first successful challenge)

---

## 🗺️ **FLAG TRACKING SYSTEM**

### **📱 NEW MODULE REQUIRED: Map View Page (`/app/map`)**

**Decision:** Creating new map module for enhanced Flag tracking and future features

**Implementation Approach:**
- Build new `/app/map` route with simplified 150x150 grid visualization
- Lightweight rendering (not full game graphics, just coordinate grid)
- Shows player position + Flag Bearer position (based on research tier)
- Displays particle trails (golden line showing last 8 minutes of movement)
- Future-proof for Clan Wars, Territory Control, Factory Map, etc.

**Map Module Features:**
```
┌────────────────────────────────────────────┐
│  🗺️ DARKFRAME MAP - 150x150 Grid          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                            │
│  Your Position: (47, 89) 🔵                │
│  Flag Bearer: Zone 12 (approx) 🚩          │
│                                            │
│  [Zoom: Full Map ▼] [Research: Tier 2]    │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │                                      │ │
│  │     [MAP GRID CANVAS - 150x150]     │ │
│  │                                      │ │
│  │  • Blue marker: Your position       │ │
│  │  • Golden marker: Flag (research)   │ │
│  │  • Golden trail: Last 8min path     │ │
│  │  • Click tile: Set waypoint         │ │
│  │                                      │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  Legend:                                   │
│  🔵 You  🚩 Flag  ✨ Trail  🏭 Factory    │
│                                            │
│  [Navigate to Flag] [Upgrade Research]    │
└────────────────────────────────────────────┘
```

**Technical Specifications:**
- **PixiJS rendering** (WebGL-based 2D renderer for superior performance)
- **Rendering engine:** PixiJS v8+ with WebGL backend
- **Sprite-based rendering:** Efficient tile sprites with texture atlas
- **Zoom levels:** Full map (150x150) → Quadrant → Zone → Region
- **Real-time updates** via WebSocket (Flag position, trails, your movement)
- **Interactive:** Click tile to see coordinates, set waypoints, auto-path
- **Responsive:** Mobile-friendly touch controls with pinch-to-zoom
- **Performance optimizations:**
  - Viewport culling (only render visible tiles)
  - Texture atlas for tile sprites (single draw call)
  - Particle pooling for trail effects
  - 60 FPS target on desktop, 30 FPS on mobile
- **Accessibility:** Keyboard navigation support (arrow keys, WASD)

**PixiJS Implementation Details:**

```typescript
// Install: npm install pixi.js @pixi/react
import { Application, Container, Sprite, Graphics, Text } from 'pixi.js';

// Initialize PixiJS Application
const app = new Application({
  width: 1200,
  height: 800,
  backgroundColor: 0x1a1a1a,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});

// Map Container (150x150 grid)
const mapContainer = new Container();
const TILE_SIZE = 32; // pixels per tile
const MAP_SIZE = 150; // tiles

// Tile Sprite Factory (uses texture atlas for performance)
function createTile(x: number, y: number, type: TileType): Sprite {
  const texture = tileTextures[type]; // Pre-loaded texture atlas
  const sprite = new Sprite(texture);
  sprite.x = x * TILE_SIZE;
  sprite.y = y * TILE_SIZE;
  sprite.width = TILE_SIZE;
  sprite.height = TILE_SIZE;
  sprite.interactive = true;
  sprite.on('pointerdown', () => onTileClick(x, y));
  return sprite;
}

// Flag Bearer Marker (golden pulsing sprite)
const flagMarker = new Graphics();
flagMarker.beginFill(0xFFD700, 0.8);
flagMarker.drawCircle(0, 0, TILE_SIZE / 2);
flagMarker.endFill();

// Particle Trail System (golden sparkles)
class ParticleTrail {
  private particles: Graphics[] = [];
  
  addTrailTile(x: number, y: number, age: number) {
    const particle = new Graphics();
    const alpha = Math.max(0.1, 1 - (age / 8)); // Fade over 8 minutes
    particle.beginFill(0xFFD700, alpha);
    particle.drawStar(x * TILE_SIZE, y * TILE_SIZE, 5, 8, 4);
    particle.endFill();
    this.particles.push(particle);
    mapContainer.addChild(particle);
  }
  
  updateTrail(trails: TrailData[]) {
    // Update particle alpha based on age
    trails.forEach((trail, i) => {
      const age = (Date.now() - trail.timestamp) / (1000 * 60); // minutes
      if (age > 8) {
        mapContainer.removeChild(this.particles[i]);
        this.particles.splice(i, 1);
      } else {
        this.particles[i].alpha = 1 - (age / 8);
      }
    });
  }
}

// Viewport Culling (only render visible tiles)
function updateViewport(cameraX: number, cameraY: number, zoom: number) {
  const visibleTiles = {
    minX: Math.floor(cameraX / TILE_SIZE),
    maxX: Math.ceil((cameraX + app.screen.width) / TILE_SIZE),
    minY: Math.floor(cameraY / TILE_SIZE),
    maxY: Math.ceil((cameraY + app.screen.height) / TILE_SIZE),
  };
  
  // Only render tiles within viewport
  mapContainer.children.forEach(child => {
    const tileX = child.x / TILE_SIZE;
    const tileY = child.y / TILE_SIZE;
    child.visible = (
      tileX >= visibleTiles.minX && tileX <= visibleTiles.maxX &&
      tileY >= visibleTiles.minY && tileY <= visibleTiles.maxY
    );
  });
}

// Zoom Controls
function setZoom(level: 'full' | 'quadrant' | 'zone' | 'region') {
  const zoomLevels = {
    full: 1.0,      // 150x150 visible
    quadrant: 2.0,  // 75x75 visible
    zone: 4.0,      // 37x37 visible
    region: 8.0,    // 18x18 visible
  };
  
  mapContainer.scale.set(zoomLevels[level]);
}

// Touch Controls (mobile pinch-to-zoom)
let lastDistance = 0;
app.view.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2) {
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const distance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
    
    if (lastDistance > 0) {
      const delta = distance - lastDistance;
      const newZoom = mapContainer.scale.x + (delta * 0.01);
      mapContainer.scale.set(Math.max(0.5, Math.min(10, newZoom)));
    }
    
    lastDistance = distance;
  }
});
```

**PixiJS Performance Tips:**
- Use **texture atlases** (combine all tile sprites into single image)
- Enable **object pooling** for particles (reuse Graphics objects)
- Use **ParticleContainer** for trail particles (faster rendering)
- Implement **spatial hashing** for collision detection
- Use **ticker** for smooth animations at 60 FPS
- Enable **batch rendering** for multiple sprites (automatic in PixiJS)
- Optimize **draw calls** (minimize container hierarchy depth)

---

### **Research-Based Tracking (With Map Module):**

**Tier 0 (No Research - FREE):**
- **Global notification:** "🚩 The Flag is held by [⚡FLAG BEARER] Username"
- **Homepage widget:** Current holder + time held
- **Particle trail visibility:** Can see golden sparkles on tiles (8-minute duration)
- **Must find manually:** Explore or follow trails
- **Map view:** No Flag marker shown (must explore to find)

**Tier 1 Research (5,000 RP → TO BE ADJUSTED AFTER RP OVERHAUL):**
- **Quadrant tracking:** "Flag is in Northwest quadrant (37,500 tiles)"
- **Update frequency:** Every 30 minutes
- **Map visual:** Quadrant highlighted with red transparent overlay
- **Zoom feature:** Click quadrant to zoom in
- **Text indicator:** UI panel shows "Flag: Northwest Quadrant"

**Tier 2 Research (15,000 RP → TO BE ADJUSTED AFTER RP OVERHAUL):**
- **Zone tracking:** "Flag is in Zone 12 (2,500 tiles)"
- **Update frequency:** Every 15 minutes
- **Map visual:** Zone area highlighted with orange overlay (smaller region)
- **Direction indicator:** Arrow shows general direction from your position
- **Distance estimate:** "Flag is approximately 45 tiles away"

**Tier 3 Research (50,000 RP → TO BE ADJUSTED AFTER RP OVERHAUL):**
- **Region tracking:** "Flag is near (45, 67) ±10 tiles" (314 tiles)
- **Update frequency:** Every 5 minutes
- **Map visual:** Yellow circle overlay showing region (~18 tile radius)
- **Distance indicator:** "Flag is 45 tiles away (NORTHEAST)"
- **Directional arrow:** Real-time arrow on map pointing toward Flag

**Tier 4 VIP Research (100,000 RP → TO BE ADJUSTED AFTER RP OVERHAUL - VIP EXCLUSIVE):**
- **Precise coordinates:** "Flag is at (47, 69)" (exact location)
- **Update frequency:** Real-time (live tracking, updates every 10 seconds)
- **Map visual:** Pulsing golden marker on exact tile
- **Movement tracking:** Arrow shows direction + speed indicator
- **Trail overlay:** Last 20 positions shown as golden line on map
- **Pattern analysis:** "Flag Bearer farming in circle pattern" or "Flag Bearer fleeing northeast"
- **ETA calculator:** "You can reach Flag in 12 minutes at current speed"
- **Predicted path:** AI shows likely next 5 tiles based on movement pattern

### **VIP Research Bonuses:**
- **Tier 1 VIP (3,000 RP → ADJUSTED):** 40% cheaper, real-time updates (no 30-min delay), trail age display
- **Tier 2 VIP (10,000 RP → ADJUSTED):** 33% cheaper, speed indicator, more frequent updates (every 7 min)
- **Tier 3 VIP (30,000 RP → ADJUSTED):** 40% cheaper, tighter radius (±5 tiles = 79 tiles), predicted position
- **Tier 4 VIP (100,000 RP → ADJUSTED):** VIP exclusive, exact coordinates, live tracking

### **⚠️ IMPORTANT NOTE - RP SYSTEM DEPENDENCY:**

**✅ DECISION FINALIZED:** Wait for RP System Overhaul (Option B)

**BLOCKING DEPENDENCY:** This feature requires **RP System Overhaul** to be completed first.

**Current Issue:** Research costs (5,000 / 15,000 / 50,000 / 100,000 RP) are unrealistic with current RP generation rates (dev has only 4 RP).

**Implementation Plan (CONFIRMED):**
1. **Phase 0: RP System Overhaul** (12-20 hours - PREREQUISITE)
   - Review all RP sources (quests, activities, progression)
   - Analyze current RP generation rates per hour/day/week
   - Adjust RP economy across entire game
   - Set realistic RP targets and progression curve
   - Balance RP rewards for different activities

2. **Phase 1-7: Flag Feature Implementation** (46-68 hours)
   - Implement with proper RP costs from overhauled system
   - Research tiers feel meaningful and achievable
   - Proper game balance from day 1

3. **Update Flag Plan:** Replace "TO BE ADJUSTED" with finalized RP costs after overhaul

**Benefits of This Approach:**
- ✅ Proper game balance from launch
- ✅ RP costs realistic and achievable for all players
- ✅ No temporary workarounds or technical debt
- ✅ RP overhaul benefits ALL features, not just Flag
- ✅ Clean implementation without compromises

**Total Timeline:** 58-88 hours (RP overhaul + Flag feature)

**See Also:** FID-20251020-RP-OVERHAUL (prerequisite project)

---

## 🛡️ **ANTI-GRIEF MECHANICS**

### **Cooldowns & Protections:**
1. **Grace Period After Stealing:** **1 hour** immunity (can't be challenged - reward for catching Flag)
   - Visible timer: "Grace Period: 57:18 remaining"
   - Particle trail still active (others can see you, just can't challenge yet)
   - Can farm safely with full bonuses for full hour
   - **Challenge button DISABLED** for all players with tooltip: "❌ Target has grace period (57:18 remaining)"
   - Prevents wasted challenge attempts and UI confusion

2. **Challenge Cooldown:** After losing Flag, **30-minute cooldown** before you can challenge again
   - Prevents immediate revenge stealing
   - Visible timer: "You can challenge again in 28:15"
   - Can still track Flag and follow holder (just can't initiate challenges)

3. **Flee Cooldown:** After using Flee ability, **60-second cooldown** before can flee again
   - Prevents infinite escapes
   - Visible timer: "Flee available in 0:47"
   - Can still be challenged (just can't flee during cooldown)

4. **Flee Resource Cost (SESSION-BASED PERCENTAGE):**
   - **Cannot flee without sufficient resources** (must pay challenger from session earnings)
   - **Cost = % of resources earned while holding Flag:**
     - 1st flee: 10% of session earnings
     - 2nd flee: 15% of session earnings (10% + 5%)
     - 3rd flee: 20% of session earnings (15% + 5%)
     - 4th flee: 25% of session earnings (20% + 5%)
     - 5th flee: 30% of session earnings (25% + 5%)
     - **6th challenge: AUTO-LOSE** (no flee option, Flag transfers automatically)
   - **Session Earnings Tracking:**
     - Starts at 0 when you claim Flag
     - Increments with every harvest/farm action (1,600-3,000 per tile with +100% boost)
     - Increments with auto-farm generation (+50% efficiency bonus)
     - Increments with battle victories and any other Metal/Energy sources
     - **Only tracks what you EARNED with the Flag** (original resources safe)
     - Resets to 0 when you lose Flag (flee count also resets)
   - **Example:** Earned 1M Metal + 1M Energy this session:
     - 1st flee: Pay 100k Metal + 100k Energy (10%)
     - 2nd flee: Pay 150k Metal + 150k Energy (15%)
     - 3rd flee: Pay 200k Metal + 200k Energy (20%)
     - 4th flee: Pay 250k Metal + 250k Energy (25%)
     - 5th flee: Pay 300k Metal + 300k Energy (30%)
     - **Total paid: 1M Metal + 1M Energy (100% of session earnings)**
     - 6th challenge: No flee option (auto-lose)
   - **Payment goes to challenger** (instant transfer)
   - **If insufficient resources:** Flee button disabled (auto-lose Flag)
   - **Creates economic drain** - 5 flees = 100% of earnings paid out
   - **Rewards "bounty hunters"** who challenge Flag Bearer for payments
   - **Fair scaling** - New players pay less, rich players pay more (proportional to earnings)

5. **Challenge Spam Prevention:** After canceling/failing challenge, **5-minute cooldown** for same target
   - Prevents griefing via spam challenges
   - Can challenge other players immediately (only locked from same target)

6. **Max Hold Time:** **12-hour hard limit** (see "Maximum Hold Time" above)
   - Prevents indefinite hoarding by power players/clans
   - Flag automatically drops at random location after 12 hours
   - Previous holder gets 2-hour cooldown before can claim again
   - **Progressive warnings:**
     - 10 hours: "⚠️ You've held Flag for 10 hours! Flag will drop in 2 hours."
     - 11 hours: "⚠️ FLAG WILL DROP IN 1 HOUR! It will appear at a random location."
     - 11:30: "⚠️ FLAG WILL DROP IN 30 MINUTES!"
     - 11:45: "🚨 FLAG WILL DROP IN 15 MINUTES! Finish farming!"
     - 11:55: "🚨 FLAG WILL DROP IN 5 MINUTES!"

7. **Online/Offline Behavior:**
   - **No special mechanics** - Being offline doesn't trigger penalties or auto-drops
   - If offline during challenge: Cannot defend = auto-lose Flag (no flee option available)
   - If offline for extended period: Can still be challenged and will lose Flag (but no punishment)
   - **Why no offline mechanics:** Online/offline status doesn't affect core gameplay balance

### **Fair Play Rules:**
- **No clan immunity:** Clan members CAN steal from each other (encouraged!)
- **No multi-accounting:** Stealing with alt account = permanent ban + Flag removal
- **No trading agreements:** If detected trading Flag back/forth = cooldown penalty
- **Report system:** "Report suspicious Flag activity" button

### **Notification Balance:**
- **Opt-in system:** Players choose which Flag alerts to receive
- **Notification types:**
  - ✅ Flag stolen (from anyone)
  - ✅ Flag available (dropped/unclaimed)
  - ✅ You lost Flag
  - ✅ You can steal again (cooldown ended)
  - ✅ Flag in your quadrant (proximity alert)
- **Throttling:** Max 1 notification per 5 minutes (prevents spam)
- **Quiet hours:** Disable Flag notifications 10:00 PM - 8:00 AM EST (optional player setting)

---

## 📊 **FLAG LEADERBOARDS & STATS**

### **All-Time Leaderboards:**
1. **🏆 Longest Single Reign:** Most consecutive hours holding Flag without losing it
   - Current record holder displayed
   - Top 10 players shown
   - Time format: "48 hours 37 minutes 12 seconds"

2. **⏱️ Total Time Held:** Cumulative hours holding Flag (lifetime)
   - Shows dedication over time
   - Includes all separate reigns

3. **⚔️ Most Steals:** Most times you've successfully stolen the Flag
   - "Flag Hunter" metric
   - Shows aggression/activity

4. **🛡️ Best Defense Streak:** Most consecutive steal attempts defended (if we add battle system later)

5. **🌍 Most Unique Victims:** Most different players you've stolen Flag from
   - Encourages variety, not targeting same player

6. **💰 Highest Earnings:** Most resources earned via Flag bonuses (single reign)
   - Shows optimal farming with Flag

### **Weekly Leaderboards (Reset Monday 12:00 AM EST):**
> **Note:** All times displayed in 12-hour clock format (AM/PM), EST timezone
1. **📅 This Week's Champion:** Most hours held this week
2. **⚡ Weekly Steals:** Most Flag captures this week
3. **💎 Weekly Earnings:** Most resources earned via Flag this week
4. **🔥 Hottest Streak:** Longest continuous hold this week

### **Player Flag Stats (Profile Page):**
```
🚩 FLAG STATISTICS
━━━━━━━━━━━━━━━━━━━━━━━━━
Total Times Held: 47
Longest Reign: 6 hours 23 minutes
Total Time Held: 94 hours 12 minutes
Times Stolen From: 38
Times Stolen By You: 42
Total Resources Earned: 4,250,000 Metal + 3,890,000 Energy
Permanent Harvest Bonus: +8% (from 4x 24hr holds)

Current Status: 🔒 On Cooldown (18:42 remaining)
Last Held: 2 hours ago
Last Stolen From: PlayerXYZ
Next Available Steal: In 18 minutes
```

### **Global Flag Widget (Homepage):**
```
🚩 THE GOLDEN FLAG
━━━━━━━━━━━━━━━━━━━━━━━━━
Current Holder: [⚡FLAG BEARER] MegaFarmer
Time Held: 3 hours 47 minutes ⏱️ (live counter)
Location: Northwest Quadrant (your research tier)
          [🔓 Unlock precise tracking]

Total Owners Today: 12 different players
Longest Reign Today: SuperPlayer (8h 15m)
Most Steals Today: FlagHunter (5 steals)

[📍 Track Flag] [⚔️ Steal Attempts Today: 23]
```

---

## 🎨 **VISUAL & UI DESIGN**

### **Recommended NPM Packages for Visual Effects:**

**Map Rendering (USER CHOICE: PixiJS):**
- **`pixi.js`** - WebGL-based 2D rendering engine (REQUIRED for map module)
- **`@pixi/react`** - React bindings for PixiJS (optional, for React integration)
- **Why PixiJS:**
  - Superior performance (WebGL hardware acceleration)
  - Built-in sprite batching and texture atlas support
  - Efficient particle systems (ParticleContainer)
  - Touch/gesture support out of the box
  - Active community and excellent documentation
  - Perfect for grid-based games with many sprites

**Sparkle/Particle Effects (STAR CLUSTER DESIGN):**
- **`tsparticles`** - TypeScript version with React support (RECOMMENDED by user)
- **Design Direction:** Star cluster effect, NOT geometric shapes
  - Small golden star particles clustered together
  - Twinkling/pulsing effect (varying opacity)
  - Random orbital motion around cluster center
  - Particle count: 15-25 stars per cluster
  - Size variation: Mix of small (2px), medium (4px), large (6px) stars
- `particles.js` - Lightweight alternative (if tsparticles too heavy)
- `react-spring` - For smooth animations and transitions
- `framer-motion` - Advanced animation library for React

**tsparticles Configuration Example (Star Cluster):**
```typescript
import { loadFull } from "tsparticles";

const particlesConfig = {
  particles: {
    number: { value: 20, density: { enable: true, area: 800 } },
    color: { value: "#FFD700" }, // Golden
    shape: {
      type: "star", // Star shape, not circles/polygons
      options: {
        star: { sides: 5 }
      }
    },
    opacity: {
      value: { min: 0.3, max: 1 },
      animation: { enable: true, speed: 2, sync: false } // Twinkling
    },
    size: {
      value: { min: 2, max: 6 }, // Size variation
      animation: { enable: true, speed: 3, sync: false }
    },
    move: {
      enable: true,
      speed: 0.5,
      direction: "none",
      random: true,
      straight: false,
      outModes: { default: "bounce" },
      attract: { enable: true, distance: 100, rotate: { x: 600, y: 600 } }
    }
  },
  interactivity: {
    events: {
      onHover: { enable: true, mode: "repulse" },
      onClick: { enable: true, mode: "push" }
    }
  }
};
```

**Flee Direction Indicator:**
- **Approach:** Small overlay arrow on current Flag Bearer tile
- **Design:** Final implementation to be determined during development phase
- **User Decision:** "I'll leave the design up to you"
- **Implementation Options:**
  1. **CSS Animation** - Simple rotating arrow with CSS transforms (lightweight)
  2. **Canvas API** - Draw arrow directly on map canvas (best performance)
  3. **SVG Animation** - Animated arrow with `react-spring` or `framer-motion`
- **Recommended Package:** `react-spring` for smooth directional arrow animations
- **Visual Design:** 
  - Pulsing golden arrow pointing in flee direction
  - Appears for 2-3 seconds after flee
  - Fades out gradually
  - Could use `@react-spring/web` with `useSpring` hook

**Example Implementation:**
```typescript
import { useSpring, animated } from '@react-spring/web';

const FleeDirectionIndicator = ({ direction }: { direction: string }) => {
  const props = useSpring({
    from: { opacity: 1, scale: 1 },
    to: { opacity: 0, scale: 1.5 },
    config: { duration: 2000 }
  });
  
  return (
    <animated.div style={props} className="flee-arrow">
      ➤ {/* Rotate based on direction */}
    </animated.div>
  );
};
```

### **Flag Bearer Visual Indicators:**

**On Game Map:**
- **Character aura:** Pulsing golden glow (radius 2 tiles, animated) - use `particles.js` or CSS animations
- **Flag icon:** Animated golden flag floating above player (waving animation) - CSS keyframes or `framer-motion`
- **Name color:** Bright gold (#FFD700) with text shadow
- **Particle trail:** Golden sparkles on every tile moved (8-minute duration) - `tsparticles` recommended
- **Trail username display:** Hover/click trail tile to see who left it (see below)
- **Crown particle:** Small golden crown particles orbiting player - `particles.js` with circular motion
- **Flee direction arrow:** Pulsing golden arrow overlay (appears 2-3s after flee) - `react-spring` recommended

**In UI Elements:**
- **Leaderboards:** 👑 Crown icon + gold highlight row
- **Chat messages:** Gold message background + flag emoji prefix
- **Profile page:** Animated gold border + "Currently Holding Flag" banner - `framer-motion` for smooth border animation
- **Player list:** Top of list, separated, with divider line

### **Particle Trail Visualization:**

**Trail Tile Appearance:**
- **Immediate (0-2 mins):**
  - Bright golden sparkles floating upward
  - 8-10 particles visible
  - Glow effect on tile border
  - Pulsing animation (1s cycle)

- **Recent (2-5 mins):**
  - Medium gold sparkles
  - 4-6 particles visible
  - Fading glow
  - Slower pulse

- **Fading (5-8 mins):**
  - Dim golden wisps
  - 1-3 particles visible
  - No glow
  - Static/fading out

- **Gone (8+ mins):**
  - Trail completely disappears
  - Tile returns to normal

**Trail Username Display (VERY CLEAR UI):**
When hovering or clicking on a particle trail tile:
```
┌─────────────────────────────┐
│  🌟 FLAG BEARER TRAIL       │
│  ────────────────────────── │
│  Left by: [⚡USERNAME]       │
│  Time: 3 minutes ago        │
│  Direction: Northeast ↗️     │
│  Trail expires: 5 mins      │
│                             │
│  [📍 Track This Player]     │
└─────────────────────────────┘
```
**Display Requirements:**
- Large, readable font
- High contrast (gold text on dark background)
- Username clearly labeled with Flag emoji
- Arrow showing direction of travel
- Expiry countdown clearly visible

**Trail Line Visualization (Optional):**
- Connect trail tiles with faint golden line
- Shows path pattern at a glance
- Toggle on/off in settings

### **Flag Tracking UI:**

**Map Overlay (Based on Research Tier):**
- **Tier 1:** Large red translucent quadrant (25% of map)
- **Tier 2:** Medium orange zone (1-2% of map)
- **Tier 3:** Small yellow circle (±10 tile radius)
- **Tier 4 (VIP):** Precise golden pulsing marker

**Tracking Panel (Side Panel):**
```
🚩 FLAG TRACKER
━━━━━━━━━━━━━━━━━━━━━━
Holder: [⚡FLAG BEARER] Username
Time Held: 2h 34m 18s ⏱️

Your Research: Tier 2 (Zone Tracking)
Location: Zone 12 (Northwest)
Last Update: 3 minutes ago
Next Update: In 12 minutes

Distance: ~45 tiles away ⚠️ TOO FAR
Direction: ↗️ Northeast

Trail Age: 4-7 minutes old
Pattern: Circular farming route

Challenge Range: 15 tiles (need 30 closer)
Flee Range: 5 tiles random (still catchable!)

[🗺️ Navigate to Flag] [⬆️ Upgrade Tracking]

Grace Period: ACTIVE (7:32 remaining)
You can challenge in: 22:15 (cooldown)
```

### **Steal Interaction UI:**

**When Within 15 Tiles of Flag Bearer:**
```
┌─────────────────────────────────────────────┐
│  ⚔️  CHALLENGE FOR FLAG                     │
│                                              │
│  Target: [⚡FLAG BEARER] Username (Rank 1)   │
│  Distance: 12 tiles away ↗️                  │
│                                              │
│  📊 THEIR SESSION EARNINGS:                 │
│      Metal Earned: 2,450,000                │
│      Energy Earned: 2,680,000               │
│      Total Session: 5,130,000 resources     │
│                                              │
│  ⚠️  30-SECOND CHANNEL (both locked!)       │
│      • You: Locked 30 seconds               │
│      • Them: Locked 5s, then can flee       │
│                                              │
│  ⛔ NO BATTLE - Only Flee or Surrender      │
│                                              │
│  💰 BOUNTY IF THEY FLEE (2nd flee):         │
│      Cost: 15% of session earnings          │
│      Payment to YOU: 367,500 Metal          │
│                     +402,000 Energy         │
│      Total Bounty: 769,500 resources! 🤑    │
│                                              │
│  Success: Win Flag + all bonuses            │
│  They Flee: You get 769k resources!         │
│                                              │
│  Grace Period: EXPIRED ✅                    │
│  Flee Cooldown (Them): 23s remaining ⚠️     │
│  Flee Count (This Session): 1 / 5 max       │
│  💡 After 5 flees, they AUTO-LOSE on 6th!   │
│                                              │
│  💡 Even if they flee, you get PAID!        │
│  🎯 Restrict: Building/Banking DISABLED     │
│                                              │
│  [ Cancel ]    [💎 START CHALLENGE! 💎]     │
└─────────────────────────────────────────────┘
```

**When Target at 5/5 Flees (GUARANTEED WIN):**
```
┌─────────────────────────────────────────────┐
│  💀💀💀 GUARANTEED FLAG WIN! 💀💀💀          │
│                                              │
│  Target: [⚡FLAG BEARER] Username (Rank 1)   │
│  Distance: 12 tiles away ↗️                  │
│                                              │
│  🔥 THEY'VE FLED 5 TIMES - CAN'T FLEE AGAIN!│
│                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  ✨ THIS CHALLENGE = AUTO-WIN! ✨           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                              │
│  📊 THEIR SESSION STATS:                    │
│      Session Earnings: 5,130,000 resources  │
│      Times Fled: 5 / 5 MAX                  │
│      Total Paid Out: 2,565,000 resources    │
│      Remaining Profit: 2,565,000 resources  │
│                                              │
│  ⚠️  30-SECOND CHANNEL (formality)          │
│      They CANNOT flee or defend!            │
│      Flag WILL transfer automatically!      │
│                                              │
│  💎 GUARANTEED REWARDS:                     │
│      ✅ Win the Flag + all bonuses          │
│      ✅ They keep their 2.5M profit         │
│      ✅ No payment (they can't flee)        │
│                                              │
│  🎯 FREE FLAG - CLAIM IT NOW!               │
│                                              │
│  [ Cancel ]   [🏆 CLAIM FLAG (FREE WIN)]    │
└─────────────────────────────────────────────┘
```

**Multiple Challengers (Queue System):**
- Only **ONE active challenge** at a time
- First player to click "Challenge" **locks the interaction**
- Other players see error message:
  ```
  ⚠️ Already being challenged by [Username]!
  
  Wait for current challenge to complete.
  You can try again immediately after.
  (No cooldown penalty for attempting during active challenge)
  ```
- **First-come-first-served** basis
- When challenge resolves (flee/stolen), **next player can immediately challenge**
- No cooldown penalty for attempting during active challenge

**During Channel (Challenger View):**
```
┌─────────────────────────────────────────────┐
│  ⚔️  CHALLENGING FOR FLAG!                  │
│                                              │
│  Channeling... [████████████░░] 3.2s        │
│                                              │
│  🔒 You are locked in place!                │
│  ⚠️ Target can flee after 2 seconds!        │
│                                              │
│  [❌ Cancel Challenge] (forfeit + cooldown) │
└─────────────────────────────────────────────┘
```

**During Channel (Flag Bearer View):**
```
┌─────────────────────────────────────────────┐
│  🚨 FLAG CHALLENGE INCOMING!                │
│                                              │
│  Attacker: [Username] (Level 47)            │
│  Channel: [████████████░░] 3.2s remaining   │
│                                              │
│  🔒 LOCKED for 2 seconds... 1.8s            │
│                                              │
│  After lock expires:                        │
│  [🏃 FLEE (5 tiles)] [⚔️ DEFEND (battle)]   │
│                                              │
│  ⚠️ If you don't act, Flag will be stolen!  │
└─────────────────────────────────────────────┘
```

**After Lock Expires (Flag Bearer):**
```
┌─────────────────────────────────────────────┐
│  🚨 FLAG CHALLENGE ACTIVE!                  │
│                                              │
│  Attacker: [Username] (Rank 47)             │
│  Channel: [██████████░░░] 2.1s remaining    │
│                                              │
│  🔓 UNLOCKED! Choose action NOW:            │
│                                              │
│  � YOUR SESSION EARNINGS:                  │
│     Metal Earned: 2,450,000                 │
│     Energy Earned: 2,680,000                │
│     Total Session: 5,130,000 resources      │
│                                              │
│  �💰 FLEE COST (2nd flee this session):      │
│     Pay 15% of session earnings             │
│     Cost: 367,500 Metal + 402,000 Energy    │
│     (Payment goes to challenger!)           │
│                                              │
│  [🏃 FLEE ⚡] ← Dash 5 tiles random (770k)  │
│  [ Surrender ] ← Give Flag (no cost)        │
│                                              │
│  Current Resources: 4.8M Metal, 5.1M Energy │
│  Can afford: YES ✅ (can flee 3 more times) │
│                                              │
│  ⛔ Building/Banking DISABLED (can't hide!) │
│  💡 Next flee will cost 20% (1.0M total)!   │
│  ⚠️ After 5 flees total, you AUTO-LOSE!     │
│  ⏰ Choose quickly or Flag transfers FREE!  │
│                                              │
│  Flee Available: YES ✅ | Cooldown: 0s      │
│  Flee Count: 1 / 5 max | Next: 15% → 20%   │
└─────────────────────────────────────────────┘
```

**If Insufficient Resources (Can't Afford Flee):**
```
┌─────────────────────────────────────────────┐
│  🚨 FLAG CHALLENGE ACTIVE!                  │
│                                              │
│  Attacker: [Username] (Rank 47)             │
│  Channel: [██████████░░░] 2.1s remaining    │
│                                              │
│  🔓 UNLOCKED! But you're BROKE:             │
│                                              │
│  📊 YOUR SESSION EARNINGS:                  │
│     Metal Earned: 450,000                   │
│     Energy Earned: 380,000                  │
│     Total Session: 830,000 resources        │
│                                              │
│  💀 FLEE COST (5th flee): 30% of earnings   │
│     Cost: 135k Metal + 114k Energy          │
│     You only have: 120k Metal, 95k Energy   │
│                                              │
│  [🏃 FLEE] ← ⛔ INSUFFICIENT RESOURCES      │
│  [ Accept Fate ] ← You will lose Flag       │
│                                              │
│  ⚠️ You fled too many times and ran out!    │
│  💀 You WILL lose the Flag in 2.1 seconds!  │
│  💡 You earned 830k but paid 695k fleeing!  │
│  💡 Next challenge = AUTO-LOSE (6th time)   │
│                                              │
│  Current Resources: 120k Metal, 95k Energy  │
│  Need: 135k Metal + 114k Energy (can't!)    │
│                                              │
│  Flee Available: NO ❌ | Reason: BROKE      │
│  Flee Count: 4 / 5 max | Next: 30% or LOSE │
└─────────────────────────────────────────────┘
```

**If 6th Challenge (AUTO-LOSE - No Flee Option):**
```
┌─────────────────────────────────────────────┐
│  💀 FLAG CHALLENGE #6 - AUTO-LOSE!          │
│                                              │
│  Attacker: [Username] (Rank 47)             │
│  Channel: [████████████░░] 3.2s remaining   │
│                                              │
│  🔒 LOCKED! NO ACTIONS AVAILABLE:           │
│                                              │
│  📊 YOUR SESSION STATS:                     │
│     Times Fled: 5 / 5 (maximum reached)     │
│     Total Paid: 1,850,000 resources         │
│     Session Earnings: 2,100,000 resources   │
│     Net Profit: 250,000 resources           │
│                                              │
│  💀 YOU FLED 5 TIMES - NO MORE ESCAPES!     │
│                                              │
│  [❌ NO FLEE OPTION] ← Maximum reached      │
│  [ ... ] ← You will lose Flag automatically │
│                                              │
│  ⚠️ You had a good run! Time to let it go.  │
│  💀 Flag will transfer in 3.2 seconds!      │
│  💡 You kept 250k profit after 5 flees!     │
│                                              │
│  Flee Available: NO ❌ | Reason: MAX FLEES  │
│  Flee Count: 5 / 5 MAX | Result: AUTO-LOSE │
└─────────────────────────────────────────────┘
```

### **Notifications:**

**Flag Claimed (Personal - First Time):**
```
🎉 YOU CLAIMED THE FLAG!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are now the Flag Bearer! All bonuses active:
• +100% Metal/Energy harvest
• +100% XP and Research Points
• +3 Factory slots (disabled while holding)
• +50% Cave/Forest drops
• +10k Metal/Energy every 10 minutes

⚠️ ALL RESTRICTIONS NOW ACTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
All factories have been FROZEN.

The following are now DISABLED:
❌ Unit Building (factories frozen)
❌ Factory Capturing/Attacks
❌ Factory Upgrades
❌ Auction House Purchases/Sales
❌ Banking (deposits/withdrawals)

You can ONLY:
✅ Farm tiles (with +100% harvest bonus!)
✅ Use Shrine boosts
✅ Move freely across map
✅ Flee from challenges (costs 10-30% of session earnings)
✅ Surrender Flag (no cost)

💡 Your factories are frozen, not removed. When you lose the Flag, all factories are immediately unfrozen!

Session Earnings: 0 Metal + 0 Energy (tracking started)

[✅ Understood]
```

**Factories Frozen Immediately:**
```
⚠️ FACTORIES FROZEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
All your factories (X/10) have been frozen.

The following are now DISABLED:
❌ Unit Building (factories frozen)
❌ Factory Capturing/Attacks
❌ Factory Upgrades
❌ Auction House Purchases/Sales
❌ Banking (deposits/withdrawals)

You can ONLY:
✅ Farm tiles (with +100% harvest bonus!)
✅ Use Shrine boosts
✅ Move around the map

Session Earnings: 47,500 Metal + 52,300 Energy

💡 Focus on farming! Earn as much as you can before
   someone challenges you. Remember: Flee costs come
   from SESSION EARNINGS (what you earn with Flag).

[💎 Start Farming] [📊 View Stats]
```

**Flag Stolen (Global Broadcast):**
```
🚩 FLAG STOLEN!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Username] stole the Flag from [PreviousHolder]!

Previous Holder Stats:
• Time Held: 4 hours 23 minutes
• Session Earnings: 2,450,000 Metal + 2,680,000 Energy
• Times Fled: 3 (paid 890k total to challengers)
• Net Profit: 3,240,000 resources (kept after flee costs)

New Location: Northwest Quadrant (your tier)

[📍 Track New Holder] [⚔️ Plan Your Challenge]
```

**You Lost Flag (Personal):**
```
⚠️ YOU LOST THE FLAG!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Username] stole the Flag from you!

Your Reign Summary:
• Time Held: 4 hours 23 minutes
• Session Earnings: 2,450,000 Metal + 2,680,000 Energy
• Times Fled: 3 times
• Flee Costs Paid: 890,000 Metal + 890,000 Energy
• NET PROFIT: 1,560,000 Metal + 1,790,000 Energy! 🎉

Cave Items Earned: 52 items
Permanent Bonus Earned: None (need 12hr hold for bonus)

🏭 All factories unfrozen! You can build again.
✅ Banking/Auction House/Factory attacks enabled again.

Challenge Cooldown: Cannot be challenged for 30 minutes
Next Challenge Available: In 30:00

[😢 Dang] [💪 Plan Revenge] [💰 Nice Profit!]
```

**Flag Available (Dropped):**
```
🚩 FLAG IS UNCLAIMED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The Flag has been dropped at (X, Y)!

Reason: 12-hour max hold time reached
Previous holder: [Username]

🏃 First to claim wins! Go now!

[🗺️ Navigate to Flag] [🏃 Sprint Mode]
```

---

## 🔔 **SITE-WIDE NOTIFICATION SYSTEM**

### **Notification Types & Implementation:**

**Decision:** Using **combination approach** (Option D)
- **Toast notifications** for general/minor events (non-intrusive)
- **Modal popups** for critical events (requires user attention)
- **Banner notifications** for ongoing state changes

### **Technical Specification:**

**NPM Package:**
- **`react-toastify`** - For toast notifications (INFO, WARNING)
- **Custom modal component** - For CRITICAL events (Flag respawn, challenges)
- **WebSocket-driven** - Real-time notifications via Socket.IO

**Notification Priority Levels:**

**1. INFO (Toast - Auto-dismiss 5s):**
- Player joined/left game
- Daily reset notifications
- Minor game updates
- Resource milestones reached

**2. WARNING (Toast - Auto-dismiss 8s, yellow border):**
- Grace period expiring soon (15min warning)
- Max hold time warnings (10hr, 11hr, 11:30, 11:45)
- Flee cooldown expiring
- Challenge cooldown expiring

**3. CRITICAL (Modal - Requires manual close, sound effect):**
- **Flag claimed:** "🚩 [Username] has claimed the Flag!"
- **Flag stolen:** "🚩 [Username] stole the Flag from [Previous]!"
- **Flag respawn countdown:** 30min, 15min, 5min, 1min, 10s
- **Flag respawned:** "🚩 FLAG HAS RESPAWNED at (X, Y)!"
- **Challenge incoming:** "🚨 [Username] is challenging you for the Flag!"
- **Grace period ended:** "⚠️ You can now be challenged for the Flag!"

**4. STATE (Banner - Persistent until dismissed):**
- **Currently holding Flag:** Top banner showing "You are the Flag Bearer! [bonuses active]"
- **Grace period active:** Banner showing countdown timer
- **Challenge cooldown:** Banner showing when you can challenge again

### **Toast Notification Configuration:**

```typescript
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// INFO level
toast.info("Player joined the game", {
  position: "top-right",
  autoClose: 5000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true
});

// WARNING level
toast.warning("⏰ Grace period expires in 15 minutes!", {
  position: "top-center",
  autoClose: 8000,
  hideProgressBar: false,
  style: { borderLeft: "4px solid #FFA500" }
});

// ERROR/CRITICAL (toast for non-blocking critical)
toast.error("🚩 The Flag has been stolen!", {
  position: "top-center",
  autoClose: false, // Requires manual dismiss
  hideProgressBar: true,
  style: { 
    background: "#FFD700", 
    color: "#000",
    fontSize: "18px",
    fontWeight: "bold"
  }
});
```

### **Modal Notification Component:**

```typescript
import { Modal } from '@/components/ui/Modal';

// CRITICAL events (requires user acknowledgment)
function FlagRespawnModal({ coordinates }: { coordinates: { x: number, y: number } }) {
  return (
    <Modal 
      isOpen={true}
      title="🚩 FLAG HAS RESPAWNED!"
      priority="critical"
      sound={true} // Play alert sound
      backdrop="blur" // Blur background
    >
      <div className="text-center p-6">
        <h2 className="text-3xl font-bold text-gold mb-4">
          THE FLAG IS AVAILABLE!
        </h2>
        <p className="text-xl mb-4">
          Location: <strong>({coordinates.x}, {coordinates.y})</strong>
        </p>
        <p className="text-lg mb-6">
          First player to reach the Flag wins!
        </p>
        <div className="flex gap-4 justify-center">
          <button className="btn-primary">
            🗺️ Navigate to Flag
          </button>
          <button className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

### **Banner Notification Component:**

```typescript
function FlagHolderBanner() {
  const { gracePeriodRemaining } = useFlagState();
  
  return (
    <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-gold to-yellow-500 text-black p-3 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚩</span>
          <span className="font-bold text-lg">
            YOU ARE THE FLAG BEARER
          </span>
        </div>
        <div className="flex items-center gap-4">
          {gracePeriodRemaining > 0 && (
            <span className="text-sm">
              🛡️ Grace Period: {formatTime(gracePeriodRemaining)}
            </span>
          )}
          <span className="text-sm">
            +100% Harvest | +100% XP | +50% Auto-farm
          </span>
          <button className="text-xs underline">
            View All Bonuses
          </button>
        </div>
      </div>
    </div>
  );
}
```

### **WebSocket Event Handling:**

```typescript
// Client-side Socket.IO listeners for notifications
socket.on('FLAG_CLAIMED', (data) => {
  // CRITICAL modal
  showModal({
    type: 'critical',
    title: '🚩 FLAG CLAIMED!',
    message: `${data.username} has claimed the Flag and is now the most powerful player!`,
    sound: true
  });
});

socket.on('FLAG_STOLEN', (data) => {
  // CRITICAL modal
  showModal({
    type: 'critical',
    title: '🚩 FLAG STOLEN!',
    message: `${data.newHolder} stole the Flag from ${data.previousHolder}!`,
    sound: true
  });
});

socket.on('FLAG_RESPAWN_COUNTDOWN', (data) => {
  // CRITICAL modal (for final minute)
  if (data.timeRemaining <= 60) {
    showModal({
      type: 'critical',
      title: '🚩 FLAG RESPAWNING!',
      message: `Flag respawns in ${data.timeRemaining} seconds at (${data.x}, ${data.y})!`,
      countdown: true,
      sound: true
    });
  } else {
    // WARNING toast for earlier countdowns
    toast.warning(`🚩 Flag respawns in ${Math.floor(data.timeRemaining / 60)} minutes!`, {
      autoClose: 10000
    });
  }
});

socket.on('FLAG_CHALLENGE_INCOMING', (data) => {
  // CRITICAL modal (you're being challenged!)
  showModal({
    type: 'critical',
    title: '🚨 FLAG CHALLENGE!',
    message: `${data.challengerUsername} is trying to steal your Flag!`,
    actions: [
      { label: '🏃 FLEE', action: () => handleFlee(), primary: true },
      { label: 'View Challenge', action: () => showChallengeDetails() }
    ],
    sound: true,
    urgent: true
  });
});

socket.on('FLAG_GRACE_PERIOD_ENDED', (data) => {
  // WARNING toast
  toast.warning('⚠️ Grace period has ended! You can now be challenged for the Flag.', {
    autoClose: 10000,
    position: 'top-center'
  });
});
```

### **Sound Effects:**

**Notification Sounds (NPM: `use-sound` or native Audio API):**
- **Critical events:** Loud, attention-grabbing sound (Flag respawn, challenges)
- **Warnings:** Medium volume alert sound (grace period ending)
- **Info:** Subtle ping/chime (general notifications)

```typescript
import useSound from 'use-sound';

const [playCritical] = useSound('/sounds/critical-alert.mp3', { volume: 0.7 });
const [playWarning] = useSound('/sounds/warning.mp3', { volume: 0.5 });
const [playInfo] = useSound('/sounds/notification.mp3', { volume: 0.3 });

// Usage
socket.on('FLAG_RESPAWNED', (data) => {
  playCritical(); // Play sound
  showModal({ /* ... */ }); // Show modal
});
```

### **User Preferences:**

**Settings Panel (Notification Preferences):**
```
🔔 Notification Settings
━━━━━━━━━━━━━━━━━━━━━━
[ ✓ ] Enable site-wide notifications
[ ✓ ] Play sound effects
[ ✓ ] Show critical modals (Flag respawn, challenges)
[ ✓ ] Show warning toasts (grace period, timers)
[ ✓ ] Show info toasts (general events)
[   ] Enable notification vibration (mobile)

Volume: [========--] 80%

[Save Preferences]
```

---

## 🏆 **ACHIEVEMENTS & REWARDS**

> **⚠️ PLANNING PHASE - NOT FINAL**  
> Achievement system not yet fully implemented in game.  
> These achievements are PROPOSED for Flag feature.  
> Will be finalized during achievement system overhaul.

### **Flag-Related Achievements (PROPOSED):**

**Beginner Tier:**
1. **"First Blood"** - Steal the Flag for the first time
   - Reward: 50,000 Metal + 50,000 Energy + "Flag Thief" badge

2. **"Flag Carrier"** - Hold the Flag for 1 hour total (cumulative)
   - Reward: 100,000 resources + "Carrier" badge

3. **"Power Trip"** - Experience all Flag bonuses (harvest, battle, XP, etc.)
   - Reward: 75,000 resources + "Power User" badge

**Intermediate Tier:**
4. **"King of the Hill"** - Hold Flag for 3 hours straight (single reign)
   - Reward: 250,000 resources + "King" title + golden crown badge

5. **"Flag Hunter"** - Challenge Flag Bearer 10 times (earn payments)
   - Reward: 500,000 resources + "Hunter" title + "Bounty Hunter" badge

6. **"Big Payday"** - Earn 5,000,000+ resources from a single flee payment
   - Reward: 1,000,000 resources + "Bounty King" badge

7. **"Untouchable"** - Hold Flag for 6 hours straight
   - Reward: 1,000,000 resources + "Untouchable" title + legendary badge

**Advanced Tier:**
8. **"Emperor"** - Hold Flag for 12 hours straight (reach max hold time)
   - Reward: 2,500,000 resources + "Emperor" title + animated crown badge + permanent +2% harvest bonus

9. **"Unstoppable"** - Challenge Flag Bearer 50 times (earn 50 payments)
   - Reward: 3,000,000 resources + "Unstoppable" title + exclusive cosmetic

10. **"Master Thief"** - Steal Flag from 25 different unique players
    - Reward: 2,000,000 resources + "Master Thief" title

11. **"Broke Them"** - Successfully challenge a Flag Bearer who cannot afford to flee
    - Reward: 1,000,000 resources + "Bank Breaker" badge

**Expert Tier:**
12. **"Nemesis"** - Challenge same player 5 times in one session (earn 5 payments from them)
    - Reward: 500,000 resources + "Nemesis" badge + rivalry tracker

13. **"Flag Monopoly"** - Hold Flag for 100 total hours (cumulative, lifetime)
    - Reward: 5,000,000 resources + "Monopolist" title + permanent +15% harvest

14. **"Speed Demon"** - Steal Flag within 5 minutes of it being taken
    - Reward: 750,000 resources + "Speed Demon" badge

15. **"Wealthy Hunter"** - Earn 50,000,000 total resources from flee payments (lifetime)
    - Reward: 10,000,000 bonus resources + "Wealth Hunter" title + golden bag cosmetic

**Legendary Tier:**
16. **"Flag Legend"** - Hold Flag for 500 total hours (lifetime)
    - Reward: 25,000,000 resources + "Legend" title + lifetime +25% harvest + custom monument + hall of fame entry

17. **"Maximum Overdrive"** - Successfully complete a full 12-hour hold (reach max hold time)
    - Reward: 5,000,000 resources + "Overdrive" title + "12-Hour Legend" badge + permanent +2% harvest bonus

### **Special Rewards:**

**Monthly Flag Champion:**
- Player who held Flag longest this month (cumulative across multiple reigns)
- Reward: 10,000,000 resources + exclusive monthly cosmetic + "Monthly Champion" badge + homepage feature
- Hall of Fame listing (permanent record)

**Yearly Flag Legend:**
- Player who held Flag longest this year (cumulative)
- Reward: 50,000,000 resources + legendary yearly cosmetic + "Yearly Legend" badge + custom title + monument on map with your name
- Yearly champions page (immortalized forever)

**Longest Single Reign Record:**
- Permanent homepage display: "Longest Single Reign: [Username] - 11h 58m 43s" (max possible: 12 hours)
- Special "Record Holder" badge (updated when broken)
- Exclusive cosmetic that only record holders get
- Updated whenever someone beats the previous record
- Previous record holders keep their badge + title forever ("Former Champion")

**Most 12-Hour Completions:**
- Track how many times players reach max 12-hour hold
- Leaderboard: "Most 12-Hour Reigns: [Username] - 8 times"
- Shows dedication and skill (hardest achievement)
- Reward at milestones: 5x = "Veteran", 10x = "Master", 25x = "Godlike"

---

## � **SITE-WIDE NOTIFICATION SYSTEM**

### **Implementation Decision: Combination Approach (Toasts + Modals)**

**Strategy:** Use toast notifications for general events, modal popups for critical events

**Technical Stack:**
- **Toast Notifications:** `react-toastify` (non-intrusive, auto-dismiss)
- **Modal Popups:** Custom React modal component (attention-grabbing, manual dismiss)
- **Sound Effects:** Audio alerts for critical notifications (optional user setting)

---

### **Notification Categories & Implementation:**

#### **🔵 INFO Level (Toast Notifications)**

**Events:**
- Flag claimed by another player
- Someone entered/exited grace period
- Trail visibility updates
- Research tier unlocked
- Achievement progress updates

**Implementation:**
```typescript
toast.info('🚩 PlayerName has claimed the Flag!', {
  position: 'top-right',
  autoClose: 5000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true
});
```

**Visual Style:**
- Blue border (#3498db)
- 5-second auto-dismiss
- Stacks vertically (max 3 visible)
- Minimal animation (slide-in from right)

---

#### **⚠️ WARNING Level (Toast Notifications - Extended Duration)**

**Events:**
- You're approaching 12-hour max hold
- Someone is within challenge range
- Flee cooldown about to expire
- Grace period ending soon
- Session earnings milestone reached

**Implementation:**
```typescript
toast.warning('⚠️ You have 1 hour remaining before Flag drop!', {
  position: 'top-center',
  autoClose: 10000, // 10 seconds
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true
});
```

**Visual Style:**
- Orange border (#f39c12)
- 10-second auto-dismiss
- Top-center position (more prominent)
- Pulsing animation

---

#### **🚨 CRITICAL Level (Modal Popups)**

**Events:**
- **Flag respawn countdown** (30min, 15min, 5min, 1min, 10s)
- **You're being challenged** (active challenge)
- **Flag dropped** (12-hour max reached)
- **You won/lost the Flag**
- **Major milestone reached** (12-hour hold completed)

**Implementation:**
```typescript
// Modal popup with sound effect
showModal({
  title: '🚩 FLAG RESPAWNING!',
  message: 'The Flag will respawn in 1 MINUTE at coordinates (X, Y)! Get ready to race!',
  type: 'critical',
  sound: true,
  buttons: [
    { label: 'View Map', action: () => navigate('/map') },
    { label: 'Dismiss', action: () => closeModal() }
  ],
  backdrop: true, // Darkens background
  closable: true // Can click outside to dismiss
});
```

**Visual Style:**
- Red border (#e74c3c) for critical events
- Golden border (#FFD700) for positive events (Flag won, milestone)
- Center of screen
- Dark backdrop (rgba(0,0,0,0.7))
- Cannot auto-dismiss (requires user action OR auto-dismiss after 30s for respawn countdowns)
- Loud sound effect (toggle in settings)
- Large, attention-grabbing text

---

### **Specific Notification Implementations:**

#### **1. Flag Respawn Countdown (Modal Sequence)**

```typescript
// 30 minutes before
showModal({
  title: '🚩 FLAG RESPAWN ALERT',
  message: 'The Flag will respawn in 30 MINUTES! Prepare to race for coordinates.',
  type: 'info',
  autoClose: 30000 // 30 seconds
});

// 15 minutes before
showModal({
  title: '🚩 FLAG RESPAWNING SOON',
  message: 'The Flag will respawn in 15 MINUTES!',
  type: 'warning',
  autoClose: 20000
});

// 5 minutes before
showModal({
  title: '🚩 FLAG RESPAWN IMMINENT',
  message: 'The Flag will respawn in 5 MINUTES! Get ready!',
  type: 'warning',
  autoClose: 15000,
  buttons: [{ label: 'View Map', action: () => navigate('/map') }]
});

// 1 minute before
showModal({
  title: '🚩 FLAG RESPAWNING IN 1 MINUTE!',
  message: 'Prepare for the race! Coordinates will be revealed in 60 seconds.',
  type: 'critical',
  sound: true,
  autoClose: 60000
});

// 10 second countdown
showModal({
  title: '🚩 FLAG RESPAWNING!',
  message: 'Respawning in 10... 9... 8... 7... 6... 5... 4... 3... 2... 1...',
  type: 'critical',
  sound: true,
  countdown: true,
  autoClose: 10000
});

// Respawned
showModal({
  title: '🚩 FLAG HAS RESPAWNED!',
  message: 'The Flag is now at coordinates (X, Y)! First to claim wins!',
  type: 'critical',
  sound: true,
  buttons: [
    { label: 'View Map', action: () => navigate('/map'), primary: true },
    { label: 'Dismiss', action: () => closeModal() }
  ],
  autoClose: 20000
});
```

---

#### **2. Active Challenge Notification (Modal)**

**For Flag Bearer:**
```typescript
showModal({
  title: '🚨 YOU ARE BEING CHALLENGED!',
  message: '[PlayerName] is trying to steal your Flag! You have 5 seconds before you can flee!',
  type: 'critical',
  sound: true,
  persistent: true, // Stays until challenge resolves
  timer: 30000, // Shows 30s countdown
  buttons: [
    { label: '🏃 FLEE (Available in 5s)', action: fleeAction, disabled: true, enableAfter: 5000 },
    { label: 'Surrender', action: surrenderAction }
  ]
});
```

**For Challenger:**
```typescript
showModal({
  title: '⚔️ CHALLENGING FOR FLAG!',
  message: 'Channeling... 30 seconds remaining. You are locked in place!',
  type: 'info',
  persistent: true,
  timer: 30000,
  buttons: [
    { label: '❌ Cancel Challenge', action: cancelAction }
  ]
});
```

---

#### **3. Flag Won/Lost Notifications (Modal)**

**Won Flag:**
```typescript
showModal({
  title: '🎉 YOU WON THE FLAG!',
  message: 'You are now the most powerful player! All bonuses active. Grace period: 1 hour.',
  type: 'success',
  sound: true,
  confetti: true, // Optional: Trigger confetti animation
  buttons: [
    { label: 'View Bonuses', action: () => navigate('/profile') },
    { label: 'Start Farming', action: () => closeModal() }
  ]
});
```

**Lost Flag:**
```typescript
showModal({
  title: '⚠️ YOU LOST THE FLAG!',
  message: 'You lost the Flag to [PlayerName]! You earned 5,130,000 total resources while holding it.',
  type: 'warning',
  sound: true,
  stats: {
    sessionEarnings: { metal: 2450000, energy: 2680000 },
    timeHeld: '2h 34m 18s',
    fleesUsed: 2
  },
  buttons: [
    { label: 'View Stats', action: () => navigate('/stats') },
    { label: 'Challenge Again (30min cooldown)', action: () => closeModal(), disabled: true }
  ]
});
```

---

#### **4. 12-Hour Milestone Notifications (Modal + Toast Sequence)**

**10-hour warning (Toast):**
```typescript
toast.warning('⏰ You\'ve held Flag for 10 hours! Flag will drop when time runs out.', {
  position: 'top-center',
  autoClose: 10000
});
```

**11-hour warning (Modal):**
```typescript
showModal({
  title: '🚨 FLAG WILL DROP IN 1 HOUR!',
  message: 'Plan your session wrap-up. You\'ll receive +2% permanent harvest bonus!',
  type: 'warning',
  sound: true,
  autoClose: 20000
});
```

**11:45 warning (Modal):**
```typescript
showModal({
  title: '🔥 15 MINUTES REMAINING!',
  message: 'Flag drop imminent! Bank your resources now!',
  type: 'critical',
  sound: true
});
```

**12-hour completion (Modal):**
```typescript
showModal({
  title: '💎 12-HOUR MILESTONE REACHED!',
  message: 'Congratulations! You completed a full 12-hour hold!\n\nRewards:\n• +2% permanent harvest bonus\n• +5,000,000 resources\n• "12-Hour Legend" achievement',
  type: 'success',
  sound: true,
  confetti: true,
  persistent: true,
  buttons: [
    { label: 'Claim Rewards', action: claimRewards, primary: true }
  ]
});
```

---

### **User Settings (Preferences):**

```typescript
interface NotificationSettings {
  toasts: {
    enabled: boolean;
    position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
    duration: number; // milliseconds
    maxVisible: number; // Max stacked toasts
  };
  modals: {
    enabled: boolean;
    sound: boolean; // Play sound effects
    volume: number; // 0-100
    backdrop: boolean; // Darken background
  };
  sounds: {
    info: string; // Sound file path
    warning: string;
    critical: string;
    success: string;
  };
}
```

**Settings Page Option:**
- Toggle toast notifications on/off
- Toggle modal notifications on/off
- Toggle sound effects on/off
- Adjust sound volume
- Change toast position
- Change auto-dismiss duration

---

### **WebSocket Integration:**

All notifications triggered by WebSocket events:

```typescript
// Server broadcasts to all players
socket.broadcast.emit('FLAG_CLAIMED', {
  holderUsername: 'PlayerName',
  coordinates: { x: 47, y: 69 },
  timestamp: Date.now()
});

// Client receives and shows notification
socket.on('FLAG_CLAIMED', (data) => {
  if (notificationSettings.toasts.enabled) {
    toast.info(`🚩 ${data.holderUsername} has claimed the Flag!`);
  }
});

// For critical events
socket.on('FLAG_RESPAWN_COUNTDOWN', (data) => {
  if (notificationSettings.modals.enabled) {
    showModal({
      title: '🚩 FLAG RESPAWNING!',
      message: `Respawning in ${data.timeRemaining} seconds at (${data.x}, ${data.y})`,
      type: 'critical',
      sound: notificationSettings.modals.sound
    });
  }
});
```

---

### **Implementation Priority:**

**Phase 1 (MVP):**
1. Toast notifications for general events (react-toastify)
2. Basic modal component for critical events
3. WebSocket event listeners

**Phase 2 (Enhanced):**
4. Sound effects for critical notifications
5. User settings/preferences
6. Confetti animation for major milestones
7. Countdown timers in modals

**Phase 3 (Polish):**
8. Mobile-optimized notifications
9. Push notifications (if PWA)
10. Notification history panel
11. Do Not Disturb mode

---

## �🔧 **TECHNICAL IMPLEMENTATION**

### **Database Schema (MongoDB):**

```typescript
// Player Schema additions
interface Player {
  // ... existing fields
  
  flagStats: {
    currentlyHolding: boolean;
    heldSince: Date | null; // When they claimed current Flag
    
    // Session earnings tracking (resets when Flag lost)
    sessionEarnings: {
      metal: number; // Resources earned while holding Flag THIS SESSION
      energy: number;
      startedAt: Date | null; // When current session started
    };
    
    // Flee tracking (resets when Flag lost)
    fleeCount: number; // Number of times fled THIS SESSION
    totalFleePaid: {
      metal: number; // Total paid to challengers THIS SESSION
      energy: number;
    };
    
    // Lifetime stats
    totalTimesHeld: number; // Lifetime count
    longestReign: number; // Milliseconds (single reign, max 12hr)
    totalTimeHeld: number; // Milliseconds (cumulative)
    timesStolen: number; // Times you stole from others
    timesStolenFrom: number; // Times stolen from you
    uniqueVictims: string[]; // Array of usernames you've stolen from
    lastHeldAt: Date | null;
    lastStolenAt: Date | null;
    lastStolenFrom: string | null;
    totalResourcesEarned: {
      metal: number; // Lifetime earnings from Flag
      energy: number;
    };
    lifetimeFleePaid: {
      metal: number; // Lifetime total paid to challengers
      energy: number;
    };
    lifetimeFleeCount: number; // Lifetime flee attempts
    permanentHarvestBonus: number; // Percentage (from 12hr holds)
    onCooldown: boolean;
    cooldownEndsAt: Date | null;
    gracePeriodEndsAt: Date | null;
    fleeCooldownEndsAt: Date | null; // 60s after using Flee
    consecutiveStealsFromSamePlayer: {
      [username: string]: {
        count: number;
        firstStealAt: Date;
      };
    };
    maxHoldCompletions: number; // Times reached 12-hour max hold
    cannotClaimUntil: Date | null; // 2hr cooldown after 12hr drop
    challengeCooldowns: {
      [targetPlayerId: string]: Date; // 5-min cooldowns per target
    };
    activeChallenge: {
      isBeingChallenged: boolean;
      challengerId: ObjectId | null;
      challengeStartedAt: Date | null;
      lockExpiresAt: Date | null; // 2-second lock for Flag Bearer
    } | null;
  };
  
  flagResearch: {
    tier: number; // 0-4 (4 = VIP only)
    unlockedAt: Date | null;
  };
  
  flagTrail: {
    tiles: Array<{
      x: number;
      y: number;
      timestamp: Date; // When tile was crossed
      expiresAt: Date; // timestamp + 8 minutes
    }>;
  };
}

// Global Flag State (single document in collection)
interface FlagState {
  currentHolder: ObjectId | null; // Reference to Player
  heldSince: Date | null;
  maxHoldExpiresAt: Date | null; // heldSince + 12 hours (auto-respawn time)
  location: { x: number; y: number } | null;
  lastStealAt: Date | null;
  lastStealBy: ObjectId | null;
  isAvailable: boolean; // True if dropped/unclaimed
  respawnScheduledAt: Date | null; // When Flag will drop (if 12hr limit reached)
  
  // Active challenge tracking
  activeChallenge: {
    challengerId: ObjectId | null;
    challengerUsername: string | null;
    targetId: ObjectId | null;
    channelStartedAt: Date | null;
    channelExpiresAt: Date | null; // channelStartedAt + 30 seconds
    targetLockExpiresAt: Date | null; // channelStartedAt + 5 seconds (initial lock)
  } | null;
  
  // Daily/weekly stats (reset periodically)
  todayStats: {
    date: Date;
    totalOwners: number;
    ownerUsernames: string[];
    totalSteals: number;
    totalChallenges: number;
    successfulChallenges: number;
    fleeAttempts: number;
    longestReign: {
      username: string;
      duration: number; // Milliseconds (max 12hr)
    };
  };
  
  weekStats: {
    weekStart: Date;
    totalOwners: number;
    totalSteals: number;
    totalMaxHoldCompletions: number; // How many 12hr completions this week
    topHolder: {
      username: string;
      duration: number;
    };
  };
  
  // All-time records
  records: {
    longestSingleReign: {
      username: string;
      duration: number; // Milliseconds (max 12hr = 43,200,000ms)
      achievedAt: Date;
    };
    mostMaxHoldCompletions: {
      username: string;
      count: number;
    };
  };
  
  // Historical record (last 100 reigns)
  history: Array<{
    holder: ObjectId;
    holderUsername: string;
    startTime: Date;
    endTime: Date | null; // Null if currently holding
    duration: number; // Milliseconds
    resourcesEarned: {
      metal: number;
      energy: number;
    };
    stolenBy: ObjectId | null;
    stolenByUsername: string | null;
    endReason: 'stolen' | 'dropped' | 'max_hold_reached';
    // Note: No 'offline' or 'afk' reasons - game functions in real-time regardless of online status
    reachedMaxHold: boolean; // True if hit 12hr limit
  }>;
}

// Particle Trail (separate collection for performance)
interface ParticleTrail {
  playerId: ObjectId;
  holderUsername: string; // For displaying username on trail hover
  tiles: Array<{
    x: number;
    y: number;
    timestamp: Date;
    expiresAt: Date; // Auto-delete via MongoDB TTL index
  }>;
}
```

### **API Endpoints:**

```typescript
// GET /api/flag/status
// Returns current Flag state, holder info, location (based on user's research tier)

// GET /api/flag/session-earnings/:playerId
// Returns Flag Bearer's current session earnings (for challengers to see potential bounty)
// Response: { metal: number, energy: number, startedAt: Date, holdDuration: number }

// POST /api/flag/claim
// Claim unclaimed Flag at specific coordinates

// POST /api/flag/challenge/:targetPlayerId
// Initiate 30-second challenge to steal Flag (validates range, cooldowns, grace period)

// POST /api/flag/challenge/cancel
// Cancel active challenge (if you're the challenger)

// POST /api/flag/flee
// Use Flee ability during active challenge (if you're the Flag Bearer)

// POST /api/flag/defend
// Accept battle during challenge (if you're the Flag Bearer + battle system exists)

// GET /api/flag/can-challenge/:targetPlayerId
// Check if you can challenge specific player (returns cooldowns, distance, grace period status)

// GET /api/flag/tracking
// Get tracking data based on user's research tier (quadrant/zone/region/precise)

// POST /api/flag/research/unlock/:tier
// Unlock Flag tracking tier (spend RP, validate prerequisites)

// GET /api/flag/leaderboards
// Get all Flag leaderboards (all-time, weekly, daily)

// GET /api/flag/stats/:playerId
// Get specific player's Flag statistics

// GET /api/flag/trail
// Get particle trail tiles (for rendering on map)

// POST /api/flag/report
// Report suspicious Flag activity (trading, abuse)

// GET /api/flag/history
// Get Flag ownership history (last 100 reigns)

// GET /api/flag/records
// Get all-time records (longest reign, most 12hr completions, etc.)
```

### **Helper Functions:**

```typescript
/**
 * Calculate Euclidean distance between two points
 * Used for: Challenge range validation (15 tiles), claiming range (15 tiles)
 */
function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * Validate flee destination is within map boundaries
 * Map: 1-150 for both X and Y coordinates
 * Flee distance: 5 tiles in random direction
 */
function validateFleeDestination(
  currentX: number,
  currentY: number,
  direction: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'
): { x: number; y: number; isValid: boolean } {
  const fleeDistance = 5;
  const directionVectors = {
    N:  { dx: 0,  dy: -fleeDistance },
    NE: { dx: fleeDistance,  dy: -fleeDistance },
    E:  { dx: fleeDistance,  dy: 0 },
    SE: { dx: fleeDistance,  dy: fleeDistance },
    S:  { dx: 0,  dy: fleeDistance },
    SW: { dx: -fleeDistance, dy: fleeDistance },
    W:  { dx: -fleeDistance, dy: 0 },
    NW: { dx: -fleeDistance, dy: -fleeDistance }
  };
  
  const vector = directionVectors[direction];
  let newX = currentX + vector.dx;
  let newY = currentY + vector.dy;
  
  // Clamp to map boundaries (1-150)
  newX = Math.max(1, Math.min(150, newX));
  newY = Math.max(1, Math.min(150, newY));
  
  return {
    x: newX,
    y: newY,
    isValid: newX >= 1 && newX <= 150 && newY >= 1 && newY <= 150
  };
}

/**
 * Randomly select flee direction (player cannot choose)
 */
function getRandomFleeDirection(): 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' {
  const directions: Array<'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'> = 
    ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.floor(Math.random() * directions.length)];
}

/**
 * Clean up expired challenge cooldowns (run periodically)
 * Prevents challengeCooldowns map from growing indefinitely
 */
function cleanupExpiredCooldowns(challengeCooldowns: Map<string, Date>): void {
  const now = Date.now();
  const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
  
  for (const [playerId, cooldownExpiry] of challengeCooldowns.entries()) {
    if (cooldownExpiry.getTime() < twentyFourHoursAgo) {
      challengeCooldowns.delete(playerId);
    }
  }
}
```

### **Real-Time Updates (WebSocket):**

```typescript
// Broadcast events to all connected players:

socket.broadcast.emit('FLAG_STOLEN', {
  newHolder: 'Username',
  newHolderId: ObjectId,
  previousHolder: 'PreviousUsername',
  location: { x: 45, y: 67 }, // Full coords or based on listener's tier
  timeHeld: 15342000, // Milliseconds previous holder had it
  resourcesEarned: { metal: 523000, energy: 489000 }
});

socket.broadcast.emit('FLAG_CLAIMED', {
  holder: 'Username',
  holderId: ObjectId,
  location: { x: 45, y: 67 }
});

socket.broadcast.emit('FLAG_DROPPED', {
  previousHolder: 'Username',
  location: { x: 45, y: 67 },
  reason: 'manual' | 'max_hold_reached' | 'disconnected'
  // Note: No 'offline' or 'afk' reasons - if disconnected during challenge = auto-lose
});

socket.broadcast.emit('FLAG_RESPAWNING', {
  previousHolder: 'Username',
  timeHeld: 43200000, // 12 hours in milliseconds
  newLocation: { x: 89, y: 134 },
  respawnReason: 'max_hold_reached',
  resourcesEarnedByHolder: { metal: 5000000, energy: 5000000 }
});

socket.broadcast.emit('FLAG_LOCATION_UPDATE', {
  location: { x: 45, y: 67 }, // Precision based on listener's research tier
  direction: 'northeast',
  speed: 2.5 // Tiles per minute
});

socket.broadcast.emit('FLAG_TRAIL_UPDATE', {
  newTiles: [
    { x: 45, y: 67, timestamp: Date, expiresAt: Date },
    { x: 46, y: 67, timestamp: Date, expiresAt: Date }
  ]
});

socket.broadcast.emit('FLAG_GRACE_PERIOD_ENDED', {
  holder: 'Username',
  location: { x: 45, y: 67 }
});

socket.broadcast.emit('FLAG_CHALLENGE_STARTED', {
  challengerId: ObjectId,
  challengerUsername: 'Challenger',
  targetId: ObjectId,
  targetUsername: 'FlagBearer',
  channelDuration: 30000, // 30 seconds in milliseconds
  location: { x: 45, y: 67 }
});

socket.to(challengerId).emit('FLAG_CHALLENGE_LOCKED', {
  duration: 30000, // You're locked for 30s
  canCancel: true
});

socket.to(targetId).emit('FLAG_CHALLENGE_INCOMING', {
  challengerUsername: 'Challenger',
  lockDuration: 5000, // Locked for 5s
  channelDuration: 30000,
  canFleeAt: Date.now() + 5000
});

socket.to(targetId).emit('FLAG_CHALLENGE_LOCK_EXPIRED', {
  remainingChannelTime: 3000, // 3s left in channel
  canFlee: true,
  canDefend: true,
  fleeCooldown: 60000 // 60s cooldown if flee
});

socket.broadcast.emit('FLAG_CHALLENGE_CANCELLED', {
  challengerUsername: 'Challenger',
  reason: 'cancelled_by_challenger' | 'target_fled' | 'channel_timeout'
});

socket.broadcast.emit('FLAG_FLEE_USED', {
  flagBearer: 'Username',
  oldLocation: { x: 45, y: 67 },
  newLocation: { x: 50, y: 72 }, // 5 tiles away in random direction
  direction: 'NE', // Random direction chosen by system
  fleeCooldown: 60000
});

socket.to(challengerId).emit('FLAG_CHALLENGE_COOLDOWN_EXPIRED', {
  targetPlayerId: ObjectId,
  targetUsername: 'Username',
  message: '✅ You can challenge [Username] for the Flag again!'
});

socket.broadcast.emit('FLAG_MAX_HOLD_WARNING', {
  holder: 'Username',
  timeRemaining: 3600000 // 1 hour in milliseconds
});
```

### **Particle Trail Cleanup Cron Job:**

```typescript
// Run every 1 minute
async function cleanExpiredTrails() {
  const now = new Date();
  
  // MongoDB TTL index handles this automatically, but manual cleanup for safety
  await ParticleTrail.updateMany(
    {},
    {
      $pull: {
        tiles: { expiresAt: { $lt: now } }
      }
    }
  );
}

// Run every 1 minute
async function checkMaxHoldTime() {
  const flagState = await FlagState.findOne();
  if (!flagState.currentHolder || !flagState.heldSince) return;
  
  const now = Date.now();
  const holdTime = now - flagState.heldSince.getTime();
  const maxHoldTime = 12 * 60 * 60 * 1000; // 12 hours
  
  // Progressive warnings (5 stages)
  const warnings = [
    { at: 10 * 60 * 60 * 1000, message: "⏰ You've held Flag for 10 hours! Flag will be dropped when time runs out." },
    { at: 11 * 60 * 60 * 1000, message: "🚨 FLAG WILL DROP IN 1 HOUR! Plan your session wrap-up." },
    { at: 11.5 * 60 * 60 * 1000, message: "⚠️ 30 MINUTES REMAINING! Flag drops soon!" },
    { at: 11.75 * 60 * 60 * 1000, message: "🔥 15 MINUTES! Flag drop imminent!" },
    { at: 11.917 * 60 * 60 * 1000, message: "💀 5 MINUTES! Final warning before Flag drops!" }
  ];
  
  const holder = await User.findById(flagState.currentHolder);
  for (const warning of warnings) {
    if (holdTime >= warning.at && holdTime < (warning.at + 60 * 1000)) {
      socket.to(holder._id).emit('FLAG_MAX_HOLD_WARNING', {
        message: warning.message,
        timeRemaining: maxHoldTime - holdTime
      });
    }
  }
  
  // 12 hours reached: Drop Flag
  if (holdTime >= maxHoldTime) {
    await dropFlagAtMaxHold();
  }
}

// Handle 12-hour max hold drop
async function autoRespawnFlag() {
  const flagState = await FlagState.findOne();
  const holder = await User.findById(flagState.currentHolder);
  
  // Calculate final rewards
  const finalRewards = {
    metal: 2000000,
    energy: 2000000
  };
  
  // Award final bonuses
  holder.resources.metal += finalRewards.metal;
  holder.resources.energy += finalRewards.energy;
  holder.flagStats.permanentHarvestBonus += 2; // +2% permanent bonus
  holder.flagStats.maxHoldCompletions += 1;
  holder.flagStats.cannotClaimUntil = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2hr cooldown
  
  // Award "Maximum Overdrive" achievement
  await awardAchievement(holder._id, 'MAXIMUM_OVERDRIVE');
  
  // Update records
  if (holder.flagStats.maxHoldCompletions > (flagState.records.mostMaxHoldCompletions?.count || 0)) {
    flagState.records.mostMaxHoldCompletions = {
      username: holder.username,
      count: holder.flagStats.maxHoldCompletions
    };
  }
  
  // Log history
  flagState.history.push({
    holder: holder._id,
    holderUsername: holder.username,
    startTime: flagState.heldSince,
    endTime: new Date(),
    duration: 12 * 60 * 60 * 1000,
    resourcesEarned: holder.flagStats.totalResourcesEarned,
    stolenBy: null,
    stolenByUsername: null,
    endReason: 'max_hold_reached',
    reachedMaxHold: true
  });
  
  // Generate random respawn location
  const newLocation = generateRandomFlagLocation(); // Helper function
  
  // Broadcast respawn event
  socket.broadcast.emit('FLAG_RESPAWNING', {
    previousHolder: holder.username,
    timeHeld: 12 * 60 * 60 * 1000,
    newLocation: newLocation,
    respawnReason: 'max_hold_reached',
    resourcesEarnedByHolder: finalRewards
  });
  
  // Reset Flag state
  flagState.currentHolder = null;
  flagState.heldSince = null;
  flagState.maxHoldExpiresAt = null;
  flagState.location = newLocation;
  flagState.isAvailable = true;
  
  // Clear holder's Flag status
  holder.flagStats.currentlyHolding = false;
  holder.flagStats.lastHeldAt = new Date();
  
  await holder.save();
  await flagState.save();
  
  // Notify everyone
  socket.broadcast.emit('FLAG_DROPPED', {
    previousHolder: holder.username,
    location: newLocation,
    reason: 'max_hold_reached'
  });
}

// Generate random Flag spawn location (helper)
function generateRandomFlagLocation(): { x: number, y: number } {
  const MAP_SIZE = 150;
  const EDGE_BUFFER = 10; // Don't spawn within 10 tiles of edge
  
  let x, y, terrain;
  
  do {
    x = Math.floor(Math.random() * (MAP_SIZE - 2 * EDGE_BUFFER)) + EDGE_BUFFER;
    y = Math.floor(Math.random() * (MAP_SIZE - 2 * EDGE_BUFFER)) + EDGE_BUFFER;
    terrain = getTerrainAt(x, y); // Helper to get terrain type
  } while (
    terrain === 'Wasteland' || // Never spawn on Wasteland
    isPlayerOnTile(x, y) || // Never spawn on occupied tile
    isWithin5TilesOfPlayer(x, y) // Never spawn too close to players
  );
  
  return { x, y };
}
```

### **Particle Trail System:**

```typescript
// When Flag Bearer moves
async function onPlayerMove(playerId: ObjectId, newTile: {x: number, y: number}) {
  const player = await User.findById(playerId);
  
  if (player.flagStats.currentlyHolding) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 8 * 60 * 1000); // 8 minutes
    
    // Add tile to trail
    await ParticleTrail.updateOne(
      { playerId },
      {
        $push: {
          tiles: {
            x: newTile.x,
            y: newTile.y,
            timestamp: now,
            expiresAt: expiresAt
          }
        }
      },
      { upsert: true }
    );
    
    // Broadcast new trail tile to all players
    socket.broadcast.emit('FLAG_TRAIL_UPDATE', {
      tile: { x: newTile.x, y: newTile.y, timestamp: now, expiresAt }
    });
    
    // Update Flag location
    await FlagState.updateOne(
      {},
      { 
        $set: { 
          location: { x: newTile.x, y: newTile.y } 
        } 
      }
    );
  }
}
```

---

## 🎯 **VIP ENHANCEMENTS** (Advantages, NOT Exclusive Access)

### **VIP Benefits (Repeat of earlier section, for clarity):**
1. **Cheaper Research:** VIP pays 30-40% less RP for tracking tier unlocks
2. **Tier 4 Tracking:** Precise coordinates (VIP-exclusive)
3. **Extended Grace Period:** 15 minutes instead of 10 minutes
4. **Priority Notifications:** Instant alerts (no throttling)
5. **Flag Compass:** Arrow always pointing to Flag holder
6. **Detailed Steal History:** See who stole from whom (full log)
7. **Pattern Prediction:** AI predicts Flag holder's next moves
8. **ETA Calculator:** "You can reach Flag in X minutes"

### **VIP Cosmetics (If Holding Flag):**
- **Platinum Flag:** VIP holders get platinum flag icon (more prestigious than gold)
- **Enhanced Particles:** VIP trail particles are larger, more sparkly
- **VIP Crown:** Different crown visual above character
- **Custom Sound:** Different steal sound for VIP

---

## 📈 **SUCCESS METRICS**

**Track Post-Launch:**
- **Participation Rate:** % of active players who have attempted to steal Flag (target: 50%+)
- **Daily Ownership Changes:** Average steals per day (target: 10-20)
- **Research Adoption:** % of players who unlock tracking tiers (target: 70%+)
- **Longest Reign Record:** Track and celebrate world records
- **Social Engagement:** Clan alliances formed, chat activity about Flag
- **VIP Conversion:** % of Flag participants who become VIP for Tier 4 tracking (target: 15%+)
- **Retention Impact:** Do Flag participants have higher retention? (hypothesis: yes)

---

## 🚀 **IMPLEMENTATION ROADMAP**

### **Phase 1: Core Flag Mechanics (10-14 hours)**
- Database schema (Player.flagStats, FlagState, ParticleTrail)
- Flag claim/steal logic (validation, cooldowns, grace period)
- Session earnings tracking system (GROSS total, flee cost calculations)
- Basic UI (claim button, steal button)
- WebSocket broadcasts (FLAG_STOLEN, FLAG_CLAIMED, FLAG_DROPPED)

### **Phase 2: Particle Trail System (6-8 hours)**
- Trail tile tracking (add to ParticleTrail collection on movement)
- Trail expiration logic (8-minute TTL)
- Frontend particle animation (CSS + Canvas/SVG)
- Trail rendering on map (visual sparkles)
- Real-time trail updates (WebSocket FLAG_TRAIL_UPDATE)

### **Phase 3: Tracking & Research Tree (6-10 hours)**
- Research tree implementation (4 tiers, RP costs)
- Location tracking logic (quadrant → zone → region → precise)
- Map overlay visualization (colored regions)
- Tracking panel UI (side panel with holder info)
- VIP-exclusive Tier 4 (precise coordinates)

### **Phase 4: Visual Polish & Notifications (4-6 hours)**
- Flag Bearer visual effects (golden aura, flag icon, crown)
- Particle effects on character
- Notification system (stolen, lost, available, cooldowns)
- Leaderboard integration (all-time, weekly, daily)
- Profile stats display (flag statistics section)

### **Phase 5: Anti-Grief & Balance (3-5 hours)**
- Cooldown system (steal cooldown, lost cooldown, cleanup for expired entries)
- Report system (suspicious activity)

### **Phase 6: Achievements & Rewards (2-4 hours)**
- Achievement definitions (16 achievements)
- Achievement tracking (check on Flag events)
- Reward distribution (resources, badges, titles)
- Permanent bonus system (+2% per 12hr hold)
- Monthly/yearly champion tracking

**Total Estimated Effort:** 28-42 hours (reduced from 38-54 hours)
**Reductions:** Passive income system removed (6-8 hours saved), grace period removed (2-4 hours saved)
**Simplifications:** Immediate restrictions (no grace state management), random flee direction (no UI for direction picker)

**Recommended Launch Order:**
1. **Phase 1** (core) - Get basic Flag working with 3-tile range + challenge system
2. **Phase 4** (visuals) - Make it look amazing (channel bars, lock indicators, flee animation)
3. **Phase 2** (trails) - Add trail system
4. **Phase 3** (tracking) - Add research tree
5. **Phase 5** (anti-grief) - Balance and protect (max 12hr hold, flee cooldowns, challenge cooldowns)
6. **Phase 6** (achievements) - Long-term goals

---

## ⚠️ **POTENTIAL ISSUES & SOLUTIONS**

### **Issue: "Flag changes hands too frequently" (chaos)**
**Solutions:**
- ✅ **IMPLEMENTED:** 30-second channel (prevents instant steals, gives defenders time to react)
- ✅ **IMPLEMENTED:** Flee ability (Flag Bearer can escape if quick enough)
- ✅ **IMPLEMENTED:** 1-hour grace period after successful steal (reward for effort)
- If still too chaotic: Increase grace period (1hr → 2hr)
- If still too chaotic: Longer challenge channel (30s → 60s)

### **Issue: "Impossible to catch active farmers" (movement speed problem)**
**Solutions:**
- ✅ **IMPLEMENTED:** 15-tile challenge range (don't need exact tile!)
- ✅ **IMPLEMENTED:** 30-second channel with 5-second lock (gives Flag Bearer time to assess situation)
- ✅ **IMPLEMENTED:** Flee ability for Flag Bearer (5-tile random dash, 60s cooldown - still catchable!)
- ✅ **SOLVED:** No longer need to click same tile instantly
- ✅ **BALANCED:** Large range (706 tiles) makes catching farmers realistic on 22.5k tile map

### **Issue: "Top players dominate Flag" (power imbalance)**
**Solutions:**
- ✅ **IMPLEMENTED:** 12-hour max hold (prevents indefinite hoarding)
- ✅ **IMPLEMENTED:** 2-hour cooldown after 12hr limit (can't reclaim immediately)
- ✅ **IMPLEMENTED:** Auto-respawn at random location (everyone has equal chance)
- Research tree accessible to all (free players can track too)
- Social coordination (lower-ranked players form alliances)
- Particle trail makes even powerful players vulnerable (can be tracked)

### **Issue: "Players abuse Flag trading" (friends trading back and forth)**
**Solutions:**
- ✅ **IMPLEMENTED:** Cooldown after losing (30 mins - can't be challenged again immediately)
- ✅ **IMPLEMENTED:** First-come-first-served for multiple challengers (no priority system to abuse)
- Admin monitoring + flagged accounts
- Community reports (report system)

### **Issue: "Flag holder goes offline, Flag stuck"**
**Solutions:**
- ✅ **IMPLEMENTED:** Max hold time (12 hours → Flag drops automatically)
- ✅ **IMPLEMENTED:** Game functions in real-time regardless of player online status
- If challenged while websocket disconnected: Cannot defend = auto-lose Flag to challenger
- Broadcast "Flag available!" notification when Flag dropped
- **NOTE:** Flag stays with holder regardless of online/offline status until challenged or 12hr limit

### **Issue: "Particle trail causes performance issues"**
**Solutions:**
- Limit trail to last 100 tiles (cap memory usage)
- TTL index on ParticleTrail collection (auto-cleanup)
- Client-side rendering optimization (Canvas or CSS animations, not DOM)
- Optional trail visibility toggle in settings ("Hide other players' trails")

### **Issue: "Players complain it's too hard to find Flag"**
**Solutions:**
- Reduce research costs (make tracking cheaper)
- Improve particle trail visibility
- Add "Flag Compass" for all players (not just VIP)
- Increase update frequency (30min → 15min for Tier 1)

### **Issue: "No one holds Flag long enough to earn good rewards"**
**Solutions:**
- Reduce flee costs (make progression 5%/10%/15%/20%/25% instead of 10%/15%/20%/25%/30%)
- Increase +100% harvest bonus to +150% (make farming more rewarding)
- Add more frequent milestone rewards (bonuses at 1hr, 2hr, 4hr, 8hr, 12hr)

---

## 🎉 **MARKETING & LAUNCH STRATEGY**

### **Pre-Launch (1 Week Before):**
- **Teaser Campaign:**
  - "Something golden is coming to DarkFrame..."
  - Silhouette image of flag
  - Countdown timer on homepage
  - Discord announcements (daily teasers)

- **Hype Building:**
  - Screenshot reveals (particle trail, golden aura)
  - Explain bonuses ("+100% harvest! +100% XP! Everything boosted!")
  - Showcase research tree (tease Tier 4 tracking)
  - Contest: "Guess where Flag will spawn" (winner gets bonus RP)

### **Launch Day:**
- **Live Event:**
  - Flag spawns at announced time (e.g., 12:00 PM UTC)
  - All online players see notification: "🚩 THE GOLDEN FLAG HAS APPEARED!"
  - Race to claim (first player gets exclusive "Pioneer" badge)
  - Livestream the event (if possible)

- **Social Media Blitz:**
  - Announce on Twitter/Discord/Reddit: "The Flag is LIVE!"
  - Share first claim: "Congrats to [Username] for claiming first!"
  - Share first steal: "And it's stolen! [Username2] is the new Flag Bearer!"
  - Hashtag campaign: #DarkFrameFlag

### **Post-Launch (First Week):**
- **Daily Updates:**
  - "Today's Flag Report" (who held longest, most steals, etc.)
  - Feature player stories ("How I held the Flag for 8 hours")
  - Leaderboard highlights (top 10 players)

- **Community Engagement:**
  - Encourage screenshots (particle trail, golden aura)
  - Share funny moments ("I stole Flag while holder was disconnected!")
  - Create rivalries ("PlayerA vs PlayerB - who will dominate?")
  - Streamer challenges ("Can you steal Flag on stream?")

### **Long-Term (Monthly):**
- **Monthly Champion Announcement:**
  - Crown the player who held Flag longest this month
  - Award prizes (resources, cosmetics, badges)
  - Feature them on homepage + hall of fame

- **Seasonal Events:**
  - "Flag Frenzy Weekend" (grace period reduced to 5 mins, faster Flag rotation)
  - "Double Harvest Week" (Flag holder gets +200% harvest instead of +100%)
  - "Hide and Seek" (disable tracking for 24hr, pure hunting via particle trails only)

---

## ✅ **FINAL RECOMMENDATION**

**Priority: IMPLEMENT AFTER VIP PHASE 1 MVP**

The Flag is a **game-changing feature** that:
- ✅ Creates dynamic PvP interaction (hunting, stealing, defending)
- ✅ Drives daily engagement (check Flag location, plan steals)
- ✅ Accessible to ALL players (not VIP-gated)
- ✅ Massive rewards (everything boosted 2x or more)
- ✅ Visual spectacle (particle trails, golden aura, effects)
- ✅ Social gameplay (alliances, rivalries, clan coordination)
- ✅ Long-term retention (leaderboards, achievements, permanent bonuses)
- ✅ VIP conversion funnel (Tier 4 tracking incentive)

**Estimated Impact:**
- **+40% daily active users** (check Flag status daily)
- **+60% PvP interactions** (hunting Flag holder)
- **+25% VIP conversions** (desire for Tier 4 tracking)
- **+80% chat activity** (social coordination, trash talk)
- **Massive player engagement** (drama, stories, community events)

**Development Time:** 31-47 hours (1-2 weeks for solo dev)  
**ROI:** EXTREMELY HIGH (retention + engagement + VIP conversion)

---

**Next Steps:**
1. Review and approve this plan
2. Create FID in planned.md
3. Begin Phase 1 implementation (core mechanics)
4. Test with beta players
5. Launch with marketing campaign

**Ready to add to planned.md?** 🚩💎