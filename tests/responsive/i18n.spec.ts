import { expect, test } from '@playwright/test';

const localeStorageKey = 'trade-town.locale.v2';

test('defaults to English even when the browser language is Chinese', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      get: () => 'zh-CN',
    });
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      get: () => ['zh-CN', 'zh'],
    });
  });

  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Markets', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Switch to Chinese' })).toBeVisible();
});

test('switches locale, persists it across reloads, and stays available on mobile', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  const languageSwitcher = page.getByRole('button', { name: 'Switch to Chinese' });
  await expect(languageSwitcher).toHaveAttribute('data-target-locale', 'zh-CN');
  await languageSwitcher.click();

  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('heading', { name: '市场', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '切换至英文' })).toHaveAttribute(
    'data-target-locale',
    'en',
  );
  await expect
    .poll(() => page.evaluate((key) => window.localStorage.getItem(key), localeStorageKey))
    .toBe('zh-CN');

  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });

  const mobileLanguageSwitcher = page.getByRole('button', { name: '切换至英文' });
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(mobileLanguageSwitcher).toBeVisible();

  await mobileLanguageSwitcher.click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Switch to Chinese' })).toHaveAttribute(
    'data-target-locale',
    'zh-CN',
  );
  await expect
    .poll(() => page.evaluate((key) => window.localStorage.getItem(key), localeStorageKey))
    .toBe('en');
});
