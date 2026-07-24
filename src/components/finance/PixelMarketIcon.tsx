import type { CSSProperties, ReactNode } from 'react';

export default function PixelMarketIcon({ symbol, accent }: { symbol: string; accent: string }) {
  const iconName = symbol.toLowerCase().replace(/[^a-z0-9]/g, '');
  const style = {
    '--market-icon-accent': accent,
  } as CSSProperties;

  return (
    <span
      className={`pixel-market-icon pixel-market-icon-${iconName}`}
      style={style}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" shapeRendering="crispEdges">
        {marketGlyph(iconName)}
      </svg>
    </span>
  );
}

function marketGlyph(symbol: string): ReactNode {
  switch (symbol) {
    case 'acme':
      return (
        <>
          <path
            className="pixel-icon-dark"
            d="M12 3h10v3h4v4h3v12h-4v4h-5v3H9v-3H5v-4H3V11h3V7h6z"
          />
          <path
            className="pixel-icon-primary"
            d="M12 6h9v3h4v4h2v8h-4v3h-5v3H10v-3H7v-4H5v-8h3V9h4z"
          />
          <path className="pixel-icon-light" d="M12 8h7v3h-4v4h-4v7H8v-9h4z" />
          <path className="pixel-icon-mid" d="M19 11h5v3h2v6h-4v3h-6v-8h3z" />
        </>
      );
    case 'nova':
      return (
        <>
          <path
            className="pixel-icon-dark"
            d="M13 2h6v8h4v3h7v6h-7v4h-4v7h-6v-7H9v-4H2v-6h7v-3h4z"
          />
          <path
            className="pixel-icon-primary"
            d="M14 4h4v8h4v3h6v3h-6v4h-4v6h-4v-6h-4v-4H4v-3h6v-3h4z"
          />
          <path className="pixel-icon-light" d="M14 11h4v3h3v4h-3v3h-4v-3h-3v-4h3z" />
          <path className="pixel-icon-mid" d="M5 6h3v3H5zm19 17h3v3h-3zM24 6h2v2h-2zM6 24h2v2H6z" />
        </>
      );
    case 'luma':
      return (
        <>
          <path className="pixel-icon-dark" d="M11 3h10v8h8v10h-8v8H11v-8H3V11h8z" />
          <path className="pixel-icon-primary" d="M13 5h6v8h8v6h-8v8h-6v-8H5v-6h8z" />
          <path className="pixel-icon-light" d="M15 7h2v8h8v2h-8v8h-2v-8H7v-2h8z" />
          <path className="pixel-icon-mid" d="M7 7h4v4H7zm14 14h4v4h-4z" />
        </>
      );
    case 'vela':
      return (
        <>
          <path className="pixel-icon-dark" d="M14 2h5v20h9v5H5v-5h5V12h4z" />
          <path className="pixel-icon-primary" d="M16 4v17H7l3-5 2-4 2-4z" />
          <path className="pixel-icon-light" d="M19 7l3 4 3 5 2 5h-8z" />
          <path className="pixel-icon-mid" d="M8 23h17v2H8z" />
        </>
      );
    case 'forge':
      return (
        <>
          <path
            className="pixel-icon-dark"
            d="M12 2h8v4h5v4h4v12h-4v4h-5v4h-8v-4H7v-4H3V10h4V6h5z"
          />
          <path
            className="pixel-icon-primary"
            d="M13 5h6v4h5v4h3v6h-4v4h-4v4h-6v-4H8v-4H5v-6h4V9h4z"
          />
          <path className="pixel-icon-light" d="M12 11h9v4h-3v3h-4v5h-4v-8h2z" />
          <path className="pixel-icon-mid" d="M18 15h4v5h-4z" />
        </>
      );
    case 'aurm':
    case 'aurum':
      return (
        <>
          <path className="pixel-icon-dark" d="M10 5h12v4h5v5h3v9h-5v4H7v-3H2v-9h4v-6h4z" />
          <path className="pixel-icon-primary" d="M11 7h10v4h5v5h2v5h-5v3H8v-3H4v-5h4v-5h3z" />
          <path className="pixel-icon-light" d="M12 9h7v3h-4v3H9v-4h3z" />
          <path className="pixel-icon-mid" d="M18 14h7v6h-4v3h-8v-4h5z" />
        </>
      );
    case 'crude':
      return (
        <>
          <path
            className="pixel-icon-dark"
            d="M14 2h5v5h4v4h4v5h3v8h-4v4h-5v2H10v-2H6v-4H3v-8h4v-5h3V6h4z"
          />
          <path
            className="pixel-icon-primary"
            d="M15 5h3v5h4v4h3v4h2v5h-4v3h-4v2h-8v-3H8v-3H6v-5h4v-5h3V8h2z"
          />
          <path className="pixel-icon-mid" d="M15 12h4v5h3v6h-4v3h-6v-4h-2v-4h3v-3h2z" />
          <path className="pixel-icon-light" d="M15 18h3v3h2v3h-3v2h-4v-4h2z" />
        </>
      );
    default:
      return (
        <>
          <path
            className="pixel-icon-dark"
            d="M12 3h8v4h5v5h4v8h-4v5h-5v4h-8v-4H7v-5H3v-8h4V7h5z"
          />
          <path
            className="pixel-icon-primary"
            d="M13 6h6v4h4v3h3v6h-4v4h-4v3h-5v-3H9v-4H6v-6h3v-3h4z"
          />
          <path className="pixel-icon-light" d="M12 9h6v3h-3v3h-3v7H9v-9h3z" />
        </>
      );
  }
}
