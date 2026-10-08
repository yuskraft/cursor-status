import { anchor, clamp, statusOf } from '../util';

const MIN_W = 60;
const MIN_H = 40;

/** Drag the handle: live "240 × 160"; hold Shift to keep the ratio. */
export function resize(tile: HTMLElement) {
  const status = statusOf(tile);
  const stage = tile.querySelector<HTMLElement>('.stage')!;
  const box = tile.querySelector<HTMLElement>('.box')!;
  const dims = tile.querySelector<HTMLElement>('.dims')!;
  const handle = tile.querySelector<HTMLButtonElement>('.handle')!;
  let w = 200;
  let h = 120;
  let start: { x: number; y: number; w: number; h: number } | null = null;
  let last = { x: 0, y: 0 };
  let shift = false;
  let idle = 0;

  const text = (keep: boolean) => (keep ? `Keep ratio · ${w} × ${h}` : `${w} × ${h}`);

  function set(nw: number, nh: number, keep: boolean, ratio = w / h) {
    const maxW = stage.clientWidth - 36;
    const maxH = stage.clientHeight - 68;
    if (keep) {
      w = Math.round(clamp(nw, Math.max(MIN_W, MIN_H * ratio), Math.min(maxW, maxH * ratio)));
      h = Math.round(w / ratio);
    } else {
      w = Math.round(clamp(nw, MIN_W, maxW));
      h = Math.round(clamp(nh, MIN_H, maxH));
    }
    box.style.width = `${w}px`;
    box.style.height = `${h}px`;
    dims.textContent = `${w} × ${h}`;
  }

  function drag() {
    if (!start) return;
    const ratio = start.w / start.h;
    let nw = start.w + last.x - start.x;
    const nh = start.h + last.y - start.y;
    // keep ratio: follow whichever axis moved further
    if (shift && Math.abs(nw - start.w) / start.w < Math.abs(nh - start.h) / start.h)
      nw = nh * ratio;
    set(nw, nh, shift, ratio);
    status.info(text(shift));
  }

  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    start = { x: e.clientX, y: e.clientY, w, h };
    last = { x: e.clientX, y: e.clientY };
    shift = e.shiftKey;
    status.info(text(shift));
  });
  handle.addEventListener('pointermove', (e) => {
    if (!start) return;
    last = { x: e.clientX, y: e.clientY };
    shift = e.shiftKey;
    drag();
  });
  handle.addEventListener('lostpointercapture', () => {
    start = null;
    status.hide({ delay: 450 });
  });
  // Pressing or releasing Shift mid-drag changes the mode without moving.
  for (const type of ['keydown', 'keyup'] as const) {
    window.addEventListener(type, (e) => {
      if (start && e.key === 'Shift' && shift !== e.shiftKey) {
        shift = e.shiftKey;
        drag();
      }
    });
  }

  handle.addEventListener('keydown', (e) => {
    const step = e.altKey ? 1 : 10;
    const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
    const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    if (e.shiftKey) set(w + (dx || dy * (w / h)), 0, true);
    else set(w + dx, h + dy, false);
    anchor(status, handle);
    status.info(text(e.shiftKey));
    status.announce(`${w} by ${h}`); // each key press is a result of its own
    clearTimeout(idle);
    idle = window.setTimeout(() => status.hide(), 900);
  });
}
