# Factory Assets - Level-Based Progression

## 🏭 Organization Structure

Each factory level has its own subdirectory:

```
factories/
├── level1/  → factory.png (Starting factory)
├── level2/  → factory.png (Upgraded)
├── level3/  → factory.png
├── level4/  → factory.png
├── level5/  → factory.png
├── level6/  → factory.png
├── level7/  → factory.png
├── level8/  → factory.png
├── level9/  → factory.png
└── level10/ → factory.png (Maximum upgrade)
```

## 🎯 Display Logic

- **Image Selection**: Based on `factoryData.level` property
- **Path Pattern**: `/assets/factories/level${factory.level}/factory.png`
- **Default Behavior**: If image fails to load, falls back to emoji icon 🏭
- **Rendering**: Overlay system (same as bases), z-index: 10

## 📋 Implementation Details

Factories spawn at **level 1** by default. Players upgrade them using resources, which increments the `factory.level` property (1-10). As the level increases, the displayed image automatically changes to match.

### Code Reference:
- **Component**: `components/TileRenderer.tsx`
- **Image Loading**: Lines 88-93 (getFactoryImagePath function)
- **Overlay Rendering**: Lines 188-197 (factory overlay layer)

## 🎨 Image Requirements

- **Format**: PNG (transparency supported)
- **Naming**: Each levelX folder must contain `factory.png`
- **Size**: Recommended 512x512px or higher
- **Quality**: High-resolution for zoom compatibility
- **Style**: Progressive visual improvement from level1 → level10

## ✅ Asset Organization Checklist

1. ✅ Created level1-10 subdirectories
2. ⏳ Place factory images (rename each to `factory.png`)
3. ⏳ Verify all 10 images load correctly
4. ⏳ Test in-game with factory upgrades

---

**Implementation Status**: ✅ Code complete, awaiting asset placement
**Integration Date**: 2025-10-17
**Related FID**: FID-20251017-023 (Mega-Feature - Asset Integration)
