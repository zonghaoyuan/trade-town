import {
  DEFAULT_LOCALE,
  detectBrowserLocale,
  intlLocale,
  isSupportedLocale,
  persistLocale,
  readStoredLocale,
  resolveLocale,
} from './locale';
import { en, interpolate, translate, zhCN } from './messages';

describe('product localization', () => {
  test('detects Chinese browser variants and defaults other languages to English', () => {
    expect(detectBrowserLocale(['zh-HK', 'en-US'])).toBe('zh-CN');
    expect(detectBrowserLocale(['fr-FR', 'en-US'])).toBe('en');
    expect(detectBrowserLocale(undefined)).toBe(DEFAULT_LOCALE);
  });

  test('a valid stored choice wins and invalid state falls back to browser detection', () => {
    expect(resolveLocale({ storedLocale: 'en', browserLanguages: ['zh-CN'] })).toBe('en');
    expect(resolveLocale({ storedLocale: 'zh-CN', browserLanguages: ['en-US'] })).toBe(
      'zh-CN',
    );
    expect(resolveLocale({ storedLocale: 'de', browserLanguages: ['zh-TW'] })).toBe(
      'zh-CN',
    );
    expect(isSupportedLocale(null)).toBe(false);
  });

  test('English and Chinese catalogs have identical keys', () => {
    expect(Object.keys(zhCN).sort()).toEqual(Object.keys(en).sort());
  });

  test('interpolates named values and leaves missing variables visible', () => {
    expect(interpolate('{current}/{total}', { current: 2, total: 30 })).toBe('2/30');
    expect(interpolate('{current}/{total}', { current: 2 })).toBe('2/{total}');
    expect(translate('zh-CN', 'common.records', { count: 8 })).toBe('8 条记录');
  });

  test('maps supported locales to Intl locales', () => {
    expect(intlLocale('en')).toBe('en-US');
    expect(intlLocale('zh-CN')).toBe('zh-CN');
  });

  test('persists a valid locale and survives denied storage access', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    expect(persistLocale(storage, 'zh-CN')).toBe(true);
    expect(readStoredLocale(storage)).toBe('zh-CN');

    const denied = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(readStoredLocale(denied)).toBeUndefined();
    expect(persistLocale(denied, 'en')).toBe(false);
  });
});
