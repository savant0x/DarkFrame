# DarkFrame — Issues & Technical Debt

> Bugs, blockers, and technical debt tracking.

**Last Updated:** 2026-05-07
**Active Issues:** 0 (all fixed this session)
**Resolved This Session:** 15+ bugs

---

## ✅ Resolved (2026-05-07)

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | BountyBoardPanel.tsx | `bountyData.stats` undefined crash | Added null-safety check |
| 2 | AchievementPanel.tsx | `requirement.value` undefined crash | Added optional chaining |
| 3 | BeerBasePanel.tsx | `base.resources` undefined crash | Added optional chaining |
| 4 | StatsPanel.tsx | XP section disappeared on move | Always show with loading state |
| 5 | TileRenderer.tsx | Harvest results duplicated | Consolidated into single display |
| 6 | TileRenderer.tsx | `factoryData.usedSlots` showed 0/5000 | Display available (total - used) instead |
| 7 | ControlsPanel.tsx | Gap above Position section | Removed `pt-14` gap, `space-y-2 p-2` |
| 8 | FlagTrackerPanel.tsx | `border-2` harsh stroke | Removed, use card chrome |
| 9 | FlagBearerPanel.tsx | White stroke on Release button | Use subtle `bg-white/[0.04]` hover |
| 10 | AutoFarmPanel.tsx | Inconsistent design | Table layout, muted colors |
| 11 | BalanceIndicator.tsx | Harsh colors | Muted bar, proper text hierarchy |
| 12 | GameLayout.tsx | Sidebars not foldable | Added toggle buttons with transform |
| 13 | ChatPanel.tsx | Old cyan/slate palette | Rebuilt with synth palette (out of scope) |
| 14 | Global | `bg-[--shadow]` inconsistent | Replaced with `bg-[--card]` everywhere |
| 15 | Global | `text-gray-*` for body text | Replaced with white opacity scale |

---

## ⚠️ Known Limitations (Not Bugs)

- Other pages still use old design system — needs future TileRenderer pass
- DB data is stale from pre-balance era — needs wipe and re-seed before launch
- `text-gray-*` may still appear in admin pages (lower priority)

---

## 🔧 Technical Debt

- Replace polling with WebSocket for real-time updates (planned)
- Add rate limiting on all API endpoints (planned)
- Implement automated testing (planned)
- Add APM monitoring for production (planned)
