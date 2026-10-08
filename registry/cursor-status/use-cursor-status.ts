'use client';

import type { CursorStatus, CursorStatusOptions } from '@yuskraft/cursor-status';
import * as React from 'react';

/**
 * A ref for `<CursorStatus>` plus helpers that call through to it. The returned object and its
 * helpers never change identity, so they're safe in effect dependencies and event handlers.
 *
 * The element is defined lazily (after hydration), so calls made before that wait for it.
 */
export function useCursorStatus() {
  const ref = React.useRef<CursorStatus>(null);

  return React.useMemo(() => {
    const call = (fn: (el: CursorStatus) => void) => {
      const el = ref.current;
      if (!el) return;
      if (customElements.get('cursor-status')) fn(el);
      else void customElements.whenDefined('cursor-status').then(() => fn(el));
    };

    return {
      ref,
      show: (label: string, opts?: CursorStatusOptions) => call((el) => el.show(label, opts)),
      info: (label: string, opts?: CursorStatusOptions) => call((el) => el.info(label, opts)),
      error: (label: string, opts?: CursorStatusOptions) => call((el) => el.error(label, opts)),
      success: (label?: string, opts?: CursorStatusOptions) =>
        call((el) => el.success(label, opts)),
      flash: (label: string, opts?: CursorStatusOptions) => call((el) => el.flash(label, opts)),
      hide: (opts?: { delay?: number }) => call((el) => el.hide(opts)),
      moveTo: (x: number, y: number) => call((el) => el.moveTo(x, y)),
      /** Ring fill, 0–1; springs smoothly. Fine to call every frame. */
      setProgress: (value: number) =>
        call((el) => {
          el.progress = value;
        }),
      announce: (text: string) => call((el) => el.announce(text)),
    };
  }, []);
}
