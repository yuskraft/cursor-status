import '@yuskraft/cursor-status/define';
import type { CursorStatus } from '@yuskraft/cursor-status';
import { snippets } from './snippets';
import { theming } from './theming';
import { drop } from './tiles/drop';
import { hold } from './tiles/hold';
import { lasso } from './tiles/lasso';
import { playground } from './tiles/playground';
import { resize } from './tiles/resize';
import { rotate } from './tiles/rotate';
import { swatch } from './tiles/swatch';
import { trash } from './tiles/trash';
import { anchor, copy } from './util';

const root = document.documentElement;
const page = document.getElementById('page-status') as CursorStatus;
const tile = (id: string) => document.getElementById(id)!;

hold(tile('hold'));
drop(tile('drop'));
resize(tile('resize'));
trash(tile('trash'));
lasso(tile('lasso'));
rotate(tile('rotate'));
swatch(tile('swatch'));
playground(tile('play'));
theming(tile('theming'));

// Preferences: theme and reduced motion, remembered per viewer when storage allows.

const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const store = (key: string, value: string | null) => {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // storage blocked: the setting just won't persist
  }
};

function syncTheme() {
  const forced = root.dataset.theme;
  const resolved = forced ?? (darkQuery.matches ? 'dark' : 'light');
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-theme-set]')) {
    b.setAttribute('aria-pressed', `${b.dataset.themeSet === resolved}`);
  }
  for (const el of document.querySelectorAll('cursor-status:not([data-own-theme])')) {
    if (forced) el.setAttribute('theme', forced);
    else el.removeAttribute('theme');
  }
  document
    .querySelector('meta[name=theme-color]')!
    .setAttribute('content', resolved === 'dark' ? '#161616' : '#f7f7f5');
}

function syncMotion() {
  const reduce = root.dataset.motion === 'reduce';
  document.querySelector('[data-motion-toggle]')!.setAttribute('aria-pressed', `${reduce}`);
  for (const el of document.querySelectorAll<CursorStatus>('cursor-status')) {
    el.motion = reduce ? 'reduce' : '';
  }
}

for (const b of document.querySelectorAll<HTMLButtonElement>('[data-theme-set]')) {
  b.addEventListener('click', () => {
    const want = b.dataset.themeSet!;
    // Picking the system theme again goes back to following the system.
    const system = darkQuery.matches ? 'dark' : 'light';
    if (want === system) delete root.dataset.theme;
    else root.dataset.theme = want;
    store('cs-theme', root.dataset.theme ?? null);
    syncTheme();
  });
}
darkQuery.addEventListener('change', syncTheme);

document.querySelector('[data-motion-toggle]')!.addEventListener('click', () => {
  if (root.dataset.motion === 'reduce') delete root.dataset.motion;
  else root.dataset.motion = 'reduce';
  store('cs-motion', root.dataset.motion ?? null);
  syncMotion();
});

syncTheme();
syncMotion();

// Copy buttons, with the page-level pill.

async function copyWith(button: HTMLElement, text: string, keyboard: boolean) {
  const ok = await copy(text);
  if (keyboard) anchor(page, button);
  if (ok) page.flash('Copied');
  else page.flash('Copy blocked', { kind: 'error' });
}

for (const b of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
  b.addEventListener('click', (e) => copyWith(b, b.dataset.copy!, e.detail === 0));
}

// "View code" strips expand a copyable snippet in place.

for (const strip of document.querySelectorAll<HTMLButtonElement>('.strip[data-code]')) {
  const id = `code-${strip.dataset.code}`;
  strip.setAttribute('aria-controls', id);
  strip.addEventListener('click', () => {
    let panel = document.getElementById(id);
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'code';
      panel.id = id;
      const pre = document.createElement('pre');
      pre.textContent = snippets[strip.dataset.code!] ?? '';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ghost-btn';
      button.textContent = 'Copy';
      button.addEventListener('click', (e) => copyWith(button, pre.textContent!, e.detail === 0));
      panel.append(pre, button);
      panel.hidden = true;
      strip.after(panel);
    }
    const open = panel.hidden;
    panel.hidden = !open;
    strip.setAttribute('aria-expanded', `${open}`);
    strip.textContent = open ? 'Hide code' : 'View code';
  });
}

// Masonry: split the tiles into columns in reading order, balanced by height. This runs once per
// breakpoint; CSS columns alone would rebalance whenever any tile changes height (a playground
// setting, a deleted row) and tiles would jump between columns.

const grid = document.getElementById('gallery')!;
const tiles = [...grid.querySelectorAll<HTMLElement>('.tile')];
const wide = matchMedia('(min-width: 1024px)');
const medium = matchMedia('(min-width: 640px)');
const GAP = 16;

/** Contiguous split of `heights` into `n` columns that minimises the tallest one. */
function split(heights: number[], n: number): number[][] {
  const stack = (from: number, to: number) =>
    heights.slice(from, to).reduce((sum, h) => sum + h + GAP, -GAP);
  let best: { cols: number[][]; tallest: number } = { cols: [], tallest: Infinity };
  const walk = (from: number, left: number, cols: number[][], tallest: number) => {
    if (tallest >= best.tallest) return;
    if (left === 1) {
      const last = heights.map((_, i) => i).slice(from);
      const t = Math.max(tallest, stack(from, heights.length));
      if (t < best.tallest) best = { cols: [...cols, last], tallest: t };
      return;
    }
    for (let to = from + 1; to <= heights.length - left + 1; to++) {
      const col = heights.map((_, i) => i).slice(from, to);
      walk(to, left - 1, [...cols, col], Math.max(tallest, stack(from, to)));
    }
  };
  walk(0, Math.min(n, heights.length), [], 0);
  return best.cols;
}

function layout() {
  const n = wide.matches ? 3 : medium.matches ? 2 : 1;
  // Back to CSS columns for a moment: same column width, so the heights measured are the real ones.
  grid.classList.remove('cols');
  grid.replaceChildren(...tiles);
  if (n === 1) return;
  const heights = tiles.map((t) => t.offsetHeight);
  const cols = split(heights, n).map((indices) => {
    const col = document.createElement('div');
    col.className = 'col';
    col.append(...indices.map((i) => tiles[i]!));
    return col;
  });
  grid.replaceChildren(...cols);
  grid.classList.add('cols');
}

layout();
wide.addEventListener('change', layout);
medium.addEventListener('change', layout);

// Tiles blur in once, staggered, as they first scroll into view.
if ('IntersectionObserver' in window) {
  const seen = new IntersectionObserver(
    (entries) => {
      const fresh = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
      fresh.sort((a, b) => tiles.indexOf(a) - tiles.indexOf(b));
      fresh.forEach((el, i) => {
        el.style.setProperty('--delay', `${i * 70}ms`);
        el.classList.add('seen');
        seen.unobserve(el);
      });
    },
    { rootMargin: '0px 0px -40px' },
  );
  for (const t of tiles) seen.observe(t);
} else {
  for (const t of tiles) t.classList.add('seen');
}
