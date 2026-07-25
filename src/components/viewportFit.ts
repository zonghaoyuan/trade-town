export function getMapContainScale(
  screenWidth: number,
  screenHeight: number,
  worldWidth: number,
  worldHeight: number,
  maxScale = 3,
) {
  return Math.min(maxScale, screenWidth / worldWidth, screenHeight / worldHeight);
}
