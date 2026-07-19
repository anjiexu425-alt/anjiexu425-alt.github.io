export function computeRingPositions(labels, radius) {
  const count = labels.length;
  return labels.map((label, i) => {
    const angleDeg = (360 / count) * i - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = radius * Math.cos(angleRad);
    const y = radius * Math.sin(angleRad);
    const rotateDeg = angleDeg + 90;
    return { label, angleDeg, x, y, rotateDeg };
  });
}
