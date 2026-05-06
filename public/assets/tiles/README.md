# DarkFrame Tile Assets

> Directory structure for terrain tile images

---

## 📁 Directory Structure

This folder contains image assets for each terrain type in the game:

```
tiles/
├── metal/       - Metal resource tiles
├── energy/      - Energy resource tiles
├── cave/        - Cave tiles
├── factory/     - Factory building tiles
└── wasteland/   - Wasteland (empty) tiles
```

---

## 🎨 Asset Specifications

### Image Requirements
- **Format:** PNG (with transparency support) or JPG
- **Recommended Size:** 512×512 pixels (will be scaled as needed)
- **Naming Convention:** `{terrain_type}.png` or `{terrain_type}_01.png` for variants

### Terrain Types
1. **Metal** - Resource gathering tile (20% of map)
2. **Energy** - Resource gathering tile (20% of map)
3. **Cave** - Special exploration tile (10% of map)
4. **Factory** - Attackable building tile (10% of map)
5. **Wasteland** - Empty/default tile (40% of map)

---

## 📦 Example File Names

```
metal/metal.png
energy/energy.png
cave/cave.png
factory/factory.png
wasteland/wasteland.png
```

### Optional Variants
If you want multiple visual variants for a terrain type:
```
metal/metal_01.png
metal/metal_02.png
metal/metal_03.png
```

---

## 🔄 Usage in Code

The `TileRenderer` component will load images based on terrain type:

```typescript
const imagePath = `/assets/tiles/${terrain.toLowerCase()}/${terrain.toLowerCase()}.png`;
```

If an image is not found, the component will fall back to a colored placeholder div.

---

## ✅ To-Do

- [ ] Add metal tile image
- [ ] Add energy tile image
- [ ] Add cave tile image
- [ ] Add factory tile image
- [ ] Add wasteland tile image

**Upload your custom tile images to the appropriate subdirectories!**

---

**Last Updated:** 2025-10-16
