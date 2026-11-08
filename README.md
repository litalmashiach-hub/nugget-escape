# The Great Nugget Escape

Just before the first bite, a chicken nugget blinks awake. Hop off the dinner plate, sneak through a three-floor house, find the colored keys and escape through the front door before the family eats you.

A polished, all-ages 3D browser game built with **Three.js (WebGL)** and **TypeScript**.

It opens with a short cutscene: the family is at dinner, Dad lifts the nugget to his mouth, it blinks awake, jumps off his fork and runs. Press **Skip**, Space, Enter or Esc to jump straight to the game.

Out the front door, a second cutscene: **Uncle Gus** jumps in front of you, munching a bucket of fried chicken, and wants you for dessert. The nugget pulls out a **ketchup bottle** and the boss fight begins. Squirt ketchup at Gus (it aims itself), dodge his flying drumsticks, and get out of the red ring when he jumps for a belly slam. The bottle holds 8 squirts and refills on its own when empty.

## Play on a phone

The game works on iPhone and Android in portrait or landscape, with a joystick and big buttons. Open the link in Safari or Chrome. For full screen, tap the full screen button (Android), or use **Share → Add to Home Screen** (iPhone) to get a Nugget Escape icon that opens without the browser bars.

## How to play

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | WASD or arrow keys | Joystick (bottom left) |
| Dash | Space or Shift | DASH button |
| Squirt ketchup (boss fight) | F, J, K or Enter, or hold the mouse button | SQUIRT button |
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

- **Three.js** renders the house in 3D: every floor, wall, door and piece of furniture is built from code, with soft shadows, warm lamp lights, spinning keys, particles and vision cones that are blocked by walls. Walls between the camera and the nugget are cut away so it is never hidden.
- The family, Biscuit the dog and the nugget are low-poly models made of primitives, with walking, sitting and reaching animations.
- On slow or software GPUs the game switches to a lighter mode (no shadows or lamp lights). Force it with `?lowfx`, or force full quality with `?hifx`.
- Floor patterns, key symbols and icons are **procedurally painted** with Canvas 2D, and all sound and music is **synthesized** with the Web Audio API, so there are no image or audio files to load.
- Game rules (`src/game/`) are plain TypeScript with no rendering code, so they are fully unit-tested.

```
src/
  game/      rules: levels, map, movement, vision, path finding, family AI, autopilot, solver
  render/    Three.js scene, house builder, furniture, characters, opening cutscene
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

Handy URL options for testing: `?autostart` (skips the cutscene), `?cutscene` (plays it right away), `?difficulty=easy|normal|hard`, `?nofamily`, `?noboss` (win at the front door), `?bot` (autopilot), `?speed=4`, `?lowfx` / `?hifx` (force render quality).

## Deploying

`.github/workflows/pages.yml` publishes the game to GitHub Pages on every push to `main`. Turn it on once in **Settings → Pages → Source: GitHub Actions**.
