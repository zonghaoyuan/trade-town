import { CSSProperties } from 'react';

const spriteSlots = [0, 3, 5, 2, 6, 1, 7, 4, 0, 3];

export default function PixelAvatar({ index }: { index: number }) {
  const slot = spriteSlots[index % spriteSlots.length];
  const x = (slot % 4) * 96;
  const y = Math.floor(slot / 4) * 128;
  const style = {
    '--sprite-x': `${-x}px`,
    '--sprite-y': `${-y}px`,
  } as CSSProperties;

  return (
    <span className="pixel-agent-avatar" aria-hidden="true">
      <i style={style} />
    </span>
  );
}
