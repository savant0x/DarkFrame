# Beer Base Art — Save Paths (Quick Reference)

Full design brief: `dev/art/BEER-BASE-ART-SPEC.md`. This is the where-to-put-it cheat sheet.

## Where to save the files

```
public/assets/tiles/bases/beer/
├── 1.jpg    ← levels 1–10
├── 2.jpg    ← levels 11–20
├── 3.jpg    ← levels 21–30
├── 4.jpg    ← levels 31–40
├── 5.jpg    ← levels 41–50
├── 6.jpg    ← levels 51–60
├── 7.jpg    ← levels 61–70
├── 8.jpg    ← levels 71–80
├── 9.jpg    ← levels 81–90
└── 10.jpg   ← levels 91+
```

- **Folder:** `public/assets/tiles/bases/beer/` — create it; it does not exist yet.
- **Names:** literally `1.jpg` … `10.jpg` — no prefix, no padding.
- **Level → tier mapping** (already wired in TileRenderer, `ceil(level/10)` clamped 1–10):

| Base level | Image |
|---|---|
| 1–10 | `beer/1.jpg` |
| 11–20 | `beer/2.jpg` |
| 21–30 | `beer/3.jpg` |
| … | … |
| 91+ | `beer/10.jpg` |

- **Spec per file:** 1024×1024 JPEG, ≤ 250 KB (the tile renderer scales down; bigger is wasted bytes).
- **Fallback is live:** any missing file silently falls back to the shared bot-base set (`tiles/bases/1..10.jpg`), so you can drop images in one at a time — nothing breaks mid-set.
- **After each drop:** hard-refresh (Ctrl+Shift+R) and visit a Beer Base of the matching level; the image changes with no rebuild (`public/` is served as-is in dev and prod).

Palettes/tier moods per tier are in the full spec (`dev/art/BEER-BASE-ART-SPEC.md`) if you want them while painting.
