import { previewDashboard } from '../../finance/demoData';
import { CSSProperties } from 'react';
import type { FocusedTownCitizen } from './TradeTownShell';
import PixelAvatar from './PixelAvatar';
import { useI18n } from '../../i18n';

const positions = [
  [18, 28],
  [32, 44],
  [48, 25],
  [65, 38],
  [78, 20],
  [23, 67],
  [44, 72],
  [68, 69],
  [38, 54],
  [81, 57],
];

export default function TownPreview({
  focusedCitizen = null,
  hudInspectorOpen = false,
}: {
  focusedCitizen?: FocusedTownCitizen | null;
  hudInspectorOpen?: boolean;
}) {
  const { t, formatNumber } = useI18n();
  const focusedIndex = focusedCitizen
    ? previewDashboard.traders.findIndex((trader) => trader.name === focusedCitizen.name)
    : -1;
  const focusedPosition = focusedIndex >= 0 ? positions[focusedIndex] : undefined;

  return (
    <div
      className="town-preview"
      aria-label={t('preview.aria')}
      data-hud-inspector-open={hudInspectorOpen}
    >
      <div className="preview-grid" aria-hidden="true" />
      <div className="exchange-building">
        <span>INJ</span>
        <strong>{t('preview.exchange')}</strong>
      </div>
      <div className="town-building building-bank">{t('preview.bank')}</div>
      <div className="town-building building-news">{t('preview.news')}</div>
      <div className="town-building building-fund">{t('preview.fund')}</div>
      {previewDashboard.traders.map((trader, index) => (
        <div
          className={`preview-agent ${trader.kind === 'market_maker' ? 'preview-mm' : ''}`}
          style={{ left: `${positions[index][0]}%`, top: `${positions[index][1]}%` }}
          key={trader.name}
        >
          <span>{trader.name.slice(0, 1)}</span>
          <small>{trader.name}</small>
        </div>
      ))}
      {focusedCitizen && focusedPosition && (
        <aside
          className="pixel-map-agent"
          aria-live="polite"
          style={
            {
              '--map-agent-x': `${focusedPosition[0]}%`,
              '--map-agent-y': `${focusedPosition[1]}%`,
            } as CSSProperties
          }
        >
          <PixelAvatar index={focusedCitizen.avatarIndex} />
          <span>
            <strong>{focusedCitizen.name}</strong>
            <small>{focusedCitizen.role}</small>
            <em className={focusedCitizen.pnl >= 0 ? 'pixel-up' : 'pixel-down'}>
              {t('game.pnl', {
                value: formatSignedCompact(focusedCitizen.pnl, formatNumber),
              })}
            </em>
          </span>
        </aside>
      )}
      <div className="preview-conversation">
        <strong>MIRA</strong>
        “75 bps changes ACME's refinancing math.”
      </div>
      <div className="preview-mode-note">{t('preview.missingConvex')}</div>
    </div>
  );
}

function formatSignedCompact(
  value: number,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
) {
  const formatted = formatNumber(value, {
    notation: 'compact',
    maximumFractionDigits: 1,
    signDisplay: 'always',
  });
  return `${formatted} TOWNUSD`;
}
