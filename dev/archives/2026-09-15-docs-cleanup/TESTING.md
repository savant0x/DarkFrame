# DarkFrame - Testing Guide

## 🧪 Backend Testing (Before Frontend)

### Step 1: Configure MongoDB
1. Open `.env.local` and replace with your MongoDB Atlas URI:
```env
MONGODB_URI=REDACTED_MONGO_URI_<username>:<password>@<cluster>.mongodb.net/darkframe?retryWrites=true&w=majority
```

### Step 2: Initialize Map
Run the map generation script:
```bash
npm run init-map
```

Expected output:
```
✅ MongoDB connection successful
✅ Map initialized with 22,500 tiles
   - Metal: 4,500 tiles
   - Energy: 4,500 tiles
   - Cave: 2,250 tiles
   - Factory: 2,250 tiles
   - Wasteland: 9,000 tiles
```

### Step 3: Start Development Server
```bash
npm run dev
```

Server should start at `http://localhost:3000`

### Step 4: Test API Endpoints

**Test Player Registration:**
```bash
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"TestCommander\"}"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "player": {
      "username": "TestCommander",
      "base": {"x": 75, "y": 120},
      "currentPosition": {"x": 75, "y": 120},
      "resources": {"metal": 0, "energy": 0}
    },
    "currentTile": {
      "x": 75,
      "y": 120,
      "terrain": "Wasteland",
      "occupiedByBase": true
    }
  }
}
```

**Test Movement:**
```bash
curl -X POST http://localhost:3000/api/move \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"TestCommander\", \"direction\": \"North\"}"
```

**Test Tile Retrieval:**
```bash
curl http://localhost:3000/api/tile?x=1&y=1
```

**Test Player Data:**
```bash
curl http://localhost:3000/api/player?username=TestCommander
```

---

## 🎮 Frontend Testing

### Step 1: Visit Registration Page
Navigate to: `http://localhost:3000/register`

1. Enter a username (3-20 characters)
2. Click "Begin Mission"
3. Should redirect to `/game` with your player spawned

### Step 2: Test Movement Controls
**Mouse Controls:**
- Click the 9-direction compass buttons

**Keyboard Controls:**
- **Q** = Northwest ↖
- **W** = North ↑
- **E** = Northeast ↗
- **A** = West ←
- **S** = Refresh ⟳
- **D** = East →
- **Z** = Southwest ↙
- **X** = South ↓
- **C** = Southeast ↘

### Step 3: Test Wrap-Around
Move to edge of map:
- At position (150, 75), press **D** (East) → Should wrap to (1, 75)
- At position (1, 75), press **A** (West) → Should wrap to (150, 75)
- Same for North/South edges

### Step 4: Test UI Panels

**Left Panel (Stats):**
- ✅ Displays username
- ✅ Shows base location
- ✅ Shows current position
- ✅ Displays Metal/Energy resources
- ✅ Logout button works

**Center Panel (Tile View):**
- ✅ Displays current tile terrain
- ✅ Shows coordinates
- ✅ Updates on movement

**Right Panel (Controls):**
- ✅ Shows current position (large)
- ✅ Displays terrain type
- ✅ Movement compass works
- ✅ Keyboard input responsive

---

## 🐛 Common Issues

### Issue: "Cannot connect to MongoDB"
**Solution:** Verify `.env.local` has correct MongoDB URI with proper credentials

### Issue: "Map not initialized"
**Solution:** Run `npm run init-map` before starting the app

### Issue: "Username already exists"
**Solution:** Use a different username or delete player from MongoDB

### Issue: TypeScript errors in IDE
**Solution:** These are false positives - the app will compile correctly. Run `npm run dev` to verify.

### Issue: Movement not working
**Solution:** 
1. Check browser console for errors
2. Verify player is logged in
3. Test with both mouse clicks and keyboard

---

## 📊 Performance Checklist

- [ ] Map loads in <2 seconds
- [ ] Movement is instant (no lag)
- [ ] Tile images display correctly
- [ ] Wrap-around calculations work at all edges
- [ ] LocalStorage persists login between refreshes
- [ ] No console errors during normal operation

---

## 🔍 Database Verification

Use MongoDB Compass or Atlas UI to verify:

**Collections Created:**
- `tiles` - Should have 22,500 documents
- `players` - One document per registered user

**Sample Tile Document:**
```json
{
  "_id": ObjectId("..."),
  "x": 75,
  "y": 120,
  "terrain": "Metal",
  "occupiedByBase": false
}
```

**Sample Player Document:**
```json
{
  "_id": ObjectId("..."),
  "username": "TestCommander",
  "base": {"x": 75, "y": 120},
  "currentPosition": {"x": 76, "y": 121},
  "resources": {"metal": 5, "energy": 3},
  "createdAt": ISODate("...")
}
```

---

## ✅ Acceptance Criteria

All features working:
- [x] Player registration with unique username
- [x] Spawn on random Wasteland tile
- [x] 9-direction movement with QWEASDZXC
- [x] Edge wrap-around (150→1)
- [x] Three-panel responsive layout
- [x] Tile-by-tile navigation (single tile view)
- [x] Persistent player state in MongoDB
- [x] LocalStorage session management
- [x] Real-time position updates
- [x] Error handling and validation

