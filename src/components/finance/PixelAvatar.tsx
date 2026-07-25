import { CSSProperties } from 'react';

export default function PixelAvatar({
  index,
  textureUrl,
}: {
  index: number;
  textureUrl?: string;
}) {
  const slot = Math.abs(index) % 10;
  const style = textureUrl
    ? ({
        backgroundImage: `url("${textureUrl}")`,
        backgroundPosition: '-32px -64px',
        backgroundSize: '288px 128px',
      } as CSSProperties)
    : ({ '--sprite-x': `${-slot * 32}px` } as CSSProperties);

  return (
    <span className="pixel-agent-avatar" aria-hidden="true">
      <i style={style} />
    </span>
  );
}
