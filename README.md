<div align="center">

# ⛏️ TEECRAFT v3.0

### *A Next-Generation 3D WebGL Voxel Engine & Minecraft Experience built with Three.js, Simplex Noise, & Supabase Realtime Cloud.*

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftee-uwu%2FTeeCraft)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Three.js](https://img.shields.io/badge/Three.js-r160-black?logo=three.js)
![Supabase](https://img.shields.io/badge/Supabase-Realtime_Cloud-green?logo=supabase)
![WebGL](https://img.shields.io/badge/WebGL-60_FPS-orange?logo=webgl)

<br/>

</div>

---

## 🌟 Key Features

### 🏰 Massive Structures & Schematic Landmarks
- **Pre-Built Small Castle & Big Farm Hub**: Instantly loaded asynchronously from `schematicsData.json` (330,000+ blocks).
- **Navigation Waypoints**: Floating 3D waypoints marking `📍 Small Castle`, `📍 Hub & Big Farm`, and `📍 Death Marker`.

### 🔐 Mandatory Accounts & Cloud Auto-Sync
- **Supabase Authentication**: Integrated Email/Password + Google OAuth 🌐 login directly on the title screen.
- **Cloud Auto-Resume**: Automatically saves world seed, coordinates, inventory, health/hunger, chest items, daytime, and modified blocks to Supabase Cloud & LocalStorage.
- **Cross-Device Continuation**: Log in on any device to resume your world right where you left off.

### 🌐 Realtime 3D Multiplayer
- **Supabase Realtime Broadcast & Presence**: Live player position, rotation, and held item synchronization.
- **3D Steve Avatars**: Interactive 3D player models with floating 3D nametag canvas sprites rendered over remote players' heads.
- **Live Block Synchronization**: Realtime block mining & placement updates across all connected players worldwide.

### ⛏️ 3D First-Person Arm & Mining Animations
- **First-Person Tool Rig**: Renders 3D swords, pickaxes, axes, shovels, and block items held in hand.
- **Mining Chop Swing**: Smooth procedural arm swing animation triggered on mining, attacking, and block interaction.

### 🌊 3D Pitch Swimming & Environmental Physics
- **3D Water Navigation**: Pitch-steering swimming physics through ocean biomes.
- **Underwater Visual FX**: Dynamic underwater camera fog, blue screen tint, and realistic water level bobbing.

### ⚡ 60 FPS Performance Optimization Engine
- **Time-Budgeted Chunk Queue**: Streams max 2 chunks per frame to eliminate frame drops and maintain locked 60 FPS.
- **Distance Disposal**: Automatic WebGL buffer garbage collection for chunks outside render distance.
- **High-DPI Scaling**: Pixel ratio capping to prevent 4K fill-rate bottlenecks.

---

## 🎮 Controls

| Key | Action |
| :--- | :--- |
| **W / A / S / D** | Move Forward / Left / Backward / Right |
| **Space** | Jump / Swim Upward |
| **Shift** | Sneak / Swim Downward |
| **Left-Click** | Mine Block / Attack Mob |
| **Right-Click** | Place Block / Interact / Use Item |
| **1 - 9** | Hotbar Slot Selection |
| **E** | Open / Close Inventory & Crafting |
| **B** | Waypoint Navigation Menu |
| **F** | Eat Food |
| **F3** | Toggle Debug Overlay |
| **Esc / P** | Pause Game / Open Settings |

---

## 🛠️ Architecture & Module Structure

```text
TEEcraft/
├── index.html            # Main HTML UI, Google Fonts, & Supabase SDK CDN
├── style.css             # 3D Minecraft Voxel design system & glassmorphism
├── main.js               # Core game loop, scene initialization, & event listeners
├── world.js              # Chunk manager, terrain generation, & mesh builder
├── chunk.js              # Block data storage & 3D buffer geometry builder
├── player.js             # Physics engine, movement, mining, & arm swing rig
├── auth.js               # Supabase Auth (Email & Google OAuth) & Cloud Sync
├── multiplayer.js        # Supabase Realtime WebSocket 3D player sync
├── save.js               # Progress serialization & LocalStorage backup
├── schematics.js         # Schematic voxel loader & structure stamper
├── waypoints.js          # 3D landmark waypoint navigation system
├── mobs.js               # Zombie & Animal AI, pathfinding, & mob spawner
├── inventory.js          # Player inventory, hotbar, & chest storage
├── crafting.js           # 2x2 & 3x3 crafting recipe matcher
├── items.js              # Item definitions, tools, armor, & food stats
├── textures.js           # Procedural WebGL block textures & icon generator
├── audio.js              # Web Audio API sound effects & ambient soundscape
├── minimap.js            # Real-time top-down 2D radar HUD
└── favicon.svg           # Customized 3D Minecraft voxel & diamond logo icon
```

---

## 🚀 Quick Start Guide

### Option 1: Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/tee-uwu/TeeCraft.git
   cd TeeCraft
   ```

2. Start a local HTTP web server:
   ```bash
   npx http-server -p 8080
   ```

3. Open `http://localhost:8080` in your web browser!

---

### Option 2: Deploy to Vercel (1-Click)

1. Fork or push this repository to GitHub.
2. Open **[Vercel New Project](https://vercel.com/new)**.
3. Import **`tee-uwu/TeeCraft`**.
4. Click **Deploy**!

---

## 🗄️ Supabase Database Setup (Optional)

Run the following SQL in your **Supabase Dashboard → SQL Editor** to enable dedicated database table storage:

```sql
CREATE TABLE IF NOT EXISTS public.player_saves (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    save_data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.player_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow individual user access" ON public.player_saves 
  FOR ALL USING (auth.uid() = user_id);
```

---

<div align="center">

### Built with ❤️ using Three.js, WebGL, & Supabase.

</div>
