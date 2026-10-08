import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { useCursorStatus } from '../registry/cursor-status/use-cursor-status';
import type { CursorStatus } from '../src/cursor-status';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Its own file, so <cursor-status> is guaranteed undefined until the test defines it.
it('queues helper calls until <cursor-status> is defined', async () => {
  let status!: ReturnType<typeof useCursorStatus>;
  function Demo() {
    status = useCursorStatus();
    return <cursor-status ref={status.ref} />;
  }
  const host = document.createElement('div');
  document.body.append(host);
  await act(async () => createRoot(host).render(<Demo />));
  const el = host.querySelector('cursor-status') as CursorStatus;

  expect(customElements.get('cursor-status')).toBeUndefined();
  status.flash('Copied'); // would throw "el.flash is not a function" if called through directly
  expect(el.getAttribute('label')).toBeNull();

  await import('../src/define');
  await new Promise((r) => setTimeout(r, 0));
  expect([el.kind, el.label]).toEqual(['success', 'Copied']);
});
