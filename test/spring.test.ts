import { describe, expect, it } from 'vitest';
import { spring } from '../src/cursor-status';

function run(x: number, v: number, target: number, omega: number, dt: number, steps: number) {
  const path: number[] = [];
  for (let i = 0; i < steps; i++) {
    [x, v] = spring(x, v, target, omega, dt);
    path.push(x);
  }
  return { x, v, path };
}

describe('spring', () => {
  it('converges on the target', () => {
    const { x, v } = run(0, 0, 100, 16, 1 / 60, 120);
    expect(x).toBeCloseTo(100, 3);
    expect(v).toBeCloseTo(0, 3);
  });

  it('is critically damped: approaches from rest without overshooting', () => {
    const { path } = run(0, 0, 100, 16, 1 / 60, 240);
    for (let i = 1; i < path.length; i++) {
      expect(path[i]).toBeGreaterThanOrEqual(path[i - 1]!);
      expect(path[i]).toBeLessThanOrEqual(100 + 1e-9);
    }
  });

  it('settles in about a third of a second at ω = 16 (attached, not floaty)', () => {
    const { path } = run(0, 0, 100, 16, 1 / 60, 60);
    const frame = path.findIndex((x) => x > 95);
    expect(frame).toBeGreaterThan(5);
    expect(frame).toBeLessThan(25);
  });

  it('gives the same curve at 60 and 120 Hz', () => {
    const at60 = run(0, 0, 100, 16, 1 / 60, 15).x;
    const at120 = run(0, 0, 100, 16, 1 / 120, 30).x;
    expect(Math.abs(at60 - at120)).toBeLessThan(3);
  });

  it('stays stable at huge frame times', () => {
    for (const dt of [0.1, 1, 10]) {
      const { x, path } = run(0, 0, 100, 22, dt, 20);
      expect(Number.isFinite(x)).toBe(true);
      expect(Math.max(...path)).toBeLessThanOrEqual(100 + 1e-9);
      expect(x).toBeCloseTo(100, 1);
    }
  });

  it('stays put at the target', () => {
    expect(spring(5, 0, 5, 16, 1 / 60)).toEqual([5, 0]);
  });
});
