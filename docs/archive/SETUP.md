# 🚀 DarkFrame - Quick Setup Guide

## Option 1: Automated Setup (Recommended)

Run the PowerShell setup script:
```powershell
.\setup.ps1
```

This script will:
1. Check your MongoDB configuration
2. Initialize the 150×150 map
3. Start the development server
4. Open the game at http://localhost:3000

---

## Option 2: Manual Setup

### Step 1: Get MongoDB URI

**MongoDB Atlas (FREE - Recommended):**
1. Go to: https://www.mongodb.com/cloud/atlas/register
2. Create free account (M0 tier - no credit card needed)
3. Create new cluster (takes 3-5 minutes)
4. Click "Connect" → "Connect your application"
5. Copy connection string (Node.js driver, version 4.1+)
6. Replace `<password>` with your database password

**Example URI:**
```
REDACTED_MONGO_URI_username:YourPassword123@cluster0.xxxxx.mongodb.net/darkframe?retryWrites=true&w=majority
```

**OR Local MongoDB:**
```
mongodb://localhost:27017/darkframe
```

### Step 2: Configure Environment

Edit `.env.local` and add your MongoDB URI:
```env
MONGODB_URI=REDACTED_MONGO_URI_username:password@cluster.xxxxx.mongodb.net/darkframe

# Redis (Optional - recommended for production)
# Development: Leave unset or use local Redis
REDIS_URL=redis://localhost:6379

# Production: Use TLS connection
# REDIS_URL=rediss://username:password@host:port

# Upstash Redis (serverless - easiest for production)
# UPSTASH_REDIS_REST_URL=https://your-endpoint.upstash.io
# UPSTASH_REDIS_REST_TOKEN=your-token-here
```

**Redis Setup (Optional):**
- **Development:** App works without Redis (uses in-memory fallback)
- **Production:** Recommended for rate limiting persistence
- **Quick Start:** Sign up at https://upstash.com (free tier) for serverless Redis
- **Local:** Install Redis from https://github.com/microsoftarchive/redis/releases

### Step 3: Initialize Map

```bash
npm run init-map
```

Expected output:
```
✅ Connected to MongoDB successfully
✅ Map initialized: 22,500 tiles created
   - Metal: 4,500 tiles (20%)
   - Energy: 4,500 tiles (20%)
   - Cave: 2,250 tiles (10%)
   - Factory: 2,250 tiles (10%)
   - Wasteland: 9,000 tiles (40%)
```

### Step 4: Start Server

```bash
npm run dev
```

Visit: **http://localhost:3000/register**

---

## 🎮 First Time Playing

1. **Register**: Enter username (3-20 characters)
2. **Spawn**: You'll appear on a random Wasteland tile
3. **Move**: Use QWEASDZXC keys or click compass buttons
4. **Explore**: Navigate the 150×150 persistent world

---

## 🐛 Troubleshooting

### "tsx not found"
```bash
npm install --save-dev tsx
```

### "Cannot connect to MongoDB"
- Check `.env.local` has correct URI
- Verify MongoDB Atlas cluster is running
- Check firewall allows MongoDB connection
- Ensure password has no special characters (use letters/numbers)

### "Map already initialized"
This is normal! The map only needs to be created once. You can safely re-run `npm run init-map` - it will skip existing tiles.

### Port 3000 already in use
```bash
# Kill existing process or use different port
npm run dev -- -p 3001
```

### TypeScript errors in IDE
These are false positives. The app compiles and runs correctly. You can ignore them or restart your IDE.

---

## 📊 Verify Setup

After running `npm run init-map`, you can verify in MongoDB:

**Collections:**
- `tiles` - Should have 22,500 documents
- `players` - Will populate as users register

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

---

## ✅ You're Ready!

Once the dev server is running, visit:
- **http://localhost:3000** - Auto-redirects to registration
- **http://localhost:3000/register** - Create your commander
- **http://localhost:3000/game** - Play (after registration)

Movement keys: **Q W E A S D Z X C**

Have fun exploring DarkFrame! 🎮
