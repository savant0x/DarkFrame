# DarkFrame — Design System Reference

> Complete visual design specification. Read before writing any UI code.

---

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--void` | `#03030F` | Universe bg |
| `--shadow` | `#0A0A1A` | Card bg (was `#1E1E2E`) |
| `--surface` | `#12122A` | Alternating rows, nested cards |
| `--border` | `rgba(255,255,255,0.08)` | Default border |
| `--border-hover` | `rgba(255,255,255,0.15)` | Hover border |
| `--text-1` | `#FFFFFF` | Primary text |
| `--text-2` | `rgba(255,255,255,0.60)` | Labels, descriptions |
| `--text-3` | `rgba(255,255,255,0.35)` | Hints, timestamps |
| `--accent` | `#00E5FF` | Links, active, focus (was electric blue) |
| `--danger` | `#FF3B30` | Errors, delete (was neon red) |
| `--success` | `#00FF88` | Success (was synth green) |
| `--warning` | `#FFD600` | VIP (was neon yellow) |
| `--muted` | `#5A5A7A` | Disabled |

---

## Typography

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| H1 (page title) | 18px/1.25rem | bold (700) | `--text-1` |
| H2 (panel title) | 15px/1.2rem | bold (700) | `--text-1` |
| H3 (section) | 13px | semibold (600) | `--text-1` |
| Body/Copy | 12px/normal | regular (400) | `--text-1` |
| Caption/Label | 10px | regular (400) | `--text-2` |
| Micro/Timestamp | 9px | regular (400) | `--text-3` |

Headers: `font-family: 'Orbitron', system-ui` (PAGE TITLES ONLY)
Body: `font-family: system-ui, -apple-system, sans-serif`

Emoji: `text-base` (16px), `leading-none`

---

## Spacing

```css
--space-2: 2px;
--space-4: 4px;
--space-8: 8px;
--space-12: 12px;
--space-16: 16px;
```

| Context | Value |
|---------|-------|
| Between sections | `space-y-2` (8px) |
| Card internal | `p-3` (12px) |
| Tight rows | `py-1` (4px) |
| Between panels | `space-y-3` (12px) |

---

## Card System

```html
<!-- Default Card -->
<div class="border border-[--border] rounded-lg bg-[--shadow]">

  <!-- w/ Header -->
  <div class="px-3 py-2 border-b border-[--border] bg-white/[0.02]">
    <h3 class="text-[13px] font-semibold tracking-tight">Title</h3>
  </div>

  <!-- w/ Body -->
  <div class="p-3">

    <!-- Inner Section Example -->
    <div class="border border-[--border] rounded p-2 bg-[--surface]">
      ...
    </div>

  </div>

</div>
```

### Alternating Table Rows

Odd: `bg-[--surface]`
Even: `bg-white/[0.01]`

### Hover + Active States

Interactive: `hover:bg-white/[0.04] hover:border-[--border-hover]`
Active/Selected: `bg-[--accent]/10 border-[--accent]/30`
Refresh: `bg-[--success]/10 border-[--success]/30`
Disabled: `opacity-30 cursor-not-allowed`

---

## Buttons

```html
<!-- Standard -->
<button class="btn-sm bg-white/5 hover:bg-white/10 text-white/80 border border-white/10">

<!-- Primary -->
<button class="btn-sm bg-[--accent]/80 hover:bg-[--accent] text-black font-semibold shadow-[0_0_12px_var(--accent-sm)]">

<!-- Success -->
<button class="btn-sm bg-[--success]/20 hover:bg-[--success]/30 text-[--success] border border-[--success]/30">

<!-- Ghost -->
<button class="btn-sm bg-transparent hover:bg-white/5 text-white/60">

<!-- Danger -->
<button class="btn-sm bg-transparent hover:bg-white/5 text-danger/70">

<!-- Icon -->
<button class="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10">
```

Sizes: `btn-sm` (h-8, text-xs), `btn-md` (h-9, text-[13px])

---

## Glow Shadows

```css
--accent-sm: 0 0 8px rgba(0,229,255,0.15);
--accent-md: 0 0 12px rgba(0,229,255,0.25);
--glow-pink-sm: 0 0 8px rgba(255,105,180,0.15);
```

Use sparingly — glow on hover states, not at rest. NEVER use text-shadow.

---

## Input Fields

```html
<input class="form-input">

<!-- .form-input equivalent: -->
<input class="w-full px-2 py-1 rounded-md text-xs bg-transparent text-[--text-1]
  border border-[--border] focus:border-[--accent]/50 focus:shadow-[0_0_8px_rgba(0,229,255,0.15)]
  outline-none placeholder:text-[--text-3] transition-all">
```

---

## Panels (Floating)

```html
<!-- Chat / Friends - FIXED POSITION -->
<div class="fixed bottom-4 left-4 z-40 max-w-sm w-[calc(100vw-2rem)]">
  <div class="border border-[--border] bg-[--shadow] rounded-lg overflow-hidden">
    <div class="px-3 py-2 border-b border-[--border]">
      <h4 class="text-[13px] font-bold font-orbitron">TITLE</h4>
    </div>
  </div>
</div>
```

---

## Status Dot

```html
<span class="inline-block w-1.5 h-1.5 rounded-full bg-[--success]"></span> Active
<span class="inline-block w-1.5 h-1.5 rounded-full bg-[--warning]"></span> Paused
<span class="inline-block w-1.5 h-1.5 rounded-full bg-white/20"></span> Stopped
```

---

## Progress Bar

```html
<div class="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
  <div class="h-full bg-[--accent] rounded-full transition-all duration-300"
       style="width: 45%"></div>
</div>
```

Slim: `h-1`, default: `h-1.5`, chunky: `h-2`

---

## Key Rules

1. NO `text-shadow`, NO `drop-shadow`
2. NO `backdrop-blur-*` anywhere
3. All colors from palette — NO hex learning in components — use semantic tokens
4. All text is white/opacity — `text-white`, `text-white/80`, `text-white/60`, `text-white/40`
5. Radii: `rounded-lg` (cards), `rounded-md` (buttons/inputs), `rounded-full` (dots)
6. Font sizes: 10px, 12px, 13px, 15px, 18px ONLY
7. Emoji: `text-base` (16px) max
8. Glow only on hover/active, never at rest
9. All cards: `bg-[--shadow] border border-white/[0.06] rounded-lg overflow-hidden`
10. All tables: alternating rows with `bg-[--surface]` and `bg-white/[0.01]`
