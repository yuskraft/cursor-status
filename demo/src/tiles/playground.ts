import type {
  CursorStatusIcon,
  CursorStatusKind,
  CursorStatusPlacement,
} from '@yuskraft/cursor-status';
import { anchor, esc, statusOf } from '../util';

/** Every option, live, with the code that produces it. */
export function playground(tile: HTMLElement) {
  const status = statusOf(tile);
  const form = tile.querySelector('form')!;
  const code = tile.querySelector('.live-code code')!;
  const flash = tile.querySelector<HTMLButtonElement>('[data-flash]')!;
  const stage = tile.querySelector<HTMLElement>('.stage')!;
  let reopen = 0;

  function read() {
    const f = new FormData(form);
    return {
      kind: f.get('kind') as CursorStatusKind,
      label: `${f.get('label') ?? ''}`.trim() || 'Hello',
      progress: Number(f.get('progress')),
      stiffness: Number(f.get('stiffness')),
      offset: `${f.get('ox')} ${f.get('oy')}`,
      placement: f.get('placement') as CursorStatusPlacement,
      icon: (f.get('icon') || undefined) as CursorStatusIcon | undefined,
      dots: f.has('dots'),
    };
  }

  function render(s: ReturnType<typeof read>) {
    const attrs = [
      s.placement !== 'bottom-end' && `placement="${s.placement}"`,
      s.offset !== '18 20' && `offset="${s.offset}"`,
      s.stiffness !== 16 && `stiffness="${s.stiffness}"`,
    ].filter(Boolean);
    const opts = [
      s.kind !== 'info' && `kind: '${s.kind}'`,
      s.kind === 'progress' && `progress: ${s.progress}`,
      s.dots && 'dots: true',
      s.icon && `icon: '${s.icon}'`,
    ].filter(Boolean);
    const el = `&lt;cursor-status${attrs.map((a) => ` <b>${esc(a as string)}</b>`).join('')}&gt;&lt;/cursor-status&gt;`;
    const label = `<b>'${esc(s.label.replace(/'/g, "\\'"))}'</b>`;
    const call = opts.length
      ? `status.show(${label}, {\n${opts.map((o) => `  <b>${esc(o as string)}</b>,`).join('\n')}\n});`
      : `status.show(${label});`;
    code.innerHTML = `${el}\n\n${call}`;
  }

  function apply() {
    const s = read();
    clearTimeout(reopen);
    status.placement = s.placement;
    status.offset = s.offset;
    status.stiffness = s.stiffness;
    status.show(s.label, s);
    render(s);
  }

  form.addEventListener('input', apply);
  form.addEventListener('submit', (e) => e.preventDefault());
  flash.addEventListener('click', () => {
    const s = read();
    // The button is outside the stage, so pin the flash inside it rather than at the pointer.
    anchor(status, stage);
    status.flash(s.label);
    reopen = window.setTimeout(() => {
      status.follow = 'pointer';
      apply();
    }, status.linger + 450);
  });
  apply();
}
