import { existsSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';

/** Screenshot baselines are per platform. In CI, skip until one has been committed for this OS
 *  (generate them with the "Update snapshots" workflow). */
function needsBaseline(name: string) {
  const info = test.info();
  const updating =
    info.config.updateSnapshots === 'all' || info.config.updateSnapshots === 'changed';
  test.skip(
    !!process.env.CI && !updating && !existsSync(info.snapshotPath(name)),
    `no ${name} baseline for ${process.platform} yet`,
  );
}

interface Pill {
  x: number;
  y: number;
  w: number;
  h: number;
  on: boolean;
  top: boolean;
  icon: string;
  text: string;
  spoken: string;
}

/** The pill's on-screen box and state. */
function pill(page: Page, id = 'cs'): Promise<Pill> {
  return page.evaluate((id) => {
    const root = document.getElementById(id)!.shadowRoot!;
    const p = root.querySelector<HTMLElement>('.p')!;
    const r = p.getBoundingClientRect();
    return {
      x: r.x,
      y: r.y,
      w: r.width,
      h: r.height,
      on: p.hasAttribute('data-on'),
      top: p.matches(':popover-open'),
      icon: p.dataset.icon ?? '',
      text: [...p.querySelectorAll('.l > span:not(.out)')].map((s) => s.textContent).join('|'),
      spoken: root.querySelector('[role=status]')!.textContent ?? '',
    };
  }, id);
}

/** Resolves once the pill's transform has stopped changing. */
function settled(page: Page, id = 'cs') {
  return page.evaluate(
    (id) =>
      new Promise<void>((resolve) => {
        const p = document.getElementById(id)!.shadowRoot!.querySelector<HTMLElement>('.p')!;
        let last = '';
        let still = 0;
        const check = () => {
          const t = p.style.transform;
          still = t === last ? still + 1 : 0;
          last = t;
          if (still > 5) resolve();
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      }),
    id,
  );
}

function run(page: Page, code: string) {
  return page.evaluate(code);
}

test.beforeEach(async ({ page }) => {
  // Count animation frames so we can check the loop sleeps.
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    (window as unknown as { frames: number }).frames = 0;
    window.requestAnimationFrame = (cb) => {
      (window as unknown as { frames: number }).frames++;
      return raf(cb);
    };
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { ready: boolean }).ready);
});

test('follows the pointer with a spring and settles at pointer + offset', async ({ page }) => {
  await page.mouse.move(200, 150);
  await run(page, `cs.show('Moving')`);
  await settled(page);
  let p = await pill(page);
  expect(p.on).toBe(true);
  expect(p.top).toBe(true);
  expect(p.x).toBeCloseTo(218, 0);
  expect(p.y).toBeCloseTo(170, 0);

  await page.mouse.move(400, 250);
  await page.waitForTimeout(50);
  p = await pill(page);
  // trailing by a hair: on its way, not teleported
  expect(p.x).toBeGreaterThan(218);
  expect(p.x).toBeLessThan(418);

  await settled(page);
  p = await pill(page);
  expect(p.x).toBeCloseTo(418, 0);
  expect(p.y).toBeCloseTo(270, 0);
});

test('appears at the pointer with a fade, un-blur and scale-in', async ({ page }) => {
  await page.mouse.move(300, 200);
  const frames = await page.evaluate(async () => {
    const cs = document.getElementById('cs') as HTMLElementTagNameMap['cursor-status'];
    const p = cs.shadowRoot!.querySelector<HTMLElement>('.p')!;
    cs.show('Hello');
    await Promise.resolve();
    const out: { opacity: number; blur: string; scale: number; x: number }[] = [];
    for (let i = 0; i < 30; i++) {
      // the last sample waits for the transitions to finish, however slow the frames are
      await new Promise((r) => (i < 29 ? requestAnimationFrame(r) : setTimeout(r, 600)));
      const cs = getComputedStyle(p);
      out.push({
        opacity: +cs.opacity,
        blur: cs.filter,
        scale: +(p.style.transform.match(/scale\(([\d.]+)\)/)?.[1] ?? 0),
        x: p.getBoundingClientRect().x,
      });
    }
    return out;
  });
  const first = frames[0]!;
  const last = frames.at(-1)!;
  expect(first.opacity).toBeLessThan(0.6);
  expect(first.blur).toContain('blur');
  expect(first.scale).toBeLessThan(0.95);
  expect(last.opacity).toBe(1);
  expect(last.scale).toBeCloseTo(1, 2);
  // it starts where it ends: jumps to the pointer instead of flying in
  expect(Math.abs(first.x - last.x)).toBeLessThan(6);
});

test('sleeps when settled: no animation frames while idle', async ({ page }) => {
  await page.mouse.move(200, 150);
  await run(page, `cs.show('Idle')`);
  await settled(page);
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => (window as unknown as { frames: number }).frames);
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => (window as unknown as { frames: number }).frames);
  expect(after).toBe(before);
});

test('morphs through progress, success and error with text, icon and live region', async ({
  page,
}) => {
  await page.mouse.move(200, 150);
  await run(page, `cs.show('Removing 3 files', { kind: 'progress', progress: 0.3, dots: true })`);
  await settled(page);
  let p = await pill(page);
  expect([p.icon, p.text, p.spoken]).toEqual(['ring', 'Removing 3 files', 'Removing 3 files…']);

  await run(page, `cs.progress = 0.8`);
  await page.waitForTimeout(50);
  expect((await pill(page)).spoken).toBe('Removing 3 files…'); // ticks aren't announced

  await run(page, `cs.success('Removed 3 files')`);
  await page.waitForTimeout(50);
  p = await pill(page);
  expect([p.icon, p.text, p.spoken]).toEqual(['check', 'Removed 3 files', 'Removed 3 files']);

  await run(page, `cs.error("Can't drop here")`);
  await page.waitForTimeout(50);
  p = await pill(page);
  expect([p.icon, p.text, p.spoken]).toEqual(['cross', "Can't drop here", "Can't drop here"]);
});

test('the label width animates to the new text', async ({ page }) => {
  await page.mouse.move(100, 100);
  await run(page, `cs.show('Hold to delete')`);
  await settled(page);
  const before = (await pill(page)).w;
  await run(page, `cs.show('Deleting 128 files', { kind: 'progress', dots: true })`);
  await page.waitForTimeout(80);
  const during = (await pill(page)).w;
  await page.waitForTimeout(600);
  const after = (await pill(page)).w;
  expect(after).toBeGreaterThan(before);
  expect(during).toBeGreaterThan(before);
  expect(during).toBeLessThan(after);
});

test('success lingers after release, then fades', async ({ page }) => {
  await page.mouse.move(200, 150);
  await page.mouse.down();
  await run(page, `cs.show('Deleting', { kind: 'progress' }); cs.success('Deleted')`);
  await page.waitForTimeout(1500);
  expect((await pill(page)).on).toBe(true);
  await page.mouse.up();
  await page.waitForTimeout(900);
  expect((await pill(page)).on).toBe(true);
  await page.waitForTimeout(700);
  const p = await pill(page);
  expect(p.on).toBe(false);
  expect(p.top).toBe(false);
});

test('flips to the other side of the cursor near the right and bottom edges', async ({ page }) => {
  const { width, height } = page.viewportSize()!;
  await page.mouse.move(width - 30, height - 15);
  await run(page, `cs.show('Near the corner')`);
  await settled(page);
  const p = await pill(page);
  expect(p.x + p.w).toBeCloseTo(width - 30 - 18, 0);
  expect(p.y + p.h).toBeCloseTo(height - 15 - 20, 0);
});

test('mirrors placement in RTL', async ({ page }) => {
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });
  await page.mouse.move(500, 200);
  await run(page, `cs.show('من اليمين')`);
  await settled(page);
  const p = await pill(page);
  expect(p.x + p.w).toBeCloseTo(500 - 18, 0);
  expect(p.y).toBeCloseTo(220, 0);
});

test('escapes overflow: hidden and transformed parents via the top layer', async ({ page }) => {
  // The instance lives inside .clip (overflow hidden, transformed) but the pointer is far outside.
  await page.mouse.move(700, 120);
  await run(page, `clipped.show('Not clipped')`);
  await settled(page, 'clipped');
  const p = await pill(page, 'clipped');
  expect(p.top).toBe(true);
  expect(p.x).toBeCloseTo(718, 0);
  expect(p.y).toBeCloseTo(140, 0);
  needsBaseline('escapes-overflow.png');
  await expect(page).toHaveScreenshot('escapes-overflow.png', {
    clip: { x: 700, y: 120, width: 200, height: 70 },
  });
});

test('keeps following during pointer capture', async ({ page }) => {
  await page.mouse.move(80, 500);
  await page.mouse.down();
  await run(page, `cs.show('Captured')`);
  await page.mouse.move(700, 650, { steps: 8 });
  await settled(page);
  const p = await pill(page);
  expect(p.x).toBeCloseTo(718, 0);
  expect(p.y).toBeCloseTo(670, 0);
  await page.mouse.up();
});

test('follows drag-and-drop with files (dragover carries the position)', async ({ page }) => {
  await page.evaluate(() => {
    const cs = document.getElementById('cs') as HTMLElementTagNameMap['cursor-status'];
    const drop = document.getElementById('drop')!;
    const dt = new DataTransfer();
    dt.items.add(new File(['a'], 'a.txt', { type: 'text/plain' }));
    drop.addEventListener('dragenter', () => cs.info('Drop 1 file', { icon: 'plus' }));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      cs.success('Added 1 file');
    });
    const fire = (type: string, x: number, y: number) =>
      drop.dispatchEvent(
        new DragEvent(type, {
          dataTransfer: dt,
          clientX: x,
          clientY: y,
          bubbles: true,
          cancelable: true,
        }),
      );
    fire('dragenter', 250, 500);
    fire('dragover', 250, 500);
    (window as unknown as { fire: typeof fire }).fire = fire;
  });
  await settled(page);
  let p = await pill(page);
  expect([p.on, p.icon, p.text]).toEqual([true, 'plus', 'Drop 1 file']);
  expect(p.x).toBeCloseTo(268, 0);

  await page.evaluate(() =>
    (window as unknown as { fire: (t: string, x: number, y: number) => void }).fire(
      'dragover',
      320,
      510,
    ),
  );
  await settled(page);
  p = await pill(page);
  expect(p.x).toBeCloseTo(338, 0);
  expect(p.y).toBeCloseTo(530, 0);

  await page.evaluate(() =>
    (window as unknown as { fire: (t: string, x: number, y: number) => void }).fire(
      'drop',
      320,
      510,
    ),
  );
  await page.waitForTimeout(50);
  p = await pill(page);
  expect([p.icon, p.text]).toEqual(['check', 'Added 1 file']);
});

test('only follows and shows inside its scope', async ({ page }) => {
  await run(page, `scoped.show('In scope')`);
  await page.mouse.move(100, 100);
  await page.waitForTimeout(100);
  expect((await pill(page, 'scoped')).on).toBe(false);
  await page.mouse.move(450, 350, { steps: 4 });
  await settled(page, 'scoped');
  const p = await pill(page, 'scoped');
  expect(p.on).toBe(true);
  expect(p.x).toBeCloseTo(468, 0);
  await page.mouse.move(100, 100, { steps: 4 });
  await page.waitForTimeout(100);
  expect((await pill(page, 'scoped')).on).toBe(false);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('snaps to the pointer instead of springing', async ({ page }) => {
    await page.mouse.move(200, 150);
    await run(page, `cs.show('Calm')`);
    await page.waitForTimeout(50);
    await page.mouse.move(500, 300);
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    const p = await pill(page);
    expect(p.x).toBeCloseTo(518, 0);
    expect(p.y).toBeCloseTo(320, 0);
  });

  test('shows static dots and no blur', async ({ page }) => {
    await page.mouse.move(200, 150);
    await run(page, `cs.show('Saving', { kind: 'progress', dots: true })`);
    await page.waitForTimeout(400);
    const style = await page.evaluate(() => {
      const root = document.getElementById('cs')!.shadowRoot!;
      return {
        dots: getComputedStyle(root.querySelector('i')!).animationName,
        filter: getComputedStyle(root.querySelector('.p')!).filter,
      };
    });
    expect(style.dots).toBe('none');
    expect(style.filter).toBe('none');
  });
});

test.describe('touch', () => {
  test.use({ hasTouch: true });

  test('sits centred above the finger', async ({ page }) => {
    await run(page, `cs.show('Above the finger')`);
    await page.touchscreen.tap(400, 400);
    await settled(page);
    const p = await pill(page);
    expect(p.on).toBe(true);
    expect(p.x + p.w / 2).toBeCloseTo(400, 0);
    expect(p.y + p.h / 2).toBeCloseTo(400 - 78, 0);
  });
});

test.describe('visual', () => {
  test.use({ colorScheme: 'dark' });

  const states: [string, string][] = [
    ['info', `cs.info('Drop 3 files', { icon: 'plus' })`],
    ['label-only', `cs.info('240 × 160')`],
    ['progress', `cs.show('Removing 3 files', { kind: 'progress', progress: 0.6, dots: true })`],
    ['success', `cs.success('Removed 3 files')`],
    ['error', `cs.error("Can't drop here")`],
  ];

  for (const [name, code] of states) {
    test(`state: ${name}`, async ({ page }) => {
      needsBaseline(`${name}.png`);
      // Reduced motion: static dots, nothing mid-flight.
      await run(page, `cs.motion = 'reduce'; cs.linger = 60000`);
      await page.mouse.move(40, 40);
      await run(page, code);
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot(`${name}.png`, {
        clip: { x: 40, y: 40, width: 240, height: 70 },
      });
    });
  }

  test('state: light theme', async ({ page }) => {
    needsBaseline('light.png');
    await run(page, `cs.theme = 'light'; cs.motion = 'reduce'`);
    await page.mouse.move(40, 40);
    await run(page, `cs.show('Removing 3 files', { kind: 'progress', progress: 0.6, dots: true })`);
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('light.png', {
      clip: { x: 40, y: 40, width: 240, height: 70 },
    });
  });
});
