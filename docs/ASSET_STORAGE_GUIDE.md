# 🎨 Asset Storage Guide - DarkFrame (SIMPLIFIED!)

**Created:** 2025-10-17  
**Updated:** 2025-10-17 - **AUTOMATIC IMAGE LOADING!**  
**Purpose:** Dead-simple guide for adding game images

---

## ⚡ **QUICK START - IT'S REALLY SIMPLE!**

### **Just Drop Your Images In The Right Folder!**

1. Find the terrain folder you want
2. Drop ANY image file (PNG, JPG, GIF, WebP)
3. Use ANY filename you want
4. Refresh the page

**That's it! No code changes, no renaming, no format conversion!**

---

## 🎯 **SUPPORTED IMAGE FORMATS**

✅ `.png` - PNG (best for transparency)  
✅ `.jpg` - JPEG  
✅ `.jpeg` - JPEG (alternative)  
✅ `.gif` - GIF (animated!)  
✅ `.webp` - WebP (modern)

**Mix and match! You can have some PNGs and some JPGs in the same folder!**

---

## 📁 **DIRECTORY STRUCTURE**

All game assets go in: **`public/assets/tiles/`**

### **Available Folders:**

```
public/assets/tiles/
├── auction/        # 🎪 Auction house tiles
├── banks/          # 🏦 Bank tiles (Metal, Energy, Exchange)
├── bases/          # 🏠 Player base overlays
├── cave/           # 🕳️ Cave exploration tiles
├── energy/         # ⚡ Energy resource tiles
├── factory/        # 🏭 Factory building tiles
├── forest/         # 🌲 Forest exploration tiles
├── metal/          # ⚙️ Metal resource tiles
├── shrine/         # ⛩️ Ancient shrine tiles
└── wasteland/      # 🏜️ Wasteland tiles
```

---

## 🎯 **HOW TO ADD IMAGES**

### **Example 1: Adding a Metal Bank Image**
**Location:** `public/assets/tiles/banks/`

1. You have an image called `my-cool-bank.jpg`
2. Drop it in `public/assets/tiles/banks/`
3. Done! The game will find and use it automatically

**File already named `metal-bank.jpg`?** Perfect! No need to rename it.  
**Named something else?** Also perfect! The game detects bank type automatically.

---

### **Example 2: Adding Multiple Forest Variations**
**Location:** `public/assets/tiles/forest/`

1. You have 5 forest images: `forest1.jpg`, `dark_forest.png`, `autumn.jpg`, `IMG_001.jpg`, `tree.png`
2. Drop ALL of them in `public/assets/tiles/forest/`
3. Done! The game will randomly pick one for each forest tile

**Naming doesn't matter!** Call them whatever you want.

---

### **Example 3: Adding Shrine Images**
**Location:** `public/assets/tiles/shrine/`

1. Drop ANY shrine images in the folder
2. Refresh the page
3. That's it!

**No code changes needed at all!**

---

## 🎨 **HOW THE SYSTEM WORKS**

### **Automatic Detection:**
- Game scans each folder on startup
- Finds ALL image files (PNG, JPG, GIF, WebP)
- Ignores non-image files automatically

### **Bank Type Detection:**
- If filename contains "metal" → Metal Bank
- If filename contains "energy" → Energy Bank  
- If filename contains "exchange" → Exchange Bank
- No match? → Generic bank (works for all types)

### **Random Variations:**
- Multiple images in a folder? Game picks one randomly!
- Same tile always gets same image (consistent)
- Different tiles get different random images (variety!)

---

## 📝 **REAL EXAMPLES**

### **What You Added:**
```
public/assets/tiles/banks/
├── energy-bank.jpg     ⬅️ User added (any name works!)
├── metal-bank.jpg      ⬅️ User added
└── exchange_bank.jpg   ⬅️ User added (underscore/dash both fine!)

public/assets/tiles/auction/
└── auction.jpg         ⬅️ User added

**Usage in code:**
```typescript
// OLD WAY (removed):
// <Image src="/assets/tiles/banks/metal-bank.png" alt="Metal Bank" />

// NEW WAY (automatic):

// Random variation (for future enhancement)
const variation = Math.floor(Math.random() * 3) + 1;
<Image src={`/assets/tiles/banks/metal-bank-${variation}.png`} alt="Metal Bank" />
```

---

### **2. 🌲 Forest Images**
**Location:** `public/assets/tiles/forest/`

**Single Image Naming:**
- `forest.png` - Single forest image

**Multiple Variations Naming (RECOMMENDED for forests):**
- `forest-1.png` - Forest variation 1 (e.g., dense trees)
- `forest-2.png` - Forest variation 2 (e.g., clearing with trees)
- `forest-3.png` - Forest variation 3 (e.g., dark ancient forest)
- `forest-4.png` - Forest variation 4 (e.g., mystical glowing forest)
- `forest-5.png` - Forest variation 5 (e.g., autumn forest)

**Seasonal Variations (advanced):**
- `forest-spring.png`, `forest-summer.png`, `forest-autumn.png`, `forest-winter.png`

**Usage in code:**
```typescript
// Single image
<Image src="/assets/tiles/forest/forest.png" alt="Ancient Forest" />

// Random variation (for future enhancement)
const variation = Math.floor(Math.random() * 5) + 1;
<Image src={`/assets/tiles/forest/forest-${variation}.png`} alt="Ancient Forest" />
```

---

### **3. ⛩️ Shrine Images**
**Location:** `public/assets/tiles/shrine/`

**Single Image Naming:**
- `shrine.png` - Main shrine building

**Multiple Variations by Tier (RECOMMENDED):**
- `shrine-base.png` - Base shrine with no active boosts
- `shrine-speed.png` - Shrine with Speed tier active (♠️)
- `shrine-heart.png` - Shrine with Heart tier active (♥️)
- `shrine-diamond.png` - Shrine with Diamond tier active (♦️)
- `shrine-club.png` - Shrine with Club tier active (♣️)
- `shrine-all.png` - Shrine with all 4 tiers active (glowing)

**Animated Variations (advanced):**
- `shrine-idle.gif` - Idle animation
- `shrine-activated.gif` - Activation animation

**Usage in code:**
```typescript
// Single image
<Image src="/assets/tiles/shrine/shrine.png" alt="Ancient Shrine" />

// Dynamic based on active boosts (for future enhancement)
const activeBoosts = player.shrineBoosts.length;
if (activeBoosts === 0) {
  <Image src="/assets/tiles/shrine/shrine-base.png" alt="Shrine" />
} else if (activeBoosts === 4) {
  <Image src="/assets/tiles/shrine/shrine-all.png" alt="Shrine (All Tiers)" />
} else {
  const tier = player.shrineBoosts[0].tier;
  <Image src={`/assets/tiles/shrine/shrine-${tier}.png`} alt={`Shrine (${tier})`} />
}
```

---

## 📝 **FILE FORMAT RECOMMENDATIONS**

### **Preferred Formats:**
1. **PNG** - Best for assets with transparency
2. **JPG/JPEG** - Best for solid background tiles (smaller file size)

### **Image Specifications:**
- **Resolution:** 512×512px or 1024×1024px (square)
- **Aspect Ratio:** 1:1 (square)
- **File Size:** < 500KB per image (for fast loading)
- **Color Space:** RGB

---

## 🔧 **HOW TO ADD IMAGES TO YOUR GAME**

### **Step 1: Save Images**
Place your image files in the appropriate folder:
```
public/assets/tiles/banks/metal-bank.png
public/assets/tiles/forest/forest.png
public/assets/tiles/shrine/shrine.png
```

### **Step 2: Update TileRenderer Component**
The TileRenderer already tries to load images automatically. It follows this pattern:

**For Banks:**
```typescript
// TileRenderer automatically checks:
/assets/tiles/banks/bank.jpg
/assets/tiles/banks/bank.png
```

**For Forests:**
```typescript
// TileRenderer automatically checks:
/assets/tiles/forest/forest.jpg
/assets/tiles/forest/forest.png
```

**For Shrine:**
```typescript
// TileRenderer automatically checks:
/assets/tiles/shrine/shrine.jpg
/assets/tiles/shrine/shrine.png
```

### **Step 3: No Code Changes Needed!**
The current TileRenderer implementation uses a fallback system:
1. Try to load `.jpg` first
2. If that fails, try `.png`
3. If both fail, show colored gradient with emoji icon

So you can simply drop your images into the folders and they'll work!

---

## 🎨 **IMAGE NAMING CONVENTIONS**

### **Standard Naming Pattern:**
- Lowercase letters
- Hyphens for spaces (not underscores)
- Descriptive names

**Good Examples:**
- ✅ `metal-bank.png`
- ✅ `ancient-forest.png`
- ✅ `shrine-heart.png`

**Bad Examples:**
- ❌ `MetalBank.png` (uppercase)
- ❌ `metal_bank.png` (underscore)
- ❌ `bank1.png` (not descriptive)

---

## 🔢 **MULTIPLE ASSET VARIATIONS - NUMBERING SYSTEM**

### **Why Use Multiple Variations?**
- **Visual Variety:** Prevents repetitive, boring landscapes
- **Immersion:** Different variations for different contexts
- **Randomization:** Game randomly selects from available variations
- **Future-Proof:** Easy to add more variations later

---

### **Numbering Pattern:**

**Format:** `{terrain-type}-{number}.{extension}`

**Examples:**
```
forest-1.png      ← First variation
forest-2.png      ← Second variation
forest-3.png      ← Third variation
forest-4.png      ← Fourth variation
forest-5.png      ← Fifth variation
```

**For Type-Specific Assets:**
```
metal-bank-1.png     ← Metal bank variation 1
metal-bank-2.png     ← Metal bank variation 2
energy-bank-1.png    ← Energy bank variation 1
energy-bank-2.png    ← Energy bank variation 2
```

---

### **How Game Uses Variations:**

**Current Behavior (Single Image):**
- Game tries to load `forest.jpg`
- If not found, tries `forest.png`
- If not found, shows green gradient with 🌲 emoji

**Future Enhancement (Multiple Variations):**
```typescript
// Pseudocode for random variation selection
const variationCount = 5; // Number of forest images
const random = Math.floor(Math.random() * variationCount) + 1;
const imagePath = `/assets/tiles/forest/forest-${random}.png`;

// Example: might load forest-3.png randomly
```

---

### **Recommended Variation Counts:**

| Terrain Type | Suggested Count | Rationale |
|-------------|-----------------|-----------|
| **Forests** | 3-5 variations | High variety for rare tiles |
| **Banks** | 2-3 per type | Different architectural styles |
| **Shrine** | 5 variations | One per tier + base |
| **Metal** | 2-3 variations | Different rock formations |
| **Energy** | 2-3 variations | Different glow patterns |
| **Cave** | 2-4 variations | Different cave entrances |
| **Wasteland** | 3-5 variations | Varied desolation |
| **Factory** | 2-3 variations | Different building designs |

---

### **Advanced Naming Patterns:**

**By State:**
```
shrine-base.png      ← No active boosts
shrine-active.png    ← With boosts
shrine-maxed.png     ← All 4 tiers active
```

**By Tier:**
```
shrine-speed.png     ← Speed tier (♠️)
shrine-heart.png     ← Heart tier (♥️)
shrine-diamond.png   ← Diamond tier (♦️)
shrine-club.png      ← Club tier (♣️)
```

**By Rarity (for forests):**
```
forest-common.png    ← Common forest
forest-rare.png      ← Ancient rare forest
forest-legendary.png ← Mystical legendary forest
```

**By Season (advanced):**
```
forest-spring.png
forest-summer.png
forest-autumn.png
forest-winter.png
```

---

### **File Organization Examples:**

**Simple (Single Image per Terrain):**
```
public/assets/tiles/
├── forest/
│   └── forest.png
├── banks/
│   └── bank.png
└── shrine/
    └── shrine.png
```

**Advanced (Multiple Variations):**
```
public/assets/tiles/
├── forest/
│   ├── forest-1.png
│   ├── forest-2.png
│   ├── forest-3.png
│   ├── forest-4.png
│   └── forest-5.png
├── banks/
│   ├── metal-bank-1.png
│   ├── metal-bank-2.png
│   ├── energy-bank-1.png
│   ├── energy-bank-2.png
│   ├── exchange-bank-1.png
│   └── exchange-bank-2.png
└── shrine/
    ├── shrine-base.png
    ├── shrine-speed.png
    ├── shrine-heart.png
    ├── shrine-diamond.png
    └── shrine-club.png
```

---

### **Implementation Notes:**

**Current TileRenderer (Automatic):**
- Tries to load single image first (e.g., `forest.png`)
- Falls back to gradient + emoji if not found
- **No code changes needed** to add images!

**Future Enhancement (Random Variations):**
- Check how many variations exist (count `forest-*.png` files)
- Randomly select one on tile render
- Cache selection per tile for consistency
- Smooth transition between variations

---

## 🚀 **QUICK REFERENCE**

| Terrain Type | Folder Path | Example Filename |
|-------------|-------------|------------------|
| **Banks** | `public/assets/tiles/banks/` | `metal-bank.png` |
| **Forests** | `public/assets/tiles/forest/` | `forest.png` |
| **Shrine** | `public/assets/tiles/shrine/` | `shrine.png` |
| Metal | `public/assets/tiles/metal/` | `metal.png` |
| Energy | `public/assets/tiles/energy/` | `energy.png` |
| Cave | `public/assets/tiles/cave/` | `cave.png` |
| Factory | `public/assets/tiles/factory/` | `factory.png` |
| Wasteland | `public/assets/tiles/wasteland/` | `wasteland.png` |

---

## 💡 **TIPS FOR BEST RESULTS**

1. **Use High-Quality Images:**
   - Clear, detailed artwork
   - Avoid blurry or pixelated images

2. **Maintain Consistent Style:**
   - All tiles should match art style
   - Consistent lighting and perspective

3. **Optimize File Sizes:**
   - Compress images before uploading
   - Use tools like TinyPNG or ImageOptim

4. **Test in Game:**
   - Save image → Refresh browser
   - Check if image loads correctly
   - Verify fallback works if image missing

5. **Create Variations (Optional):**
   - Multiple versions for visual variety
   - Random selection in TileRenderer

---

## 🔄 **TESTING YOUR IMAGES**

1. Save your image in the correct folder
2. Restart dev server (`npm run dev`)
3. Navigate to a tile of that type in-game
4. Image should load automatically
5. If not, check browser console for errors

---

## 📚 **ADDITIONAL RESOURCES**

**Current Image Loaders:**
- TileRenderer component handles all terrain images
- Automatic fallback to emoji + gradient if image missing
- Next.js Image component for optimization

**Future Enhancements:**
- Image variations (multiple per terrain type)
- Animated tiles
- Seasonal themes

---

**Questions?** Check the TileRenderer component code for exact implementation details.
