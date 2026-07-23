import { previewDashboard } from '../../finance/demoData';

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

export default function TownPreview() {
  return (
    <div className="town-preview" aria-label="Trade Town preview">
      <div className="preview-grid" aria-hidden="true" />
      <div className="exchange-building">
        <span>INJ</span>
        <strong>EXCHANGE</strong>
      </div>
      <div className="town-building building-bank">BANK</div>
      <div className="town-building building-news">NEWS</div>
      <div className="town-building building-fund">FUND</div>
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
      <div className="preview-conversation">
        <strong>MIRA</strong>
        “75 bps changes ACME's refinancing math.”
      </div>
      <div className="preview-mode-note">ADD VITE_CONVEX_URL TO LOAD THE LIVE PIXI TOWN</div>
    </div>
  );
}
