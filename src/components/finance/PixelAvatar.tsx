import { CSSProperties } from 'react';

export default function PixelAvatar({ index }: { index: number }) {
  const slot = Math.abs(index) % 10;
  const style = {
    '--sprite-x': `${-slot * 32}px`,
  } as CSSProperties;

  return (
    <span className="pixel-agent-avatar" aria-hidden="true">
      <i style={style} />
    </span>
  );
}
