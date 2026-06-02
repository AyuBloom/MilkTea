# Bamboo

This project is a native client for a game called zombia.io, made with Tauri.

## Project Tech Stack
- [Tauri v2](https://v2.tauri.app/)
- [SvelteKit](https://kit.svelte.dev/) - frontend framework; no SSR, just statically generated
- [Tailwind v4](https://tailwindcss.com/) - utility-first CSS framework 
- [Vite](https://vitejs.dev/) - build tool for the frontend
- [pnpm](https://pnpm.io/) - package manager

### Tauri plugins
```toml
tauri-plugin-svelte = "3"
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri-plugin-http = "2"
```

## Debugging Tools

### `debug-socket.js`

Helps you with debugging possible issues created from communication mismatch between the client and server. Run `pnpm run debug-socket -h` for more info.

## Project Structure
```
Bamboo/
├── src/                                # 
│   ├── app.css                         # 
│   ├── app.html                        # 
│   ├── lib/                            # 
│   │   ├── id.json                     # 
│   │   ├── static.js                   # 
│   │   ├── Assets/                     # 
│   │   │   └── servers.json            # 
│   │   ├── Components/                 # 
│   │   │   ├── Intro/                  # 
│   │   │   │   ├── Footer.svelte       # 
│   │   │   │   ├── Intro.svelte        # 
│   │   │   │   ├── Leaderboard.svelte  # 
│   │   │   │   └── SideBar.svelte      # 
│   │   │   └── UI/                     # 
│   │   │       ├── AnnouncementOverlay.svelte # 
│   │   │       ├── BuildingBar.svelte  # 
│   │   │       ├── BuildingOverlay.svelte # 
│   │   │       ├── Chat.svelte         # 
│   │   │       ├── Consumables.svelte  # 
│   │   │       ├── DayNightOverlay.svelte # 
│   │   │       ├── DayNightTicker.svelte # 
│   │   │       ├── Debug.svelte        # 
│   │   │       ├── Leaderboard.svelte  # 
│   │   │       ├── MenuIcons.svelte    # 
│   │   │       ├── MenuParties.svelte  # 
│   │   │       ├── MenuSettings.svelte # 
│   │   │       ├── MenuShop.svelte     # 
│   │   │       ├── MiniMap.svelte      # 
│   │   │       ├── PartyMembers.svelte # 
│   │   │       ├── PipOverlay.svelte   # 
│   │   │       ├── PlacementOverlay.svelte.js # 
│   │   │       ├── PopupOverlay.svelte # 
│   │   │       ├── Resources.svelte    # 
│   │   │       ├── Respawn.svelte      # 
│   │   │       ├── ToolBar.svelte      # 
│   │   │       ├── UI.svelte           # 
│   │   │       └── UI.svelte.js        # 
│   │   ├── Engine/                     # 
│   │   │   ├── Game.js                 # 
│   │   │   ├── InputPacketManager.js   # 
│   │   │   ├── Util.svelte.js          # 
│   │   │   ├── shared.svelte.js        # 
│   │   │   ├── Network/                # 
│   │   │   │   ├── Codec.js            # 
│   │   │   │   ├── Network.svelte.js   # 
│   │   │   │   └── zombia_codec.js     # 
│   │   │   └── Renderer/               # 
│   │   │       ├── EntityGrid.js       # 
│   │   │       ├── Renderer.svelte.js  # 
│   │   │       ├── Replicator.js       # 
│   │   │       └── World.js            # 
│   │   └── Models/                     # 
│   │       ├── EffectNode.js           # 
│   │       ├── EntityModels.js         # 
│   │       ├── EntityNode.js           # 
│   │       ├── GraphicsNode.js         # 
│   │       ├── HarvesterSelectorModel.js # 
│   │       ├── HealthBarModel.js       # 
│   │       ├── LayerNode.js            # 
│   │       ├── Model.js                # 
│   │       ├── Node.js                 # 
│   │       ├── PlayerModel.js          # 
│   │       ├── RangeModel.js           # 
│   │       ├── ShieldBarModel.js       # 
│   │       ├── SpriteNode.js           # 
│   │       ├── TextNode.js             # 
│   │       ├── TintModel.js            # 
│   │       └── TowerModel.js           # 
│   └── routes/                         # 
│       ├── +layout.js                  # 
│       ├── +layout.svelte              # 
│       └── +page.svelte                # 
├── src-tauri/                          # 
└── static/                             # 
```
