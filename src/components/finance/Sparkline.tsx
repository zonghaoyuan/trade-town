export function Sparkline({
  values,
  color,
  className = '',
}: {
  values: readonly number[];
  color: string;
  className?: string;
}) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 100;
      const y = 28 - ((value - min) / range) * 24;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className={`sparkline ${className}`}
      aria-hidden="true"
    >
      <line x1="0" x2="100" y1="28" y2="28" className="sparkline-baseline" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" />
    </svg>
  );
}
