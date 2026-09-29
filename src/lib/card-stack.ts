/**
 * Selection for the homepage card fan. Each card owns a stable band along the
 * stack's x-axis, taken from its resting (untransformed) position, so the
 * cards moving during a fan transition can never steal the pointer. The active
 * card is kept while the pointer stays within `hysteresis` px of its band.
 */
export type CardBand = { start: number; end: number };

export function pickCardBand(bands: readonly CardBand[], x: number, current: number | null, hysteresis: number): number | null {
  if (!bands.length) return null;
  if (current !== null && bands[current] && x >= bands[current].start - hysteresis && x < bands[current].end + hysteresis) return current;
  for (let index = 0; index < bands.length; index++) {
    if (x >= bands[index].start && x < bands[index].end) return index;
  }
  // Beyond either end of the stack the nearest card stays reachable.
  return x < bands[0].start ? 0 : bands.length - 1;
}

/** Bands from resting left edges (sorted by visual position) and the last card's right edge. */
export function cardBands(lefts: readonly number[], lastRight: number): CardBand[] {
  return lefts.map((start, index) => ({ start, end: index + 1 < lefts.length ? lefts[index + 1] : lastRight }));
}
