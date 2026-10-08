import { describe, expect, it } from 'vitest';
import { place } from '../src/cursor-status';

// pill 120×34 in a 1000×800 viewport, default offset
const box = [120, 34, 1000, 800];
const offset = [18, 20];
const at = (x: number, y: number, placement = 'bottom-end', rtl = false, touch = false) =>
  place(x, y, placement, offset, rtl, touch, box);

describe('place', () => {
  it('sits below and after the cursor by default', () => {
    expect(at(300, 300)).toEqual([318, 320, 1, 1]);
  });

  it('supports each placement', () => {
    expect(at(300, 300, 'bottom-start')).toEqual([282, 320, -1, 1]);
    expect(at(300, 300, 'top-end')).toEqual([318, 280, 1, -1]);
    expect(at(300, 300, 'top-start')).toEqual([282, 280, -1, -1]);
  });

  it('treats start and end as logical, so RTL mirrors them', () => {
    expect(at(300, 300, 'bottom-end', true)).toEqual([282, 320, -1, 1]);
    expect(at(300, 300, 'bottom-start', true)).toEqual([318, 320, 1, 1]);
  });

  it('flips to the other side of the cursor near the right edge instead of squashing', () => {
    expect(at(900, 300)).toEqual([882, 320, -1, 1]);
  });

  it('flips above the cursor near the bottom edge', () => {
    expect(at(300, 780)).toEqual([318, 760, 1, -1]);
  });

  it('flips back from start to end near the left edge', () => {
    expect(at(50, 300, 'bottom-start')).toEqual([68, 320, 1, 1]);
  });

  it('clamps 8px inside the viewport', () => {
    const [x, y] = at(-50, -50);
    expect(x).toBe(8);
    expect(y).toBe(8);
  });

  it('on touch, sits centred about 78px above the finger', () => {
    const [x, y, sx, sy] = at(300, 300, 'bottom-end', false, true);
    expect([x, sx, sy]).toEqual([300, 0, -1]);
    // anchor is the pill's bottom edge: centre = y - 34 / 2
    expect(y - 17).toBe(300 - 78);
  });

  it('keeps a touch pill on screen', () => {
    const [x, y] = at(5, 10, 'bottom-end', false, true);
    expect(x).toBe(8 + 60);
    expect(y).toBe(8 + 34);
  });
});
