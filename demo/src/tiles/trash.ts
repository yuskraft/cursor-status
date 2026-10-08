import { anchor, statusOf } from '../util';

const ARM_RADIUS = 80;

/** Drag a card towards the bin: "Release to delete" once armed; let go anywhere else and it's safe. */
export function trash(tile: HTMLElement) {
  const status = statusOf(tile);
  const cards = [...tile.querySelectorAll<HTMLButtonElement>('.card')];
  const bin = tile.querySelector<HTMLElement>('.bin')!;
  const restore = tile.querySelector<HTMLButtonElement>('.restore')!;
  let drag: { card: HTMLButtonElement; x: number; y: number; armed: boolean } | null = null;

  const centre = (el: Element) => {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2] as const;
  };

  function toBin(card: HTMLButtonElement) {
    const [cx, cy] = centre(card);
    const [bx, by] = centre(bin);
    const [tx = 0, ty = 0] = (card.style.translate || '0px 0px').split(' ').map(parseFloat);
    const hadFocus = document.activeElement === card;
    card.classList.add('binned');
    card.style.translate = `${tx + bx - cx}px ${ty + by - cy}px`;
    setTimeout(() => {
      card.hidden = true;
      card.classList.remove('binned');
      card.style.translate = '';
      const rest = cards.filter((c) => !c.hidden);
      if (!rest.length) restore.hidden = false;
      if (hadFocus) (rest[0] ?? restore).focus();
    }, 320);
  }

  for (const card of cards) {
    card.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      card.setPointerCapture(e.pointerId);
      drag = { card, x: e.clientX, y: e.clientY, armed: false };
      card.classList.add('dragging');
    });

    card.addEventListener('pointermove', (e) => {
      if (drag?.card !== card) return;
      card.style.translate = `${e.clientX - drag.x}px ${e.clientY - drag.y}px`;
      const [bx, by] = centre(bin);
      const armed = Math.hypot(e.clientX - bx, e.clientY - by) < ARM_RADIUS;
      if (armed === drag.armed) return;
      drag.armed = armed;
      bin.classList.toggle('armed', armed);
      if (armed) status.info('Release to delete', { icon: 'cross' });
      else status.hide();
    });

    card.addEventListener('lostpointercapture', () => {
      if (drag?.card !== card) return;
      const { armed } = drag;
      drag = null;
      card.classList.remove('dragging');
      bin.classList.remove('armed');
      if (armed) {
        toBin(card);
        status.success('Moved to trash');
      } else {
        card.style.translate = ''; // springs back
        status.hide();
      }
    });

    card.addEventListener('keydown', (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      e.preventDefault();
      anchor(status, bin);
      toBin(card);
      status.flash('Moved to trash');
    });
  }

  restore.addEventListener('click', (e) => {
    for (const card of cards) card.hidden = false;
    restore.hidden = true;
    if (e.detail === 0) anchor(status, cards[0]!);
    status.flash('Restored');
    cards[0]!.focus({ preventScroll: true });
  });
}
