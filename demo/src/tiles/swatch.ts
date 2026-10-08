import { anchor, copy, statusOf } from '../util';

/** The one-click case, as a contrast: a flash at the pointer, and a check on the swatch itself. */
export function swatch(tile: HTMLElement) {
  const status = statusOf(tile);
  for (const sw of tile.querySelectorAll<HTMLButtonElement>('.sw')) {
    let timer = 0;
    sw.addEventListener('click', async (e) => {
      const hex = sw.dataset.hex!;
      const ok = await copy(hex);
      if (e.detail === 0) anchor(status, sw); // keyboard: no pointer to follow
      if (!ok) return status.flash('Copy blocked', { kind: 'error' });
      status.flash(`Copied ${hex}`);
      sw.classList.add('copied');
      clearTimeout(timer);
      timer = window.setTimeout(() => sw.classList.remove('copied'), 1200);
    });
  }
}
