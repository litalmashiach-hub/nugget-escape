# The Great Nugget Escape

Just before the first bite, a chicken nugget blinks awake. Hop off the dinner plate, sneak through a three-floor house, find the colored keys and escape through the front door before the family eats you.

A polished, all-ages browser game built with **PixiJS (WebGL)** and **TypeScript**.

## How to play

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | WASD or arrow keys | Joystick (bottom left) |
| Dash | Space or Shift | DASH button |
| Hint | H | **?** button |
| Pause | P or Esc | Pause button |
| Sound on/off | M | Speaker button |

- Every room has a **locked door with its own color**. Only the key of the same color opens it. Each door also has a symbol (heart, drop, sun, leaf, moon, diamond, flower, star) so color-blind players can match keys too.
- Keys lead from room to room across all three floors. The last key is **gold** and opens the front door.
- If a family member sees you (their view cone turns red) they run at you. Break their line of sight, take the stairs, or **hide under beds and tables**.
- Easy (5 lives), Normal (3) and Hard (2, sharper eyes).

### The house

| Floor | Rooms | Who lives there |
| --- | --- | --- |
| Ground Floor | Dining Room (start), Kitchen, Living Room, Front Hall | Dad, Mom, Biscuit the dog |
| Upstairs | Kids' Bedroom, Bathroom, Parents' Bedroom, Upstairs Hall | Big Sister, Grandma |
| Attic | Storage Room, Attic Playroom | Little Brother |

Key chain: Red → Teal → Orange → Green → Purple → Blue → Pink → Gold (front door).

## Tech

- **PixiJS 8** renders everything on the GPU: additive lamp lighting, glowing keys, particles, vision cones that are blocked by walls, camera shake and smooth zoom.
- All art is **procedurally painted** (Canvas 2D → GPU textures) and all sound and music is **synthesized** with the Web Audio API, so there are no image or audio files to load.
- Game rules (`src/game/`) are plain TypeScript with no rendering code, so they are fully unit-tested.

```
src/
  game/      rules: levels, map, movement, vision, path finding, family AI, autopilot, solver
  render/    PixiJS scene, procedural art, characters
  audio/     synthesized sound effects and music
  ui/        HUD, minimap, toasts
tests/
  unit/      Vitest: layout rules, key/door logic, family behavior, full autopilot escape
  e2e/       Playwright: real browser tests incl. a robot that plays the whole game
```

## Development

```bash
npm install
npm run dev          # local dev server
npm test             # unit tests (Vitest)
npm run test:e2e     # browser tests (Playwright; run `npx playwright install chromium` once)
npm run build        # production build in dist/
npm run build:single # one self-contained HTML file in dist-single/
```

Handy URL options for testing: `?autostart`, `?difficulty=easy|normal|hard`, `?nofamily`, `?bot` (autopilot), `?speed=4`.

## Deploying

`.github/workflows/pages.yml` publishes the game to GitHub Pages on every push to `main`. Turn it on once in **Settings → Pages → Source: GitHub Actions**.
