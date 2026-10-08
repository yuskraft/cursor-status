import { anchor, plural, statusOf } from '../util';

/** Drag real files over the zone: say what a drop will do, including when it can't. */
export function drop(tile: HTMLElement) {
  const status = statusOf(tile);
  const stage = tile.querySelector<HTMLElement>('.stage')!;
  const zone = tile.querySelector<HTMLElement>('.zone')!;
  const locked = tile.querySelector<HTMLElement>('.locked')!;
  const list = tile.querySelector<HTMLUListElement>('.files')!;
  const input = tile.querySelector<HTMLInputElement>('input[type=file]')!;
  const pick = tile.querySelector<HTMLButtonElement>('.pick')!;
  let state = '';

  const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');
  // Chrome and Firefox expose the count while dragging; Safari doesn't, so fall back to "files".
  const count = (e: DragEvent) =>
    [...(e.dataTransfer?.items ?? [])].filter((i) => i.kind === 'file').length;
  const files = (n: number) => (n ? plural(n, 'file') : 'files');
  const where = (e: Event) => {
    const t = e.target as Element;
    return t.closest('.locked') ? 'locked' : t.closest('.zone') ? 'zone' : 'none';
  };

  function reset() {
    state = '';
    zone.classList.remove('over');
    locked.classList.remove('over');
  }

  function add(added: File[]) {
    for (const f of added) {
      const li = document.createElement('li');
      li.textContent = f.name;
      li.title = f.name;
      list.append(li);
    }
    while (list.children.length > 6) list.firstElementChild!.remove();
  }

  stage.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    const now = where(e);
    e.dataTransfer!.dropEffect = now === 'zone' ? 'copy' : 'none';
    // dragover fires continuously; only morph when what a drop would do changes
    if (now === state) return;
    state = now;
    zone.classList.toggle('over', now === 'zone');
    locked.classList.toggle('over', now === 'locked');
    if (now === 'locked') status.error("Can't drop here");
    else if (now === 'zone') status.info(`Drop ${files(count(e))}`, { icon: 'plus' });
    else status.hide();
  });

  stage.addEventListener('dragleave', (e) => {
    if (!stage.contains(e.relatedTarget as Node | null)) {
      reset();
      status.hide();
    }
  });

  stage.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    const at = where(e);
    reset();
    if (at === 'locked') return status.flash("Can't drop here", { kind: 'error' });
    if (at !== 'zone') return status.hide();
    const dropped = [...e.dataTransfer!.files];
    add(dropped);
    status.success(`Added ${files(dropped.length)}`);
  });

  // The same thing without dragging: keyboard and touch.
  pick.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const chosen = [...(input.files ?? [])];
    input.value = '';
    if (!chosen.length) return;
    add(chosen);
    anchor(status, pick);
    status.flash(`Added ${files(chosen.length)}`);
  });

  // Don't let a stray drop elsewhere on the page navigate to the file.
  window.addEventListener('dragover', (e) => {
    if (e.defaultPrevented || !hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'none';
  });
  window.addEventListener('drop', (e) => {
    if (hasFiles(e)) e.preventDefault();
  });
}
