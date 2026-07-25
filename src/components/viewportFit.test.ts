import { getMapContainScale } from './viewportFit';

describe('getMapContainScale', () => {
  it.each([
    { screenWidth: 976, screenHeight: 696 },
    { screenWidth: 660, screenHeight: 610 },
    { screenWidth: 390, screenHeight: 303 },
  ])('keeps the complete map visible in a $screenWidth × $screenHeight frame', (frame) => {
    const worldWidth = 64 * 32;
    const worldHeight = 48 * 32;
    const scale = getMapContainScale(
      frame.screenWidth,
      frame.screenHeight,
      worldWidth,
      worldHeight,
    );

    expect(worldWidth * scale).toBeLessThanOrEqual(frame.screenWidth);
    expect(worldHeight * scale).toBeLessThanOrEqual(frame.screenHeight);
    expect(
      Math.abs(worldWidth * scale - frame.screenWidth) < 0.001 ||
        Math.abs(worldHeight * scale - frame.screenHeight) < 0.001,
    ).toBe(true);
  });

  it('does not zoom beyond the configured maximum', () => {
    expect(getMapContainScale(4000, 3000, 100, 100, 3)).toBe(3);
  });
});
