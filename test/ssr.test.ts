// @vitest-environment node
import { describe, expect, it } from 'vitest';

describe('SSR', () => {
  it('imports without a DOM', async () => {
    expect(typeof globalThis.document).toBe('undefined');
    const mod = await import('../src/index');
    expect(typeof mod.CursorStatus).toBe('function');
    expect(typeof mod.spring).toBe('function');
  });

  it('define is a no-op without customElements', async () => {
    await expect(import('../src/define')).resolves.toBeDefined();
  });
});
