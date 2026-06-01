export interface LyricLineLayout {
  index: number;
  top: number;
  height: number;
}

export interface TextOnlyLyricScrollAnchor {
  anchorLineIndex: number;
  anchorRatio: number;
}

export interface TextOnlyLyricScrollPayload {
  scrollTop: number;
  anchorLineIndex?: number;
  anchorRatio?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function createTextOnlyLyricScrollAnchor({
  lineLayouts,
  scrollTop,
  viewportHeight,
}: {
  lineLayouts: LyricLineLayout[];
  scrollTop: number;
  viewportHeight: number;
}): TextOnlyLyricScrollAnchor | null {
  if (lineLayouts.length === 0 || viewportHeight <= 0) return null;

  const viewportCenter = scrollTop + viewportHeight / 2;
  let nearestLine: LyricLineLayout | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const layout of lineLayouts) {
    if (layout.height <= 0) continue;

    const lineCenter = layout.top + layout.height / 2;
    const distance = Math.abs(lineCenter - viewportCenter);
    if (distance < nearestDistance) {
      nearestLine = layout;
      nearestDistance = distance;
    }
  }

  if (!nearestLine) return null;

  return {
    anchorLineIndex: nearestLine.index,
    anchorRatio: clamp((viewportCenter - nearestLine.top) / nearestLine.height, 0, 1),
  };
}

export function resolveScrollTopForTextOnlyLyricAnchor({
  anchor,
  lineLayouts,
  viewportHeight,
  maxScrollTop,
}: {
  anchor: TextOnlyLyricScrollAnchor | null;
  lineLayouts: LyricLineLayout[];
  viewportHeight: number;
  maxScrollTop: number;
}): number | null {
  if (!anchor || viewportHeight <= 0) return null;

  const layout = lineLayouts.find((line) => line.index === anchor.anchorLineIndex);
  if (!layout || layout.height <= 0) return null;

  const targetPoint = layout.top + layout.height * clamp(anchor.anchorRatio, 0, 1);
  return clamp(targetPoint - viewportHeight / 2, 0, Math.max(0, maxScrollTop));
}
