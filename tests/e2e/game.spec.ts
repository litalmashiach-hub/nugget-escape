import { test, expect, type Page } from '@playwright/test';

type Snapshot = { status: string; floor: number; x: number; y: number; lives: number; held: number; mode: string };

async function open(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  // Web fonts are optional; keep tests independent of the network.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('/' + query);
  await page.waitForFunction(() => (window as any).__nugget?.mode !== undefined);
  return errors;
}

const snap = (page: Page) =>
  page.evaluate((): Snapshot => {
    const n = (window as any).__nugget;
    const s = n.state;
    return { status: s.status, floor: s.player.floor, x: s.player.pos.x, y: s.player.pos.y, lives: s.lives, held: s.held.size, mode: n.mode };
  });

test('title screen shows the game name, difficulty choices and Play', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('h1.logo')).toContainText('Nugget Escape');
  await expect(page.locator('#btn-play')).toBeVisible();
  await expect(page.locator('.difficulty button')).toHaveCount(3);
  await expect(page.locator('#stage canvas')).toBeVisible();
  await expect(page.locator('#loading')).toBeHidden();
  expect(errors).toEqual([]);
});

test('Play opens the dinner cutscene, which can be skipped', async ({ page }) => {
  const errors = await open(page);
  await page.locator('#btn-play').click();
  await expect(page.locator('#cutscene')).toBeVisible();
  await expect(page.locator('#screen-title')).toBeHidden();
  await expect(page.locator('#cutscene-text')).toContainText('Dinner time');
  await expect(page.locator('#hud')).toBeHidden();
  expect(await page.evaluate(() => (window as any).__nugget.mode)).toBe('cutscene');
  await page.keyboard.press('Escape');
  await expect(page.locator('#cutscene')).toBeHidden();
  await expect(page.locator('#hud')).toBeVisible();
  const s = await snap(page);
  expect(s.mode).toBe('game');
  expect(s.status).toBe('playing');
  expect(errors).toEqual([]);
});

test('the cutscene plays to the end on its own and hands over to the game', async ({ page }) => {
  const errors = await open(page, '?cutscene&speed=12');
  await expect(page.locator('#cutscene')).toBeVisible();
  const seen = new Set<string>();
  await expect.poll(async () => {
    const t = await page.locator('#cutscene-text').textContent().catch(() => '');
    if (t) seen.add(t);
    return page.evaluate(() => (window as any).__nugget.mode);
  }, { timeout: 60_000, intervals: [100] }).toBe('game');
  expect([...seen].join(' ')).toMatch(/blink|NOT dinner|catch that nugget|escape the house/i);
  await expect(page.locator('#hud')).toBeVisible();
  const s = await snap(page);
  expect(s.status).toBe('playing');
  expect(s.x).toBeCloseTo(16.5, 1);
  expect(errors).toEqual([]);
});

test('Play starts the game with the HUD, 8 key slots and full lives', async ({ page }) => {
  const errors = await open(page);
  await page.locator('#diff-easy').click();
  await page.locator('#btn-play').click();
  await page.locator('#btn-skip').click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#screen-title')).toBeHidden();
  await expect(page.locator('.key-slot')).toHaveCount(8);
  await expect(page.locator('#hud-lives img')).toHaveCount(5);
  await expect(page.locator('#hud-floor')).toHaveText('Ground Floor');
  await expect(page.locator('#hud-objective')).toContainText('Find the Red key');
  expect(errors).toEqual([]);
});

test('arrow keys move the nugget and walls stop it', async ({ page }) => {
  await open(page, '?autostart&nofamily&speed=4');
  await page.waitForFunction(() => (window as any).__nugget.state.status === 'playing');
  const before = await snap(page);
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction((x0) => (window as any).__nugget.state.player.pos.x < x0 - 1, before.x);
  await page.keyboard.up('ArrowLeft');
  // Keep walking into the west wall of the dining room: the nugget must stay inside.
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(2500);
  await page.keyboard.up('ArrowLeft');
  const after = await snap(page);
  expect(after.x).toBeGreaterThan(12.2);
});

test('pause menu stops and resumes the game', async ({ page }) => {
  await open(page, '?autostart&nofamily');
  await page.waitForFunction(() => (window as any).__nugget.state.status === 'playing');
  await page.keyboard.press('KeyP');
  await expect(page.locator('#screen-pause')).toBeVisible();
  const t0 = await page.evaluate(() => (window as any).__nugget.state.time);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => (window as any).__nugget.state.time)).toBe(t0);
  await page.locator('#btn-resume').click();
  await expect(page.locator('#screen-pause')).toBeHidden();
  await page.waitForFunction((t) => (window as any).__nugget.state.time > t, t0);
});

test('a locked door shows which key is missing', async ({ page }) => {
  await open(page, '?autostart&nofamily&speed=3');
  await page.waitForFunction(() => (window as any).__nugget.state.status === 'playing');
  await page.evaluate(() => { (window as any).__nugget.state.player.pos = { x: 16.5, y: 8.4 }; });
  await page.keyboard.down('ArrowDown');
  await expect(page.locator('.toast').filter({ hasText: 'You need the Red key' })).toBeVisible();
  await page.keyboard.up('ArrowDown');
});

test('family members catch the nugget and a life is lost', async ({ page }) => {
  await open(page, '?autostart&speed=2');
  await page.waitForFunction(() => (window as any).__nugget.state.status === 'playing');
  await page.evaluate(() => {
    const s = (window as any).__nugget.state;
    s.unlocked.add('red');
    s.player.pos = { x: 11.5, y: 12.5 };
    const dad = s.chasers.find((c: any) => c.def.id === 'dad');
    Object.assign(dad, { pos: { x: 8.5, y: 12.5 }, facing: 0, lookBase: 0, pause: 5, path: [] });
  });
  await expect(page.locator('.toast.danger').first()).toBeVisible();
  await page.waitForFunction(() => (window as any).__nugget.state.lives === 2, undefined, { timeout: 30_000 });
  await expect(page.locator('#hud-lives img.lost')).toHaveCount(1);
});

test('out the front door, Uncle Gus drops in; skipping starts the ketchup boss fight', async ({ page }) => {
  const errors = await open(page, '?autostart&nofamily');
  await page.evaluate(() => (window as any).__nugget.toFrontDoor());
  await expect(page.locator('#cutscene')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__nugget.mode)).toBe('bossCutscene');
  await page.evaluate(() => (window as any).__nugget.seekCutscene(3));
  await expect(page.locator('#cutscene-who')).toHaveText('Uncle Gus');
  await expect(page.locator('#cutscene-text')).toContainText('fried chicken');
  await page.keyboard.press('Escape');
  await expect(page.locator('#cutscene')).toBeHidden();
  await expect(page.locator('#boss-hud')).toBeVisible();
  await expect(page.locator('.boss-name')).toHaveText('Uncle Gus');
  expect((await snap(page)).status).toBe('boss');
  // Holding the mouse button squirts ketchup at Gus.
  const box = (await page.locator('#stage').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => (window as any).__nugget.state.boss.hp < (window as any).__nugget.state.boss.maxHp, undefined, { timeout: 20_000 });
  await page.mouse.up();
  // An empty bottle stays empty: the meter does not fill back up on its own.
  await page.evaluate(() => { const n = (window as any).__nugget; n.state.ketchup = 0; n.state.player.invuln = 99; });
  await expect(page.locator('.ketchup-label')).toHaveText(/Empty|Grab a bottle/);
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => (window as any).__nugget.state.ketchup)).toBe(0);
  expect(await page.locator('#ketchup-fill').evaluate((el) => el.style.transform)).toBe('scaleX(0)');
  expect(errors).toEqual([]);
});

test('walking up to the kitchen fridge finds the egg easter egg', async ({ page }) => {
  const errors = await open(page, '?autostart&nofamily');
  await page.evaluate(() => {
    const s = (window as any).__nugget.state;
    s.unlocked.add('red');
    s.player.pos = { x: 10.5, y: 4.4 };
  });
  await page.keyboard.down('ArrowUp');
  await expect(page.locator('.toast.secret')).toContainText('egg', { timeout: 10_000 });
  await page.keyboard.up('ArrowUp');
  await expect(page.locator('#hud-secrets')).toBeVisible();
  await expect(page.locator('#hud-secrets')).toContainText('1/5');
  expect(errors).toEqual([]);
});

test('finding every easter egg unlocks the NUGGET RAIN button, and the family stops to eat', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // the button pulses otherwise
  const errors = await open(page, '?autostart');
  await page.waitForFunction(() => (window as any).__nugget.state.status === 'playing', undefined, { timeout: 15_000 });
  await expect(page.locator('#feast-btn')).toBeHidden();
  await page.evaluate(() => {
    const s = (window as any).__nugget.state;
    for (const id of ['egg', 'book', 'duck', 'box', 'dentures']) s.secrets.add(id);
  });
  await expect(page.locator('#feast-btn')).toBeVisible();
  await page.locator('#feast-btn').click();
  await page.waitForFunction(() => (window as any).__nugget.state.feastTime > 0);
  await expect(page.locator('#floor-banner')).toHaveText('Nugget rain!');
  await expect(page.locator('#feast-btn')).toHaveClass(/cooling/);
  expect(await page.evaluate(() => (window as any).__nugget.state.chasers.every((c: any) => c.mode === 'feast'))).toBe(true);
  expect(errors).toEqual([]);
});

test('the robot player escapes the whole house and sees the win screen', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await open(page, '?autostart&nofamily&bot&speed=12&seed=1');
  const floors = new Set<number>();
  await expect.poll(async () => {
    const s = await snap(page);
    floors.add(s.floor);
    return s.status;
  }, { timeout: 200_000, intervals: [250] }).toBe('won');
  expect([...floors].sort()).toEqual([0, 1, 2]);
  expect(await page.evaluate(() => (window as any).__nugget.state.boss.hp)).toBe(0);
  await expect(page.locator('#screen-win')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#screen-win h2')).toHaveText('You escaped!');
  await expect(page.locator('.key-slot.used')).toHaveCount(8);
  expect(errors).toEqual([]);
});

test('Level 2 is locked on a fresh device, and beating Level 1 unlocks it and starts it on its own', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await open(page);
  await expect(page.locator('#level-2')).toBeDisabled();
  await expect(page.locator('#level-2')).toContainText('Beat Level 1 to unlock');
  // the robot beats Level 1 (quick version: no family, no boss)
  await page.goto('/?autostart&nofamily&noboss&bot&speed=12&seed=1');
  await page.waitForFunction(() => (window as any).__nugget?.mode !== undefined);
  await expect(page.locator('#screen-win')).toBeVisible({ timeout: 200_000 });
  await expect(page.locator('#win-sub')).toHaveText('Level 2 unlocked: The Grocery Store!');
  await expect(page.locator('#btn-next')).toBeVisible();
  await expect(page.locator('#win-next-note')).toContainText('Level 2 starts in');
  // ...and Level 2's street cutscene starts by itself
  await expect.poll(() => page.evaluate(() => (window as any).__nugget.mode), { timeout: 15_000 }).toBe('street');
  expect(await page.evaluate(() => (window as any).__nugget.state.level.id)).toBe(2);
  // the unlock is remembered for the menu
  await page.evaluate(() => (window as any).__nugget.toMenu());
  await expect(page.locator('#level-2')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('Level 2 opens with the street cutscene, which can be skipped into the grocery store', async ({ page }) => {
  const errors = await open(page, '?level=2');
  await expect(page.locator('#level-2')).toHaveClass(/on/);
  await page.locator('#btn-play').click();
  await expect(page.locator('#cutscene')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__nugget.mode)).toBe('street');
  await page.evaluate(() => (window as any).__nugget.seekCutscene(4));
  await expect(page.locator('#cutscene-text')).toContainText('why am I alive');
  await page.locator('#btn-skip').click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('.key-slot')).toHaveCount(4);
  await expect(page.locator('#hud-floor')).toHaveText('FreshMart');
  await expect(page.locator('#hud-objective .obj-text')).toHaveText('Find the Green key');
  await expect(page.locator('#feast-btn')).toBeHidden();
  expect(errors).toEqual([]);
});

test('Level 2: a store employee puts the nugget back on the shelf', async ({ page }) => {
  const errors = await open(page, '?level=2&autostart&seed=1');
  await page.waitForFunction(() => (window as any).__nugget.state.status === 'playing');
  await page.evaluate(() => {
    const s = (window as any).__nugget.state;
    s.chasers = s.chasers.filter((c: any) => c.def.id === 'dan');
    const dan = s.chasers[0];
    dan.pos = { x: 70.5, y: 29.5 }; dan.facing = 0; dan.lookBase = 0; dan.pause = 5;
    s.player.pos = { x: 73, y: 29.5 };
  });
  await expect(page.locator('.toast.danger').filter({ hasText: 'put you back on the shelf' })).toBeVisible({ timeout: 8000 });
  // after the caught moment, it reappears on the frozen food shelf with one life fewer
  await expect.poll(async () => { const s = await snap(page); return `${s.lives} ${s.status}`; }, { timeout: 8000 }).toBe('2 playing');
  const s = await snap(page);
  expect(Math.abs(s.x - 68.5) + Math.abs(s.y - 21.6)).toBeLessThan(1.5);
  expect(errors).toEqual([]);
});

test('typing the secret code "shalevisbest" unlocks Level 2 without beating Level 1', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('#level-2')).toBeDisabled();
  await page.keyboard.type('shalevisbest');
  await expect(page.locator('#level-2')).toBeEnabled();
  await expect(page.locator('#cheat-note')).toHaveText('Secret code accepted: Level 2 unlocked!');
  await page.locator('#level-2').click();
  await page.locator('#btn-play').click();
  expect(await page.evaluate(() => (window as any).__nugget.mode)).toBe('street');
  // remembered after a reload
  await page.reload();
  await page.waitForFunction(() => (window as any).__nugget?.mode !== undefined);
  await expect(page.locator('#level-2')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('Level 2: water spills make the nugget slide, and a shopper charges with a cart near a key', async ({ page }) => {
  const errors = await open(page, '?level=2&autostart&nofamily&seed=1');
  await page.waitForFunction(() => (window as any).__nugget.state.status === 'playing');
  // just above the spill by the green key: walk down into it
  await page.evaluate(() => { (window as any).__nugget.state.player.pos = { x: 75.5, y: 42.3 }; });
  await page.keyboard.down('ArrowDown');
  await expect(page.locator('.toast').filter({ hasText: 'Slippery' })).toBeVisible({ timeout: 4000 });
  await page.keyboard.up('ArrowDown');
  // next to the green key from below: a shopper charges
  await page.evaluate(() => { const s = (window as any).__nugget.state; s.player.slip = 0; s.player.pos = { x: 75.5, y: 48 }; s.player.invuln = 0; });
  await expect(page.locator('.toast').filter({ hasText: 'cart is charging' })).toBeVisible({ timeout: 4000 });
  expect(await page.evaluate(() => (window as any).__nugget.state.carts.length)).toBe(1);
  // standing still: run over
  await expect(page.locator('.toast').filter({ hasText: 'Run over by a shopping cart' })).toBeVisible({ timeout: 6000 });
  expect((await snap(page)).lives).toBe(2);
  expect(errors).toEqual([]);
});

test('the robot player gets through the grocery store into the Manager\'s Office', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await open(page, '?level=2&autostart&nofamily&bot&speed=12&seed=1');
  await expect.poll(async () => (await snap(page)).status, { timeout: 90_000, intervals: [250] }).toBe('won');
  await expect(page.locator('#screen-win')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#win-title')).toHaveText("You made it to the Manager's Office!");
  await expect(page.locator('.key-slot.used')).toHaveCount(4);
  await expect(page.locator('#btn-next')).toBeHidden();
  await expect(page.locator('#win-secrets-box')).toBeHidden();
  expect(errors).toEqual([]);
});

test('phone: touch controls appear and nothing overflows @phone', async ({ page }) => {
  await open(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.locator('#btn-play').tap();
  await expect(page.locator('#btn-skip')).toBeVisible();
  await page.locator('#btn-skip').tap();
  await expect(page.locator('#touch')).toBeVisible();
  await expect(page.locator('#dash-btn')).toBeVisible();
  const before = await snap(page);
  await page.waitForFunction(() => (window as any).__nugget.state.status === 'playing');
  const stick = await page.locator('#stick').boundingBox();
  await page.evaluate(({ x, y }) => {
    const el = document.getElementById('stick')!;
    el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, clientX: x, clientY: y, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: x - 60, clientY: y, bubbles: true }));
  }, { x: stick!.x + stick!.width / 2, y: stick!.y + stick!.height / 2 });
  await page.waitForFunction((x0) => (window as any).__nugget.state.player.pos.x < x0 - 0.5, before.x);
});

test('phone: the boss fight has a big SQUIRT button that fires ketchup @phone', async ({ page }) => {
  const errors = await open(page, '?autostart&nofamily');
  await page.evaluate(() => (window as any).__nugget.toFrontDoor());
  await page.locator('#btn-skip').tap();
  await expect(page.locator('#fire-btn')).toBeVisible();
  await expect(page.locator('#dash-btn')).toBeVisible();
  await expect(page.locator('#stick')).toBeVisible();
  const fire = (await page.locator('#fire-btn').boundingBox())!;
  const dash = (await page.locator('#dash-btn').boundingBox())!;
  const vw = page.viewportSize()!;
  // Buttons stay on screen and do not overlap.
  expect(fire.x + fire.width).toBeLessThanOrEqual(vw.width);
  expect(fire.y + fire.height).toBeLessThanOrEqual(vw.height);
  expect(dash.y + dash.height <= fire.y || dash.x + dash.width <= fire.x).toBe(true);
  await page.evaluate(({ x, y }) => {
    const el = document.getElementById('fire-btn')!;
    el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
  }, { x: fire.x + fire.width / 2, y: fire.y + fire.height / 2 });
  await page.waitForFunction(() => (window as any).__nugget.state.ketchup < 8, undefined, { timeout: 10_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});

test('phone: playable sideways (landscape) too @phone', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  await open(page, '?autostart&nofamily');
  await expect(page.locator('#hud')).toBeVisible();
  await page.evaluate(() => (window as any).__nugget.toFrontDoor());
  await page.locator('#btn-skip').tap();
  for (const id of ['#fire-btn', '#dash-btn', '#stick', '#boss-hud']) {
    const b = (await page.locator(id).boundingBox())!;
    expect(b.y + b.height, id).toBeLessThanOrEqual(412);
    expect(b.y, id).toBeGreaterThanOrEqual(0);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
