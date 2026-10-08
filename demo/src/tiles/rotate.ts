import { anchor, statusOf } from '../util';

const STEP = 15;
const SNAP = 4; // degrees either side of a step that snap to it

/** Turn the dial: live degrees, snapping to 15° steps, and the pill says when it snapped. */
export function rotate(tile: HTMLElement) {
  const status = statusOf(tile);
  const dial = tile.querySelector<HTMLElement>('.dial')!;
  const knob = tile.querySelector<HTMLElement>('.knob')!;
  const ticks = tile.querySelector<HTMLElement>('.ticks')!;
  for (let i = 0; i < 360 / STEP; i++) {
    const t = document.createElement('i');
    t.style.rotate = `${i * STEP}deg`;
    ticks.append(t);
  }
  let angle = 0;
  let grab: number | null = null; // angle offset between the pointer and the knob
  let idle = 0;

  const norm = (a: number) => ((a % 360) + 360) % 360;
  const pointerAngle = (e: PointerEvent) => {
    const r = dial.getBoundingClientRect();
    const a = Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2);
    return (a * 180) / Math.PI + 90;
  };

  function turn(raw: number) {
    let a = norm(Math.round(raw));
    const near = norm(Math.round(a / STEP) * STEP);
    const snapped = Math.abs(((a - near + 540) % 360) - 180) <= SNAP;
    if (snapped) a = near;
    if (a === angle && status.open) return;
    angle = a;
    knob.style.setProperty('--a', `${a}deg`);
    dial.setAttribute('aria-valuenow', `${a}`);
    dial.setAttribute('aria-valuetext', `${a} degrees`);
    status.info(snapped ? `Snapped · ${a}°` : `${a}°`, { icon: snapped ? 'check' : 'none' });
  }

  dial.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dial.setPointerCapture(e.pointerId);
    dial.focus({ preventScroll: true });
    grab = angle - pointerAngle(e);
    status.info(`${angle}°`);
  });
  dial.addEventListener('pointermove', (e) => {
    if (grab !== null) turn(pointerAngle(e) + grab);
  });
  dial.addEventListener('lostpointercapture', () => {
    grab = null;
    status.hide({ delay: 500 });
  });

  dial.addEventListener('keydown', (e) => {
    const keys: Record<string, number> = {
      ArrowRight: STEP,
      ArrowUp: STEP,
      ArrowLeft: -STEP,
      ArrowDown: -STEP,
      PageUp: 90,
      PageDown: -90,
    };
    let next: number | undefined;
    if (e.key in keys) next = Math.round((angle + keys[e.key]!) / STEP) * STEP;
    else if (e.key === 'Home') next = 0;
    if (next === undefined) return;
    e.preventDefault();
    anchor(status, dial);
    turn(next);
    clearTimeout(idle);
    idle = window.setTimeout(() => status.hide(), 900);
  });
}
