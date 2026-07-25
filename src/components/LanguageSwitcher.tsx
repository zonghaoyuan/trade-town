import { useI18n } from '../i18n';

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const nextLocale = locale === 'en' ? 'zh-CN' : 'en';
  const label =
    nextLocale === 'zh-CN'
      ? t('language.switchToChinese')
      : t('language.switchToEnglish');

  return (
    <button
      type="button"
      className="pixel-language-switcher"
      data-target-locale={nextLocale}
      aria-label={label}
      title={label}
      onClick={() => setLocale(nextLocale)}
    >
      <span
        className="pixel-language-glyph"
        lang={nextLocale}
        aria-hidden="true"
      >
        {nextLocale === 'zh-CN'
          ? t('language.chineseShort')
          : t('language.englishShort')}
      </span>
    </button>
  );
}
