import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const DEMO = 'http://localhost:5175/';

test.describe('demo site', () => {
  for (const colorScheme of ['dark', 'light'] as const) {
    test(`has no axe violations (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(DEMO);
      // reveal every tile (they blur in on scroll)
      await page.evaluate(() => {
        for (const t of document.querySelectorAll('.tile')) t.classList.add('seen');
      });
      await page.waitForTimeout(900);
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
        .analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual(
        [],
      );
    });
  }

  test('hold to delete works from the keyboard', async ({ page }) => {
    await page.goto(DEMO);
    const row = page.locator('#hold .row').first();
    await row.focus();
    await page.keyboard.down(' ');
    await page.waitForTimeout(1100);
    await page.keyboard.up(' ');
    await expect(page.locator('#hold li.gone')).toHaveCount(1);
    await expect(page.locator('#hold .row').nth(1)).toBeFocused();
    const spoken = await page
      .locator('#hold cursor-status')
      .evaluate((el) => el.shadowRoot!.querySelector('[role=status]')!.textContent);
    expect(spoken).toBe('Deleted');
  });

  test('releasing early cancels', async ({ page }) => {
    await page.goto(DEMO);
    const row = page.locator('#hold .row').first();
    await row.focus();
    await page.keyboard.down('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.up('Enter');
    await expect(page.locator('#hold li.gone')).toHaveCount(0);
  });

  test('the toolbar themes the page and every pill, and previews reduced motion', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(DEMO);
    await page.getByRole('button', { name: 'Light', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('#hold cursor-status')).toHaveAttribute('theme', 'light');
    await page.getByRole('button', { name: 'Reduce motion' }).click();
    await expect(page.locator('#rotate cursor-status')).toHaveAttribute('motion', 'reduce');
    await expect(page.getByRole('button', { name: 'Reduce motion' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('rotate snaps from the keyboard', async ({ page }) => {
    await page.goto(DEMO);
    const dial = page.getByRole('slider', { name: 'Rotation' });
    await dial.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(dial).toHaveAttribute('aria-valuenow', '30');
    const label = await page
      .locator('#rotate cursor-status')
      .evaluate((el) => el.getAttribute('label'));
    expect(label).toBe('Snapped · 30°');
  });

  test('tiles stay in their columns when a tile changes height', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(DEMO);
    const columns = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.tile')].map(
          (t) => `${t.id}@${Math.round(t.getBoundingClientRect().x)}`,
        ),
      );
    const before = await columns();
    for (const kind of ['Success', 'Info', 'Error', 'Progress']) {
      await page.locator('#play .seg label', { hasText: kind }).click();
      expect(await columns()).toEqual(before);
    }
    const row = page.locator('#hold .row').first();
    await row.focus();
    await page.keyboard.down(' ');
    await page.waitForTimeout(1100);
    await page.keyboard.up(' ');
    await page.waitForTimeout(400);
    expect(await columns()).toEqual(before);
  });

  test('the playground pill stays inside its stage, success included', async ({ page }) => {
    await page.goto(DEMO);
    const pill = page.locator('#play cursor-status');
    const on = () =>
      pill.evaluate((el) => el.shadowRoot!.querySelector('.p')!.hasAttribute('data-on'));
    const stage = (await page.locator('#play .stage').boundingBox())!;
    await page.mouse.move(stage.x + 80, stage.y + 70, { steps: 4 });
    await expect.poll(on).toBe(true);
    for (const kind of ['Success', 'Info', 'Error', 'Success']) {
      await page.locator('#play .seg label', { hasText: kind }).click();
      await page.waitForTimeout(100);
      expect(await on(), `${kind} clicked outside the stage`).toBe(false);
    }
    await page.locator('#play [data-flash]').click();
    await expect.poll(on).toBe(true); // Flash is pinned inside the stage
  });

  test('scrolling the stage away from under the pointer dismisses the pill', async ({ page }) => {
    await page.goto(DEMO);
    const on = () =>
      page
        .locator('#play cursor-status')
        .evaluate((el) => el.shadowRoot!.querySelector('.p')!.hasAttribute('data-on'));
    await page.locator('#play .seg label', { hasText: 'Success' }).click();
    await page.locator('#play .stage').scrollIntoViewIfNeeded();
    const stage = (await page.locator('#play .stage').boundingBox())!;
    await page.mouse.move(stage.x + 80, stage.y + 70, { steps: 4 });
    await expect.poll(on).toBe(true);
    await page.mouse.wheel(0, 500); // the page moves; the pointer doesn't
    await expect.poll(on).toBe(false);
    await page.mouse.wheel(0, -500); // and back under the pointer: it returns
    await expect.poll(on).toBe(true);
  });

  test('has no horizontal scroll on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(DEMO);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});
