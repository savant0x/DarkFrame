# DarkFrame — Design Reference Guide

> Complete design system documentation. Read this before writing any UI code.

---

## 🎨 Color Palette: NEON SYNTH

### Core Colors (9 total)

| Token | Hex | CSS Variable | Usage |
|-------|-----|-------------|-------|
| Void Indigo | `#02010A` | `--void` | Page background |
| Arcane Shadow | `#0E0E1A` | `--shadow` | Card/panel backgrounds (updated from old #1E1E2E) |
| System White | `#FFFFFF` | `--white` | Primary text |
| Electric Blue | `#007FFF` | `--electric` | Active states, links, coordinates |
| Neon Pink | `#FF1493` | `--neon-pink` | Critical alerts, special |
| Neon Red | `#F73718` | `--neon-red` | Danger, combat, damage |
| Solar Orange | `#FF4E00` | `--solar` | Warnings, flag urgency |
| Synth Green | `#00FF00` | `--synth` | Success, resources, active |
| Neon Yellow | `#F2FF00` | `--neon-yellow` | VIP, power, intermediate |

### Text Hierarchy (White Opacity Scale ONLY)

```css
/* Primary text - names, values, key data */
.text-white { color: #FFFFFF; }

/* Secondary text - labels, descriptions */
.text-white\/60 { color: rgba(255,255,255,0.60); }

/* Tertiary text - hints, timestamps */
.text-white\/40 { color: rgba(255,255,255,0.40); }

/* Faint text - placeholders, disabled */
.text-white\/25 { color: rgba(255,255,255,0.25); }
```

**NEVER use `text-gray-*` for body/label text.** Only semantic colors from the palette.

---

## 📦 Card Chrome

All cards/panels follow this exact pattern:

```css
/* Card shell */
.card {
  background: var(--shadow);          /* #0E0E1A */
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  overflow: hidden;
}

/* Card header with gradient accent */
.card-header {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Card body */
.card-body {
  padding: 10px;
}
```

### Header Gradient Accent Colors

| Section | Gradient Class |
|---------|---------------|
| Player Info | `bg-gradient-to-r from-[--electric]/8 to-transparent` |
| Experience | `bg-gradient-to-r from-[--solar]/8 to-transparent` |
| Resources | `bg-gradient-to-r from-[--synth]/8 to-transparent` |
| Military Power | `bg-gradient-to-r from-[--neon-red]/8 to-transparent` |
| Clan | `bg-gradient-to-r from-[--neon-pink]/8 to-transparent` |
| Shrine Buffs | `bg-gradient-to-r from-[--neon-yellow]/8 to-transparent` |
| Actions | `bg-gradient-to-r from-white/[0.03] to-transparent` |

---

## 📊 Table Pattern

```css
/* Table */
.data-table {
  width: 100%;
  font-size: 12px;
  border-collapse: collapse;
}

/* Alternating rows */
.data-table tr:nth-child(even) { background: rgba(255,255,255,0.02); }
.data-table tr:nth-child(odd) { background: rgba(255,255,255,0.04); }

/* Cells */
.data-table td {
  padding: 4px 8px;
}

/* Label cell */
.data-table .label { color: rgba(255,255,255,0.60); }

/* Value cell */
.data-table .value {
  color: #FFFFFF;
  font-weight: 600;
  text-align: right;
}

/* Dim value */
.data-table .dim { color: rgba(255,255,255,0.40); }
```

---

## 🔘 Button System

### Base Button
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.03);
  color: var(--text-1);
  transition: all 150ms ease;
  cursor: pointer;
}

.btn:hover {
  background: rgba(255,255,255,0.08);
}

.btn:active {
  transform: scale(0.97);
}

.btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
```

### Button Variants

| Variant | Background | Border | Text Color |
|---------|-----------|--------|------------|
| `btn-primary` | `bg-[--electric]/15` | `border-[--electric]/25` | `text-[--electric]` |
| `btn-danger` | `bg-[--neon-red]/10` | `border-[--neon-red]/20` | `text-[--neon-red]` |
| `btn-success` | `bg-[--synth]/10` | `border-[--synth]/20` | `text-[--synth]` |
| `btn-warning` | `bg-[--solar]/10` | `border-[--solar]/20` | `text-[--solar]` |
| `btn-ghost` | `bg-white/[0.03]` | `border-white/10` | `text-white/60` |

---

## ✨ Glow System

### Box Shadow Glows (NEVER text-shadow)

```css
/* Subtle - inactive cards, subtle borders */
.glow-subtle { box-shadow: 0 0 8px rgba(0,0,0,0.3); }

/* Standard - active cards, hover states */
.glow-electric { box-shadow: 0 0 8px rgba(0,127,255,0.15); }
.glow-synth { box-shadow: 0 0 8px rgba(0,255,0,0.15); }
.glow-pink { box-shadow: 0 0 8px rgba(255,20,147,0.15); }
.glow-red { box-shadow: 0 0 8px rgba(247,55,24,0.15); }
.glow-solar { box-shadow: 0 0 8px rgba(255,78,0,0.15); }
.glow-yellow { box-shadow: 0 0 8px rgba(242,255,0,0.1); }

/* Standard - buttons, interactive elements */
.glow-btn-electric { box-shadow: 0 0 12px rgba(0,127,255,0.25); }
.glow-btn-synth { box-shadow: 0 0 12px rgba(0,255,0,0.25); }
.glow-btn-pink { box-shadow: 0 0 12px rgba(255,20,147,0.25); }
.glow-btn-red { box-shadow: 0 0 12px rgba(247,55,24,0.25); }
```

**RULES:**
- NEVER use `text-shadow` or `drop-shadow-*` for glow effects
- NEVER use glow spread larger than 16px
- NEVER use `backdrop-blur-*` anywhere
- Always match glow color to semantic meaning

---

## 📏 Font Size Scale (5 steps ONLY)

| Class | Size | Usage |
|-------|------|-------|
| `text-xs` | 12px | Body, table cells, descriptions |
| `text-sm` | 14px | Values, section headers (bold) |
| `text-base` | 16px | Inline emoji, key numbers |
| `text-lg` | 18px | Coordinates, major values |
| `text-xl` | 20px | Page titles only |

**NEVER use `text-2xl` or larger except page titles.**
**NEVER use arbitrary sizes like `text-[10px]` or `text-[11px]`.**

---

## 📐 Spacing Scale

| Context | Padding | Gap |
|---------|---------|-----|
| Card header | `px-3 py-2` | `gap-1.5` (icon + text) |
| Card body | `p-2.5` | `gap-1` to `gap-2` (between rows) |
| Table cells | `px-2 py-1` | — |
| Buttons | `px-3 py-1.5` | `gap-1.5` (icon + text) |
| Sidebar wrapper | `p-2` | `gap-y-2` (between cards) |

**No random padding like `p-4`, `p-6`, `px-5`.**

---

## 🎯 Emoji Sizing

| Context | Class |
|---------|-------|
| Inline with text | `text-base` (16px) |
| Section header icon | `w-3.5 h-3.5` (matches font) |
| Status badge | `text-lg` (18px) |
| Feature/card icon | `text-xl` (20px) |

**NEVER use `text-3xl`, `text-4xl`, `text-6xl`, or arbitrary emoji sizes.**

---

## 🌑 Background Treatment

### Page Background
```css
body {
  background: var(--void);  /* #02010A */
}
```

### Starfield Effect (CSS only)
```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background: radial-gradient(ellipse at 20% 0%, rgba(0,127,255,0.04) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 100%, rgba(255,20,147,0.02) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}
```

### Card Backgrounds
```css
/* Standard card */
.card { background: var(--shadow); }  /* #0E0E1A */

/* Nested/subdued sections */
.card-subtle { background: rgba(255,255,255,0.03); }
.card-alt { background: rgba(255,255,255,0.02); }
```

---

## 🖼️ Scrollbar

```css
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: var(--shadow); }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
```

---

## 🎨 Terrain Colors (Tile Center View)

| Terrain | Background Class |
|---------|-----------------|
| Metal | `bg-gradient-to-br from-[--electric]/20 to-[--electric]/5` |
| Energy | `bg-gradient-to-br from-[--neon-yellow]/20 to-[--neon-yellow]/5` |
| Cave | `bg-gradient-to-br from-[--neon-pink]/20 to-[--neon-pink]/5` |
| Forest | `bg-gradient-to-br from-[--synth]/20 to-[--synth]/5` |
| Factory | `bg-gradient-to-br from-[--solar]/20 to-[--solar]/5` |
| Wasteland | `bg-gradient-to-br from-amber-900/30 to-yellow-800/20` |
| Bank | `bg-gradient-to-br from-[--neon-yellow]/15 to-[--neon-yellow]/5` |
| Shrine | `bg-gradient-to-br from-[--neon-pink]/15 to-[--neon-pink]/5` |
| Auction House | `bg-gradient-to-br from-[--electric]/15 to-[--electric]/5` |

---

## 📋 Design Checklist

Before any component passes review:
- [ ] Uses `bg-[--shadow]` for cards, `bg-black` for sides/main bg
- [ ] Borders use `border border-white/[0.06]` (not white/10 or white/5)
- [ ] Text hierarchy: white → white/60 → white/40 → white/25
- [ ] Font sizes: xs(12) → sm(14) → base(16) → lg(18) → xl(20) only
- [ ] No `text-gray-*` for body/label text
- [ ] No `text-shadow`, `drop-shadow-*`, `backdrop-blur-*`
- [ ] Glow shadows use semantic colors from palette
- [ ] Tables use alternating row colors (white/[0.02] / white/[0.04])
- [ ] Buttons use solid backgrounds or white/[0.03] with hover white/[0.08]
- [ ] Emoji sized appropriately (not larger than text-xl)
- [ ] Padding uses standard scale (p-2, p-2.5, p-3)
- [ ] No arbitrary CSS values