import { anchor, plural, statusOf } from '../util';

const HOLD_MS = 900;

/** Press and hold a row: the ring fills, then it's deleted. Release early to cancel. */
export function hold(tile: HTMLElement) {
  const status = statusOf(tile);
  const items = [...tile.querySelectorAll<HTMLLIElement>('.rows li')];
  const restore = tile.querySelector<HTMLButtonElement>('.restore')!;
  let active: HTMLButtonElement | null = null;
  let raf = 0;
  let quietUntil = 0; // let a success linger before hover hints come back

  const rowOf = (li: HTMLLIElement) => li.querySelector<HTMLButtonElement>('.row')!;
  const live = () => items.filter((li) => !li.classList.contains('gone'));

  function hint() {
    if (active || performance.now() < quietUntil) return;
    if (status.open && status.label === 'Hold to delete') return;
    status.info('Hold to delete');
  }

  function start(row: HTMLButtonElement, keyboard: boolean) {
    if (active) return;
    active = row;
    row.classList.add('holding');
    if (keyboard) anchor(status, row);
    status.show('Deleting', { kind: 'progress', progress: 0, dots: true });
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / HOLD_MS, 1);
      status.progress = p;
      row.style.setProperty('--p', `${p}`);
      if (p < 1) raf = requestAnimationFrame(tick);
      else finish(row);
    };
    raf = requestAnimationFrame(tick);
  }

  function finish(row: HTMLButtonElement) {
    const li = row.parentElement as HTMLLIElement;
    const hadFocus = document.activeElement === row;
    active = null;
    quietUntil = performance.now() + 1400;
    row.classList.remove('holding');
    status.success('Deleted');
    li.classList.add('gone');
    row.tabIndex = -1;
    row.setAttribute('aria-hidden', 'true');
    const rest = live();
    if (!rest.length) restore.hidden = false;
    if (hadFocus) (rest.length ? rowOf(rest[0]!) : restore).focus();
  }

  function cancel() {
    if (!active) return;
    cancelAnimationFrame(raf);
    active.classList.remove('holding');
    active.style.setProperty('--p', '0');
    active = null;
    status.info('Cancelled');
    status.hide({ delay: 650 });
  }

  for (const li of items) {
    const row = rowOf(li);
    row.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && hint());
    row.addEventListener('pointermove', (e) => e.pointerType === 'mouse' && hint());
    row.addEventListener('pointerleave', () => {
      if (active === row) cancel();
      else if (!active && status.kind === 'info' && performance.now() > quietUntil) status.hide();
    });
    row.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); // no focus ring flash or text selection while holding
      start(row, false);
    });
    row.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        start(row, true);
      }
    });
    row.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Enter') cancel();
    });
    row.addEventListener('blur', cancel);
  }
  document.addEventListener('pointerup', cancel);
  document.addEventListener('pointercancel', cancel);

  restore.addEventListener('click', (e) => {
    for (const li of items) {
      const row = rowOf(li);
      li.classList.remove('gone');
      row.style.setProperty('--p', '0');
      row.removeAttribute('tabindex');
      row.removeAttribute('aria-hidden');
    }
    restore.hidden = true;
    if (e.detail === 0) anchor(status, tile.querySelector('.rows')!);
    status.flash(`Restored ${plural(items.length, 'file')}`);
    rowOf(items[0]!).focus({ preventScroll: true });
  });
}
