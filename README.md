# Project_SmartQ

Template created! To get started run:
  cd main-app
  bun install
  bun run tauri android init
  bun run tauri ios init

For Desktop development, run:
  bun run tauri dev

For Android development, run:
  bun run tauri android dev

For iOS development, run:
  bun run tauri ios dev
  xcrun xctrace list devices
  xcrun simctl shutdown all
  xcrun simctl erase all
  bun run tauri ios dev "9010DA6C-D867-429C-B84F-78657B168C83"
  xcrun simctl list devices available

build
To build the project for production, run:
  bun tauri build --bundles app

backend start
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

https://corpwifi.ais.co.th/