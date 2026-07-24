import { expect, test, type Locator, type Page } from '@playwright/test';

type TestViewport = {
  name: string;
  width: number;
  height: number;
};

const viewports: TestViewport[] = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'small-mobile', width: 320, height: 568 },
  { name: 'mobile-landscape', width: 844, height: 390 },
];

for (const viewport of viewports) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('overview reflows without clipping or panel overlap', async ({ page }) => {
      await openTown(page);

      await expect(page.locator('.pixel-town-shell')).toHaveClass(/is-overview/);
      await expectNoHorizontalPageOverflow(page);
      await expectVisibleButtonsInsideViewport(page);

      const hud = page.locator('.pixel-hud-dock');
      if (viewport.width <= 1100) {
        await expect(hud).toBeVisible();
        await expect(hud).toHaveCSS('position', 'sticky');
        await expectNoOverlap(hud, page.locator('.pixel-town-stage-wrap'));
        await expectNoOverlap(hud, page.locator('.pixel-town-summary'));
        await expectNoOverlap(hud, page.locator('.pixel-event-board'));
      } else {
        await expect(hud).toBeHidden();
      }

      await expectNoOverlap(
        page.locator('.pixel-town-stage-wrap'),
        page.locator('.pixel-town-summary'),
      );
      await expectNoOverlap(page.locator('.pixel-town-summary'), page.locator('.pixel-event-board'));

      if (viewport.width <= 640) {
        const eventSizing = await page.locator('.pixel-event-track').evaluate((track) => {
          const firstCard = track.firstElementChild?.getBoundingClientRect();
          const style = getComputedStyle(track);
          return {
            contentWidth:
              track.clientWidth -
              Number.parseFloat(style.paddingLeft) -
              Number.parseFloat(style.paddingRight),
            firstCardWidth: firstCard?.width ?? 0,
            scrollWidth: track.scrollWidth,
            clientWidth: track.clientWidth,
          };
        });
        expect(eventSizing.firstCardWidth).toBeGreaterThanOrEqual(eventSizing.contentWidth - 2);
        expect(eventSizing.scrollWidth).toBeGreaterThan(eventSizing.clientWidth);
      }

      if (viewport.name === 'mobile' || viewport.name === 'mobile-landscape') {
        await expect(page.locator('.pixel-world-column')).toHaveScreenshot(
          `${viewport.name}-overview.png`,
        );
      }
    });

    test('immersive mode reserves safe regions for header and HUD', async ({ page }) => {
      await openTown(page);
      await page.getByRole('button', { name: /full town/i }).click();

      const shell = page.locator('.pixel-town-shell');
      const header = page.locator('.pixel-town-header');
      const stage = page.locator('.pixel-town-stage');
      const hud = page.locator('.pixel-hud-dock');

      await expect(shell).toHaveClass(/is-immersive/);
      await expect(hud).toBeVisible();
      await expect(hud.getByRole('button', { name: /(?:create|edit me)/i })).toHaveCount(0);
      await expect(hud.getByRole('button', { name: /help/i })).toHaveCount(0);
      await expectNoHorizontalPageOverflow(page);
      await expectVisibleButtonsInsideViewport(page);
      await expectNoOverlap(header, stage);
      await expectNoOverlap(hud, stage);

      const headerBox = await requiredBox(header);
      expect(headerBox.height).toBeLessThanOrEqual(viewport.width <= 1100 ? 72 : 110);

      if (viewport.name === 'mobile') {
        await expect(stage).toHaveScreenshot('mobile-immersive.png');
      }
    });
  });
}

test.describe('mobile navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keeps help and drawers reachable inside the visual viewport', async ({ page }) => {
    await openTown(page);

    await page.locator('.pixel-hud-dock').getByRole('button', { name: /help/i }).click();
    const help = page.getByRole('dialog', { name: /read the market as a town/i });
    await expect(help).toBeVisible();
    await expectInsideViewport(help, page);
    await help.getByRole('button', { name: /close help/i }).click();

    await page.locator('.pixel-hud-dock').getByRole('button', { name: /markets/i }).click();
    const drawer = page.locator('.pixel-hud-drawer');
    await expect(drawer).toBeVisible();
    await drawer.evaluate((element) =>
      Promise.all(element.getAnimations().map((animation) => animation.finished)),
    );
    await expectInsideViewport(drawer, page);
    await drawer.getByRole('button', { name: /close panel/i }).click();
  });
});

async function openTown(page: Page) {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.pixel-town-shell')).toBeVisible();
}

async function expectNoHorizontalPageOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

async function expectVisibleButtonsInsideViewport(page: Page) {
  const outside = await page.locator('button:visible').evaluateAll((buttons) =>
    buttons
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          label: button.textContent?.trim() ?? '',
          left: rect.left,
          right: rect.right,
        };
      })
      .filter(({ left, right }) => left < -0.5 || right > window.innerWidth + 0.5),
  );
  expect(outside).toEqual([]);
}

async function expectNoOverlap(first: Locator, second: Locator) {
  const firstBox = await requiredBox(first);
  const secondBox = await requiredBox(second);
  const overlapWidth = Math.max(
    0,
    Math.min(firstBox.x + firstBox.width, secondBox.x + secondBox.width) -
      Math.max(firstBox.x, secondBox.x),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(firstBox.y + firstBox.height, secondBox.y + secondBox.height) -
      Math.max(firstBox.y, secondBox.y),
  );
  expect(overlapWidth * overlapHeight).toBe(0);
}

async function expectInsideViewport(locator: Locator, page: Page) {
  const box = await requiredBox(locator);
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport!.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport!.height);
}

async function requiredBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}
