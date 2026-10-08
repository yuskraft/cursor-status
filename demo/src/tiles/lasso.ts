import { anchor, clamp, statusOf } from '../util';

const DOTS = 48;

/** Drag a marquee over the dot grid: a running count at the corner you're dragging. */
export function lasso(tile: HTMLElement) {
  const status = statusOf(tile);
  const area = tile.querySelector<HTMLElement>('.lasso')!;
  const grid = tile.querySelector<HTMLElement>('.dots')!;
  const marquee = tile.querySelector<HTMLElement>('.marquee')!;
  for (let i = 0; i < DOTS; i++) grid.append(document.createElement('i'));
  const dots = [...grid.children] as HTMLElement[];
  let start: { x: number; y: number; r: DOMRect; centres: [number, number][] } | null = null;
  let moved = false;

  const count = () => dots.filter((d) => d.classList.contains('on')).length;
  const clear = () => {
    for (const d of dots) d.classList.remove('on');
  };

  area.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    area.setPointerCapture(e.pointerId);
    const r = area.getBoundingClientRect();
    // measure once per gesture, not per move
    const centres = dots.map((d) => {
      const b = d.getBoundingClientRect();
      return [b.left - r.left + b.width / 2, b.top - r.top + b.height / 2] as [number, number];
    });
    start = { x: e.clientX - r.left, y: e.clientY - r.top, r, centres };
    moved = false;
  });

  area.addEventListener('pointermove', (e) => {
    if (!start) return;
    const x = clamp(e.clientX - start.r.left, 0, start.r.width);
    const y = clamp(e.clientY - start.r.top, 0, start.r.height);
    if (!moved && Math.hypot(x - start.x, y - start.y) < 4) return;
    moved = true;
    const left = Math.min(x, start.x);
    const top = Math.min(y, start.y);
    const width = Math.abs(x - start.x);
    const height = Math.abs(y - start.y);
    marquee.hidden = false;
    marquee.style.cssText = `left:${left}px;top:${top}px;width:${width}px;height:${height}px`;
    let n = 0;
    dots.forEach((d, i) => {
      const [cx, cy] = start!.centres[i]!;
      const on = cx >= left && cx <= left + width && cy >= top && cy <= top + height;
      d.classList.toggle('on', on);
      n += +on;
    });
    status.info(`${n} selected`);
  });

  area.addEventListener('lostpointercapture', () => {
    if (!start) return;
    start = null;
    marquee.hidden = true;
    if (!moved) {
      clear(); // a click on the canvas clears
      status.hide();
      return;
    }
    status.announce(`${count()} selected`);
    status.hide({ delay: 700 });
  });

  area.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      for (const d of dots) d.classList.add('on');
      anchor(status, area);
      status.flash(`All ${DOTS} selected`);
    } else if (e.key === 'Escape' && count()) {
      clear();
      anchor(status, area);
      status.flash('Selection cleared', { kind: 'info' });
    }
  });
}
