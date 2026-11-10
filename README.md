# The Great Nugget Escape

Just before the first bite, a chicken nugget blinks awake. Hop off the dinner plate, sneak through a three-floor house, find the colored keys and escape through the front door before the family eats you.

A polished, all-ages 3D browser game built with **Three.js (WebGL)** and **TypeScript**.

It opens with a short cutscene: the family is at dinner, Dad lifts the nugget to his mouth, it blinks awake, jumps off his fork and runs. Press **Skip**, Space, Enter or Esc to jump straight to the game.

Out the front door, a second cutscene: **Uncle Gus** jumps in front of you, munching a bucket of fried chicken, and wants you for dessert. The nugget pulls out a **ketchup bottle** and the boss fight begins. Squirt ketchup at Gus: it shoots the way the nugget is facing (a red dashed line shows where), so turn toward him first. On **Easy**, the ketchup flies at Gus by itself and follows him, so you only need to hold the squirt button. Dodge his flying drumsticks, and get out of the red ring when he jumps for a belly slam. The bottle holds 8 squirts. When it is empty, a fresh ketchup bottle appears in the garden every 5 seconds: run over and grab it to fill up.

## Level 2: The Grocery Store

Beat Level 1 and **Level 2** unlocks (for testing, type the secret code `shalevisbest` on the title screen, or tap the title 5 times on a phone and enter it). It starts by itself a few seconds after the Level 1 win screen (or press **Play Level 2**), and from then on you can pick it on the title screen. The unlock is remembered on that device.

It opens with a street cutscene: the free nugget wanders down the street wondering *why am I alive?*, spots the **FreshMart** grocery store and decides the answer must be inside. In the store:

- The store is big: six aisles, a fruit and veg corner, a deli, a bakery, checkouts, a Cold Room and a Stockroom.
- The staff (Kevin the cashier, Brenda the stocker, Deli Dan, Priya the clerk, Rosa from the bakery, Frosty Fred in the Cold Room and Stan in the Stockroom) want to put the nugget back on the shelf so they can win Employee of the Month. If one catches you, you lose a life and end up back on the frozen food shelf.
- The tall aisle shelves block their view. Hide under the fruit stands, the bakery table, pallets and shopping carts.
- **Water spills** (with yellow wet-floor signs) guard every key. Step in one and the nugget slides out of control, and the splash makes nearby staff turn to look. Find the dry way around.
- **Shopping carts:** when you get close to a key, a shopper with a cart shouts "!" and charges straight at you. Step out of the way: getting run over costs a life.
- Key chain: Green (by the bakery) → Cold Room → Orange → Stockroom → Gold → **Manager's Office**. Walk into the office to win.

## Play on a phone

The game works on iPhone and Android in portrait or landscape, with a joystick and big buttons. Open the link in Safari or Chrome. For full screen, tap the full screen button (Android), or use **Share → Add to Home Screen** (iPhone) to get a Nugget Escape icon that opens without the browser bars.

## How to play

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | WASD or arrow keys | Joystick (bottom left) |
| Dash | Space or Shift | DASH button |
| Squirt ketchup (boss fight) | F, J, K or Enter, or hold the mouse button | SQUIRT button |
| Hint | H | **?** button |
| Nugget rain (after all 5 easter eggs) | N | NUGGET RAIN button |
| Pause | P or Esc | Pause button |
| Sound on/off | M | Speaker button |

- Every room has a **locked door with its own color**. Only the key of the same color opens it. Each door also has a symbol (heart, drop, sun, leaf, moon, diamond, flower, star) so color-blind players can match keys too.
- Keys lead from room to room across all three floors. The last key is **gold** and opens the front door.
- If a family member sees you (their view cone turns red) they run at you. Break their line of sight, take the stairs, or **hide under beds and tables**.
- Easy (5 lives), Normal (3) and Hard (2, sharper eyes).
- Five **easter eggs** are hidden around the house. Walk up to the right furniture and a surprise pops out (spoiler: an egg in the kitchen fridge, a book on the living room bookshelf, a rubber duck in the bathtub, a box in the attic storage room, and Grandma's dentures in the corner of her bedroom). Find all five and a **NUGGET RAIN** button appears (or press N): chicken nuggets fall from the ceiling and the whole family stops chasing you to eat them for 14 seconds. It recharges after 40 seconds.

### The house

| Floor | Rooms | Who lives there |
| --- | --- | --- |
| Ground Floor | Dining Room (start), Kitchen, Living Room, Front Hall | Dad, Mom, Biscuit the dog |
| Upstairs | Kids' Bedroom, Bathroom, Grandma's Bedroom, Upstairs Hall | Big Sister, Grandma |
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

Handy URL options for testing: `?level=2` (pick Level 2 even if it is still locked), `?autostart` (skips the cutscene), `?cutscene` (plays it right away), `?difficulty=easy|normal|hard`, `?nofamily`, `?noboss` (win at the front door), `?bot` (autopilot), `?speed=4`, `?seed=1` (repeatable family wandering and bottle spots), `?lowfx` / `?hifx` (force render quality).

## Deploying

`.github/workflows/pages.yml` publishes the game to GitHub Pages on every push to `main`. Turn it on once in **Settings → Pages → Source: GitHub Actions**.
