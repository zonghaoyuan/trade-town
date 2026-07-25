export const SUPPORTED_LOCALES = ['en', 'zh-CN'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_STORAGE_KEY = 'trade-town.locale';

export type LocaleStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && SUPPORTED_LOCALES.includes(value as Locale);
}

export function detectBrowserLocale(languages: readonly string[] | undefined): Locale {
  for (const language of languages ?? []) {
    if (language.toLowerCase().startsWith('zh')) return 'zh-CN';
  }
  return DEFAULT_LOCALE;
}

export function resolveLocale({
  storedLocale,
  browserLanguages,
}: {
  storedLocale?: unknown;
  browserLanguages?: readonly string[];
}): Locale {
  if (isSupportedLocale(storedLocale)) return storedLocale;
  return detectBrowserLocale(browserLanguages);
}

export function intlLocale(locale: Locale) {
  return locale === 'zh-CN' ? 'zh-CN' : 'en-US';
}

export function readStoredLocale(storage: LocaleStorage | undefined): unknown {
  if (!storage) return undefined;
  try {
    return storage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return undefined;
  }
}

export function persistLocale(storage: LocaleStorage | undefined, locale: Locale) {
  if (!storage) return false;
  try {
    storage.setItem(LOCALE_STORAGE_KEY, locale);
    return true;
  } catch {
    return false;
  }
}
