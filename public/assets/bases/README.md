# DarkFrame Base Assets

> Directory structure for player base images that change with rank

---

## 📁 Directory Structure

This folder contains base images for different player ranks:

```
bases/
├── rank1/       - Starter base (Rank 1)
├── rank2/       - Upgraded base (Rank 2)
├── rank3/       - Advanced base (Rank 3)
├── rank4/       - Elite base (Rank 4)
├── rank5/       - Master base (Rank 5)
├── rank6/       - Legendary base (Rank 6+)
└── neutral/     - Neutral/enemy bases (optional)
```

---

## 🎨 Asset Specifications

### Image Requirements
- **Format:** PNG (with transparency for overlay effects)
- **Recommended Size:** 512×512 pixels (matches terrain tiles)
- **Naming Convention:** `base.png` in each rank folder
- **Transparency:** Recommended for blending with terrain

### Example File Structure
```
bases/
├── rank1/base.png         - Small outpost
├── rank2/base.png         - Basic fortification
├── rank3/base.png         - Reinforced bunker
├── rank4/base.png         - Military complex
├── rank5/base.png         - Advanced fortress
├── rank6/base.png         - Ultimate stronghold
```

---

## 🎯 Rank Progression System

### Suggested Rank Thresholds
| Rank | Title | Resources Needed | Description |
|------|-------|------------------|-------------|
| 1 | Outpost | 0 (starting) | Basic command post |
| 2 | Settlement | 500 Metal, 500 Energy | Reinforced walls |
| 3 | Fortress | 2000 Metal, 2000 Energy | Defensive turrets |
| 4 | Stronghold | 5000 Metal, 5000 Energy | Advanced defenses |
| 5 | Citadel | 10000 Metal, 10000 Energy | Elite fortification |
| 6+ | Empire | 25000 Metal, 25000 Energy | Ultimate base |

---

## 🔧 Implementation Notes

### Current Implementation
The system is designed to:
1. Display terrain tile as background
2. Overlay base image on top when `occupiedByBase === true`
3. Show rank-appropriate base based on player level
4. Fall back to emoji indicator if no image available

### Visual Layering
```
┌─────────────────────┐
│  Terrain (bottom)   │  ← Wasteland/Metal/Energy/etc
│    Base (overlay)   │  ← Your base building (semi-transparent PNG)
│   Indicator (top)   │  ← "🏠 BASE" badge
└─────────────────────┘
```

---

## 🎨 Asset Creation Tips

### Style Recommendations
- **Consistent perspective** - Top-down or isometric
- **Size scaling** - Bases get visually larger with rank
- **Color coding** - Distinct colors per rank (e.g., bronze→silver→gold)
- **Detail progression** - More structures/defenses at higher ranks

### Example Themes
**Rank 1:** Simple tent/outpost  
**Rank 2:** Wooden palisade walls  
**Rank 3:** Stone fortifications  
**Rank 4:** Metal reinforced bunker  
**Rank 5:** High-tech command center  
**Rank 6:** Massive military complex  

---

## 🚀 Quick Start

### Minimal Setup (Start Here)
1. Create `rank1/base.png` - Your starting base
2. Use same image for all ranks initially
3. Add higher rank images later as needed

### Full Setup (When Ready)
1. Design 6 different base images
2. Place in respective rank folders
3. System will automatically use appropriate rank

---

## 📊 Future Enhancements

### Optional Variants
```
rank1/base_day.png
rank1/base_night.png
rank1/base_damaged.png
```

### Other Players' Bases
```
neutral/enemy_rank1.png   - Other players' bases
neutral/enemy_rank2.png
neutral/ally_rank1.png    - Allied bases
```

---

## ✅ Testing Checklist

- [ ] Create rank1/base.png (starter base)
- [ ] Place in `public/assets/bases/rank1/`
- [ ] Navigate to your base in-game
- [ ] Base image should overlay on terrain
- [ ] "🏠 BASE" indicator still shows
- [ ] Add higher rank images as needed

---

**Note:** The base rendering system is already coded and ready. Just add images and they'll display automatically based on player rank!
