import { expect, test, type Page } from '@playwright/test';

const overviewViewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet landscape', width: 1024, height: 768 },
  { name: 'tablet portrait', width: 768, height: 1024 },
  { name: 'phone portrait', width: 390, height: 844 },
  { name: 'phone landscape', width: 667, height: 375 },
] as const;

async function loadTown(page: Page, width: number, height: number) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await expect(page.locator('.pixel-town-shell')).toHaveClass(/is-overview/);
}

async function enterImmersive(page: Page) {
  await page.getByRole('button', { name: /Full town/i }).click();
  await expect(page.locator('.pixel-town-shell')).toHaveClass(/is-immersive/);
}

async function expectNoDocumentOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
}

async function expectCompactReplayControls(page: Page) {
  const createMe = page.locator('.pixel-create-me-trigger');
  const compactReplay = page.locator('.pixel-compact-replay');

  await expect(createMe).toBeVisible();
  await expect(createMe.locator('.pixel-create-me-symbol')).toBeVisible();
  await expect(createMe.locator('.pixel-create-me-label-compact')).toBeVisible();
  await expect(createMe.locator('.pixel-create-me-label-full')).toBeHidden();
  await expect(compactReplay).toBeVisible();
  await expect(compactReplay.locator('.pixel-replay-primary')).toBeVisible();
  await expect(compactReplay.locator('.pixel-replay-speed')).toBeVisible();

  const createGeometry = await createMe.evaluate((button) => {
    const symbol = button.querySelector('.pixel-create-me-symbol')!.getBoundingClientRect();
    const label = button
      .querySelector('.pixel-create-me-label-compact')!
      .getBoundingClientRect();
    return {
      pseudoContent: getComputedStyle(button, '::after').content,
      symbolRight: symbol.right,
      symbolTop: symbol.top,
      symbolBottom: symbol.bottom,
      labelLeft: label.left,
      labelTop: label.top,
      labelBottom: label.bottom,
    };
  });
  expect(['none', 'normal']).toContain(createGeometry.pseudoContent);
  expect(createGeometry.labelLeft).toBeGreaterThanOrEqual(createGeometry.symbolRight);
  expect(createGeometry.labelTop).toBeLessThan(createGeometry.symbolBottom);
  expect(createGeometry.labelBottom).toBeGreaterThan(createGeometry.symbolTop);

  const more = compactReplay.locator('summary[aria-label]');
  await expect(more).toBeVisible();
  await more.click();
  const menu = compactReplay.locator('.pixel-replay-more-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button')).toHaveCount(2);
  await expect(menu.getByRole('checkbox')).toBeVisible();
}

for (const viewport of overviewViewports) {
  test(`overview remains horizontally contained at ${viewport.name}`, async ({ page }) => {
    await loadTown(page, viewport.width, viewport.height);
    await expectNoDocumentOverflow(page);
    await expect(page.getByRole('button', { name: /Full town/i })).toBeVisible();
  });
}

test('HUD buttons expose consistent state and drawer relationships', async ({ page }) => {
  await loadTown(page, 390, 844);
  await enterImmersive(page);

  const dock = page.locator('.pixel-hud-dock');
  const cases = [
    { name: 'Markets', id: 'town-markets-drawer' },
    { name: 'Citizens', id: 'town-agents-drawer' },
    { name: 'Agent Talk', id: 'town-activity-drawer' },
  ] as const;

  for (const item of cases) {
    const button = dock.getByRole('button', { name: item.name, exact: true });
    await expect(button).toHaveAttribute('aria-controls', item.id);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(button).toHaveClass(/is-active/);
    await expect(page.locator(`#${item.id}`)).toBeVisible();
    await expect(page.locator('.town-preview')).toHaveAttribute(
      'data-hud-inspector-open',
      'true',
    );
    await page.getByRole('button', { name: 'Close panel' }).click();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(`#${item.id}`)).toHaveCount(0);
  }

  await expect(dock.getByRole('button', { name: 'Help', exact: true })).toBeVisible();
});

test('portrait immersive mode preserves a usable map above the drawer', async ({ page }) => {
  await loadTown(page, 390, 844);
  await enterImmersive(page);
  await page
    .locator('.pixel-hud-dock')
    .getByRole('button', { name: 'Agent Talk', exact: true })
    .click();

  const geometry = await page.evaluate(() => {
    const layout = document.querySelector('.pixel-town-layout')!.getBoundingClientRect();
    const stage = document.querySelector('.pixel-town-stage')!.getBoundingClientRect();
    const drawer = document.querySelector('.pixel-hud-drawer')!.getBoundingClientRect();
    const body = document
      .querySelector('.pixel-hud-drawer .pixel-activity-body:not([hidden])')!
      .getBoundingClientRect();
    return {
      layoutBottom: layout.bottom,
      stageHeight: stage.height,
      drawerTop: drawer.top,
      drawerBottom: drawer.bottom,
      activityBodyHeight: body.height,
      layoutVisibility: getComputedStyle(
        document.querySelector('.pixel-town-layout')!,
      ).visibility,
    };
  });

  expect(geometry.layoutVisibility).toBe('visible');
  expect(geometry.stageHeight).toBeGreaterThanOrEqual(220);
  expect(geometry.layoutBottom).toBeLessThanOrEqual(geometry.drawerTop);
  expect(geometry.drawerBottom).toBeLessThanOrEqual(844);
  expect(geometry.activityBodyHeight).toBeGreaterThan(0);
  await expectNoDocumentOverflow(page);
});

test('short landscape switches to the approved panel-first inspector', async ({ page }) => {
  await loadTown(page, 667, 375);
  await enterImmersive(page);
  await page
    .locator('.pixel-hud-dock')
    .getByRole('button', { name: 'Agent Talk', exact: true })
    .click();

  const geometry = await page.evaluate(() => {
    const drawer = document.querySelector('.pixel-hud-drawer')!.getBoundingClientRect();
    const activityBody = document.querySelector(
      '.pixel-hud-drawer .pixel-activity-body:not([hidden])',
    )!;
    return {
      drawer: {
        top: drawer.top,
        right: drawer.right,
        bottom: drawer.bottom,
        left: drawer.left,
      },
      layoutVisibility: getComputedStyle(
        document.querySelector('.pixel-town-layout')!,
      ).visibility,
      dockVisibility: getComputedStyle(document.querySelector('.pixel-hud-dock')!).visibility,
      activityClientHeight: activityBody.clientHeight,
      activityScrollHeight: activityBody.scrollHeight,
    };
  });

  expect(geometry.layoutVisibility).toBe('hidden');
  expect(geometry.dockVisibility).toBe('hidden');
  expect(geometry.drawer.top).toBeLessThanOrEqual(10);
  expect(geometry.drawer.left).toBeLessThanOrEqual(10);
  expect(geometry.drawer.right).toBeGreaterThanOrEqual(657);
  expect(geometry.drawer.bottom).toBeGreaterThanOrEqual(365);
  expect(geometry.activityClientHeight).toBeGreaterThan(0);
  expect(geometry.activityScrollHeight).toBeGreaterThanOrEqual(geometry.activityClientHeight);
  await expectNoDocumentOverflow(page);
});

test('wide landscape help and Create ME dialogs stay inside the dynamic viewport', async ({
  page,
}) => {
  await loadTown(page, 667, 375);
  await enterImmersive(page);

  await page.locator('button:visible').filter({ hasText: 'Help' }).first().click();
  const help = page.getByRole('dialog', { name: 'Read the market as a town' });
  await expect(help).toBeVisible();
  const helpGeometry = await help.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    };
  });
  expect(helpGeometry.top).toBeGreaterThanOrEqual(0);
  expect(helpGeometry.bottom).toBeLessThanOrEqual(375);
  expect(helpGeometry.scrollHeight).toBeGreaterThan(helpGeometry.clientHeight);
  expect(helpGeometry.overflowY).toBe('auto');
  await page.getByRole('button', { name: 'Close help' }).click();

  await page.locator('.pixel-create-me-trigger').click();
  const createMe = page.getByRole('dialog', { name: 'CREATE CHARACTER' });
  await expect(createMe).toBeVisible();
  const createGeometry = await createMe.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const content = element.querySelector('.create-me-content')!;
    return {
      top: rect.top,
      bottom: rect.bottom,
      contentClientHeight: content.clientHeight,
      contentScrollHeight: content.scrollHeight,
      contentOverflowY: getComputedStyle(content).overflowY,
    };
  });
  expect(createGeometry.top).toBeGreaterThanOrEqual(0);
  expect(createGeometry.bottom).toBeLessThanOrEqual(375);
  expect(createGeometry.contentScrollHeight).toBeGreaterThan(createGeometry.contentClientHeight);
  expect(createGeometry.contentOverflowY).toBe('auto');
});

for (const viewport of [
  { name: 'phone portrait', width: 390, height: 844 },
  { name: 'small breakpoint', width: 640, height: 800 },
  { name: 'tablet portrait', width: 768, height: 1024 },
  { name: 'tablet landscape', width: 1024, height: 768 },
  { name: 'compact upper boundary', width: 1100, height: 800 },
] as const) {
  test(`Create ME and replay controls stay usable at ${viewport.name}`, async ({ page }) => {
    await loadTown(page, viewport.width, viewport.height);
    await expectCompactReplayControls(page);
    await expectNoDocumentOverflow(page);

    const rowsDoNotOverlap = await page.evaluate(() => {
      const actions = document.querySelector('.pixel-header-actions')!.getBoundingClientRect();
      const replay = document.querySelector('.pixel-compact-replay')!.getBoundingClientRect();
      return actions.bottom <= replay.top + 1;
    });
    expect(rowsDoNotOverlap).toBe(true);
  });
}

test('desktop retains the complete replay controls above the compact replay breakpoint', async ({
  page,
}) => {
  await loadTown(page, 1321, 800);
  await expect(page.locator('.pixel-compact-replay')).toBeHidden();
  await expect(page.locator('.pixel-replay-status-controls')).toBeVisible();
  await expect(page.locator('.pixel-replay-status-controls select')).toBeVisible();
  await expect(page.locator('.pixel-create-me-label-full')).toBeVisible();
  await expect(page.locator('.pixel-create-me-label-compact')).toBeHidden();
  await expectNoDocumentOverflow(page);
});

test('short landscape keeps compact replay controls in the single header row', async ({
  page,
}) => {
  await loadTown(page, 667, 375);
  await expectCompactReplayControls(page);

  const geometry = await page.evaluate(() => {
    const header = document.querySelector('.pixel-town-header')!.getBoundingClientRect();
    const actions = document.querySelector('.pixel-header-actions')!.getBoundingClientRect();
    const replay = document.querySelector('.pixel-compact-replay')!.getBoundingClientRect();
    return {
      actionsWithinHeader: actions.top >= header.top && actions.bottom <= header.bottom,
      replayWithinHeader: replay.top >= header.top && replay.bottom <= header.bottom,
      horizontallySeparated: replay.right <= actions.left + 1,
    };
  });
  expect(geometry.actionsWithinHeader).toBe(true);
  expect(geometry.replayWithinHeader).toBe(true);
  expect(geometry.horizontallySeparated).toBe(true);
  await expectNoDocumentOverflow(page);
});

for (const width of [640, 641, 720, 721, 1100, 1101, 1320, 1321] as const) {
  test(`existing width boundary ${width}px has no overflow or header overlap`, async ({
    page,
  }) => {
    await loadTown(page, width, 800);
    await expectNoDocumentOverflow(page);

    const overlaps = await page.evaluate(() => {
      const rects = Array.from(document.querySelector('.pixel-town-header')!.children)
        .filter((element) => getComputedStyle(element).display !== 'none')
        .map((element) => element.getBoundingClientRect());
      return rects.some((rect, index) =>
        rects.slice(index + 1).some(
          (other) =>
            rect.left < other.right - 1 &&
            rect.right > other.left + 1 &&
            rect.top < other.bottom - 1 &&
            rect.bottom > other.top + 1,
        ),
      );
    });
    expect(overlaps).toBe(false);

    const titleFits = await page.locator('.pixel-brand h1').evaluate(
      (title) => title.scrollWidth <= title.clientWidth + 1,
    );
    expect(titleFits).toBe(true);
  });
}

for (const width of [720, 721] as const) {
  test(`short landscape remains panel-first at ${width}px`, async ({ page }) => {
    await loadTown(page, width, 390);
    await enterImmersive(page);
    await page
      .locator('.pixel-hud-dock')
      .getByRole('button', { name: 'Agent Talk', exact: true })
      .click();
    await expect(page.locator('.pixel-town-layout')).toHaveCSS('visibility', 'hidden');
    const drawer = await page.locator('.pixel-hud-drawer').boundingBox();
    expect(drawer).not.toBeNull();
    expect(drawer!.y).toBeLessThanOrEqual(10);
    expect(drawer!.height).toBeGreaterThanOrEqual(370);
  });
}
