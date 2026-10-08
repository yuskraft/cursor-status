import type { CursorStatus } from '@yuskraft/cursor-status';

export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export function statusOf(tile: Element): CursorStatus {
  return tile.querySelector('cursor-status')!;
}

export function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * Keyboard use has no pointer to follow: pin the pill next to the focused control, then hand it
 * back to the pointer as soon as the mouse moves again.
 */
export function anchor(status: CursorStatus, el: Element) {
  const r = el.getBoundingClientRect();
  status.follow = 'manual';
  status.moveTo(r.left + r.width / 2, r.top + r.height / 2);
  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'mouse') status.follow = 'pointer';
    },
    { once: true, capture: true },
  );
}

export async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      // nothing left to try
    }
    ta.remove();
    return ok;
  }
}

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
