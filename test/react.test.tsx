import { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CursorStatus } from '../registry/cursor-status/cursor-status';
import { useCursorStatus } from '../registry/cursor-status/use-cursor-status';
import type { CursorStatus as CursorStatusElement } from '../src/cursor-status';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => new Promise((r) => setTimeout(r, 0));

async function render(node: React.ReactNode) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(node));
  return { host, root };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('<CursorStatus> (shadcn registry)', () => {
  it('renders <cursor-status> with its attributes and forwards the ref', async () => {
    const ref = createRef<CursorStatusElement>();
    const { host } = await render(
      <CursorStatus
        ref={ref}
        scope="#area"
        placement="top-start"
        offset="10 12"
        linger={800}
        follow="manual"
        theme="light"
        motion="reduce"
        className="pill"
      />,
    );
    const el = host.querySelector('cursor-status')!;
    expect(ref.current).toBe(el);
    for (const [name, value] of [
      ['scope', '#area'],
      ['placement', 'top-start'],
      ['offset', '10 12'],
      ['linger', '800'],
      ['follow', 'manual'],
      ['theme', 'light'],
      ['motion', 'reduce'],
      ['class', 'pill'],
    ]) {
      expect(el.getAttribute(name!)).toBe(value);
    }
  });

  it('defines the element after mount, so it upgrades', async () => {
    const ref = createRef<CursorStatusElement>();
    await render(<CursorStatus ref={ref} />);
    await customElements.whenDefined('cursor-status');
    expect(typeof ref.current!.show).toBe('function');
    expect(ref.current!.shadowRoot).not.toBeNull();
  });
});

describe('useCursorStatus', () => {
  it('returns stable helpers that drive the element', async () => {
    const seen: ReturnType<typeof useCursorStatus>[] = [];
    function Demo({ n }: { n: number }) {
      const status = useCursorStatus();
      seen.push(status);
      return <CursorStatus ref={status.ref} data-n={n} />;
    }
    const { root, host } = await render(<Demo n={1} />);
    await act(async () => root.render(<Demo n={2} />));
    expect(seen[0]).toBe(seen[1]);
    expect(seen[0]!.show).toBe(seen[1]!.show);

    const status = seen[0]!;
    const el = host.querySelector('cursor-status') as CursorStatusElement;
    await customElements.whenDefined('cursor-status');
    status.show('Removing 3 files', { kind: 'progress', dots: true });
    status.setProgress(0.5);
    await flush();
    expect([el.open, el.kind, el.label, el.progress, el.dots]).toEqual([
      true,
      'progress',
      'Removing 3 files',
      0.5,
      true,
    ]);
    status.success('Removed 3 files');
    expect([el.kind, el.label]).toEqual(['success', 'Removed 3 files']);
    status.hide();
    await new Promise((r) => setTimeout(r, 10));
    expect(el.open).toBe(false);
  });
});
