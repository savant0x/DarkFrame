# 🎨 Quick Image Guide - DarkFrame

## ⚡ **3-STEP PROCESS**

1. **Drop image** in terrain folder
2. **Any name, any format** (.png, .jpg, .gif, .webp)
3. **Refresh page** - Done!

---

## 📁 **FOLDER MAP**

```
public/assets/tiles/
├── auction/     → Auction houses
├── banks/       → Banks (metal/energy/exchange)
├── cave/        → Cave tiles
├── energy/      → Energy resources
├── factory/     → Factory buildings
├── forest/      → Forest tiles
├── metal/       → Metal resources
├── shrine/      → Ancient shrines
└── wasteland/   → Wasteland tiles
```

---

## 🎯 **BANK DETECTION**

Filename contains...
- `metal` → Metal Bank
- `energy` → Energy Bank  
- `exchange` → Exchange Bank

**Examples:**
- `metal-bank.jpg` ✅
- `energy_bank.png` ✅
- `exchange-bank-1.jpg` ✅
- `my-cool-bank.jpg` ✅ (generic, works for all)

---

## ✨ **MULTIPLE VARIATIONS**

Drop 3 images in `forest/`:
- `forest-1.png`
- `forest-2.jpg`
- `forest-3.gif`

**Result:** Each forest tile shows one randomly!

---

## 📍 **TEST LOCATIONS**

- **Metal Bank:** Move to (25, 25)
- **Energy Bank:** Move to (75, 75)
- **Exchange Bank:** Move to (50, 50)
- **Auction:** Check auction tiles

---

## 🚀 **YOUR IMAGES**

Currently detected:
✅ `banks/energy-bank.jpg`
✅ `banks/metal-bank.jpg`
✅ `banks/exchange_bank.jpg`
✅ `auction/auction.jpg`

**All working!** Just refresh and test.

---

**Server:** http://localhost:3000
