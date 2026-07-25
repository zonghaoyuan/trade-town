import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_LOCALE,
  intlLocale,
  Locale,
  persistLocale,
  readStoredLocale,
  resolveLocale,
} from './locale';
import { MessageKey, MessageVariables, translate } from './messages';

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, variables?: MessageVariables) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDateTime: (
    value: Date | number | string,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
};

const defaultValue: I18nContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
  t: (key, variables) => translate(DEFAULT_LOCALE, key, variables),
  formatNumber: (value, options) =>
    new Intl.NumberFormat(intlLocale(DEFAULT_LOCALE), options).format(value),
  formatDateTime: (value, options) =>
    new Intl.DateTimeFormat(intlLocale(DEFAULT_LOCALE), options).format(
      typeof value === 'string' ? new Date(value) : value,
    ),
};

const I18nContext = createContext<I18nContextValue>(defaultValue);

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function initialLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const storedLocale = readStoredLocale(browserStorage());
  return resolveLocale({ storedLocale });
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    persistLocale(browserStorage(), locale);
  }, [locale]);

  const t = useCallback(
    (key: MessageKey, variables?: MessageVariables) => translate(locale, key, variables),
    [locale],
  );
  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(intlLocale(locale), options).format(value),
    [locale],
  );
  const formatDateTime = useCallback(
    (value: Date | number | string, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(intlLocale(locale), options).format(
        typeof value === 'string' ? new Date(value) : value,
      ),
    [locale],
  );
  const value = useMemo(
    () => ({ locale, setLocale, t, formatNumber, formatDateTime }),
    [formatDateTime, formatNumber, locale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export type { Locale, MessageKey };
