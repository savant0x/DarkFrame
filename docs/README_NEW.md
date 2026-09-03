# 🎮 DarkFrame

> **Persistent multiplayer tile-based strategy game with territorial warfare, clan systems, and weapons of mass destruction**

[![Development Status](https://img.shields.io/badge/status-active%20development-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/typescript-5.0-blue)]()
[![Next.js](https://img.shields.io/badge/next.js-15.0-black)]()
[![MongoDB](https://img.shields.io/badge/mongodb-atlas-green)]()

---

## 📊 **Project Stats**

| Metric | Value |
|--------|-------|
| 🎯 Features Complete | 64 major features |
| ⚡ Development Time | 7 days (~95 hours) |
| 💻 Lines of Code | ~45,000+ |
| 📁 Total Files | 150+ files |
| 🐛 TypeScript Errors | 0 |
| 🏗️ Phases Complete | 13/13 + VIP + WMD Foundation |

**Current Phase:** WMD Phase 1 Complete - Ready for API integration 🚀

---

## 🎯 **What is DarkFrame?**

DarkFrame is a **persistent online strategy game** where players compete for dominance on a **150×150 tile-based world** (22,500 tiles). Build your empire, gather resources, form powerful clans, wage wars, and develop weapons of mass destruction in an ever-evolving multiplayer environment.

### **Key Features**

#### 🗺️ **Persistent World**
- **150×150 static tile grid** with 5 terrain types
- **Edge wrap-around** for seamless navigation
- **22,500 unique tiles** with strategic distributions
- **9-direction movement** (QWEASDZXC, Numpad, Arrows)

#### ⚔️ **Combat & Conquest**
- **Factory capture mechanics** with power calculations
- **40 unit types** (20 STR + 20 DEF across 5 tiers)
- **PVP battles** with detailed combat logs
- **Territory control** through factory ownership
- **Clan warfare** with raids and diplomacy

#### 🏭 **Resource Management**
- **Two primary resources:** Metal & Energy
- **Harvesting system** with 12-hour reset cycles
- **Cave exploration** with rare item drops
- **Factory slots** (upgradeable 10K → 120K)
- **Slot regeneration** (1,000 → 6,000/hour)

#### 🚀 **Progression Systems**
- **Level system** with XP from all actions
- **3 specialization trees:** Combat, Economy, Exploration
- **5 tiers per specialization** with unique unlocks
- **50+ discoverable achievements**
- **Mastery tracking** across specializations

#### 🏰 **Clan Systems**
- **Clan creation & management** with roles
- **Territory control** across entire map
- **Clan leveling** with progressive buffs
- **Democratic voting** for major decisions
- **Shared treasury** with member funding
- **War mechanics** with declaration and resolution

#### 💰 **Economy & Trading**
- **Banking system** at 4 fixed locations
- **Resource exchange** (Metal ↔ Energy)
- **Auction house** with 24-48 hour bidding
- **Automated auction resolution**
- **Transaction history** and bid tracking

#### 🤖 **Automation**
- **3-tier auto-farm system** (Basic/Advanced/Elite)
- **Resource collection scheduling**
- **Factory scanning & targeting**
- **Bot summoning mechanics**
- **Background job processing**

#### 👑 **VIP System** (Monetization)
- **5 VIP tiers** with progressive benefits
- **Duration packages** (7/30/90 days)
- **Clan-funded purchases** via treasury
- **Exclusive features & bonuses**

#### ☢️ **WMD System** (Endgame Content) 🆕
- **Research tech tree** (30 techs, 3 tracks, 2.7M RP)
- **Missile system** (5 warhead types, assembly mechanics)
- **Defense batteries** (5 tiers, interception system)
- **Intelligence operations** (10 spy mission types)
- **Clan democratic voting** for launches
- **Global consequences** and retaliation mechanics

---

## 🚀 **Quick Start**

### Prerequisites
- **Node.js** 18+ installed
- **MongoDB Atlas** account (or local instance)
- **npm** package manager

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/fame0528/DarkFrame.git
   cd DarkFrame
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   - Copy `.env.example` to `.env.local`
   - Add your MongoDB connection string:
     ```
     MONGODB_URI=REDACTED_MONGO_URI_username:password@cluster.mongodb.net/
     MONGODB_DB=darkframe
     JWT_SECRET=your-secret-key-here
     ```

4. **Initialize the game map:**
   ```bash
   npx tsx scripts/initializeMap.ts
   ```
   
   Creates 22,500 tiles with exact terrain distribution. Safe to run multiple times (idempotent).

5. **Start development server:**
   ```bash
   npm run dev
   ```

6. **Open in browser:**
   ```
   http://localhost:3000
   ```

7. **Register & Play:**
   - Create an account at `/register`
   - Spawn on a random Wasteland tile
   - Start exploring with QWEASDZXC controls

---

## 🎮 **Gameplay Overview**

### Starting Out
1. **Register** - Create account and spawn on map
2. **Explore** - Navigate using QWEASDZXC keyboard controls
3. **Gather** - Harvest Metal and Energy from resource tiles
4. **Build** - Produce SOLDIER units at factories
5. **Conquer** - Attack and capture enemy factories

### Mid Game
1. **Specialize** - Choose Combat, Economy, or Exploration path
2. **Trade** - Use auction house to buy/sell items
3. **Banking** - Store resources safely at bank locations
4. **Automate** - Purchase auto-farm for passive income
5. **Clan Up** - Join or create a clan for territory control

### End Game
1. **Research** - Unlock WMD technologies (30 techs)
2. **Build WMDs** - Assemble missiles with components
3. **Defend** - Deploy defense batteries against attacks
4. **Spy** - Run intelligence operations on enemies
5. **Dominate** - Vote on clan missile launches for supremacy

---

## 📊 **Terrain Distribution**

| Terrain | Count | % | Purpose |
|---------|-------|---|---------|
| 🏜️ **Wasteland** | 9,000 | 40% | Empty tiles, spawn locations |
| ⚙️ **Metal** | 4,500 | 20% | Primary resource harvesting |
| ⚡ **Energy** | 4,500 | 20% | Secondary resource harvesting |
| 🕳️ **Cave** | 2,250 | 10% | Item drops, digger bonuses |
| 🏭 **Factory** | 2,250 | 10% | Unit production, conquest targets |

**Total:** 22,500 tiles in 150×150 grid

---

## 🎯 **Movement Controls**

### QWEASDZXC Layout (Primary)
```
Q  W  E     [NW] [N]  [NE]
A  S  D  =  [W]  [⟳]  [E]
Z  X  C     [SW] [S]  [SE]
```

### Also Supported
- **Numpad:** 7,8,9,4,5,6,1,2,3
- **Arrow Keys:** ↑↓←→ + diagonals

**Edge Wrap:** Moving beyond map edge wraps to opposite side (151 → 1)

---

## 🏗️ **Technology Stack**

### Frontend
- **Framework:** Next.js 15.0.2 (App Router)
- **Language:** TypeScript 5 (strict mode)
- **UI:** React 18.3.1 + Tailwind CSS 3.4.1
- **State:** React Context API
- **Authentication:** JWT with jose library

### Backend
- **Runtime:** Node.js + Edge Runtime (middleware)
- **API:** Next.js API Routes (60+ endpoints)
- **Database:** MongoDB Atlas (14+ collections)
- **Driver:** MongoDB Node.js Driver 6.10.0
- **Auth:** JWT + bcrypt password hashing

### Development
- **Standards:** ECHO v5.1 (Anti-Drift Expert Coder)
- **Type Safety:** 0 TypeScript errors maintained
- **Documentation:** JSDoc on all public functions
- **Version Control:** Git + GitHub
- **Tracking:** /dev folder ecosystem

---

## 📂 **Project Structure**

```
darkframe/
├── app/                    # Next.js App Router pages
│   ├── api/               # API route handlers (60+ endpoints)
│   ├── game/              # Main game interface
│   ├── clan/              # Clan management
│   ├── wmd/               # WMD system interface
│   ├── admin/             # Admin panel
│   └── ...                # Other pages
├── components/            # React components (50+)
├── lib/                   # Business logic & services
│   ├── db/               # Database schemas
│   ├── services/         # Game logic services
│   ├── wmd/              # WMD system services
│   └── ...
├── types/                 # TypeScript type definitions
├── utils/                 # Utility functions
├── dev/                   # Development tracking
│   ├── roadmap.md        # Project vision
│   ├── architecture.md   # Technical decisions
│   ├── planned.md        # Future features
│   ├── progress.md       # Active work
│   ├── completed.md      # Done features
│   └── metrics.md        # Performance analytics
└── scripts/              # Utility scripts
```

---

## 📚 **Documentation**

- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Complete development log and metrics
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Technical architecture deep dive
- **[ROADMAP.md](ROADMAP.md)** - Feature roadmap and vision
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and releases
- **[/dev folder](dev/)** - Real-time development tracking

---

## 🎯 **Current Status**

### ✅ Complete Systems
- Core game mechanics (navigation, resources, combat)
- Factory system with 40 unit types
- Level & specialization progression
- Clan management & territory control
- Auction house & trading
- Auto-farm automation (3 tiers)
- VIP system (5 tiers)
- WMD Phase 1 foundation (types, schemas, services)

### 🔄 In Progress
- WMD Phase 2: API Routes & Database Integration
- WMD Phase 3: Frontend Integration

### 📋 Planned
- Payment integration (Stripe)
- Production deployment
- WebSocket real-time updates
- Advanced analytics & monitoring

---

## 🏆 **Development Highlights**

### Velocity Metrics
- **9.1 features/day** average velocity
- **1.48 hours** average feature completion time
- **3-5x faster** than initial estimates
- **0 TypeScript errors** maintained throughout
- **~45,000 lines** of production code in 7 days

### Notable Achievements
- **Complete game** from concept to playable in 1 week
- **64 major features** implemented across 13 phases
- **Zero technical debt** with ECHO v5.1 standards
- **Comprehensive WMD system** (8,779 lines) in single session
- **Exceptional code quality** (JSDoc, type safety, modularity)

---

## 🤝 **Contributing**

This is currently a personal project, but feel free to:
- **Report bugs** via GitHub Issues
- **Suggest features** via Discussions
- **Fork & experiment** with your own version

---

## 📄 **License**

[Add your license here - MIT, Apache, etc.]

---

## 📞 **Contact**

- **GitHub:** [@fame0528](https://github.com/fame0528)
- **Repository:** [DarkFrame](https://github.com/fame0528/DarkFrame)
- **Issues:** [Report bugs](https://github.com/fame0528/DarkFrame/issues)

---

## 🎮 **Play Now**

**Coming Soon** - Production deployment in progress

For now, clone and run locally (see Quick Start above)

---

**Built with ❤️ using ECHO v5.1 development standards**  
**From concept to playable game in 7 days** 🚀

---

*Last Updated: October 23, 2025*
