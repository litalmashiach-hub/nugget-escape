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

test('Play starts the game with the HUD, 8 key slots and full lives', async ({ page }) => {
  const errors = await open(page);
  await page.locator('#diff-easy').click();
  await page.locator('#btn-play').click();
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

test('the robot player escapes the whole house and sees the win screen', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await open(page, '?autostart&nofamily&bot&speed=12');
  const floors = new Set<number>();
  await expect.poll(async () => {
    const s = await snap(page);
    floors.add(s.floor);
    return s.status;
  }, { timeout: 200_000, intervals: [250] }).toBe('won');
  expect([...floors].sort()).toEqual([0, 1, 2]);
  await expect(page.locator('#screen-win')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#screen-win h2')).toHaveText('You escaped!');
  await expect(page.locator('.key-slot.used')).toHaveCount(8);
  expect(errors).toEqual([]);
});

test('phone: touch controls appear and nothing overflows @phone', async ({ page }) => {
  await open(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.locator('#btn-play').tap();
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
