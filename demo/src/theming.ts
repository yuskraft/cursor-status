import type { CursorStatus } from '@yuskraft/cursor-status';
import { esc } from './util';

const TOKENS: [string, string, boolean][] = [
  ['--cs-bg', 'rgba(26, 18, 12, .7)', true],
  ['--cs-fg', '#fff8ef', true],
  ['--cs-muted', 'rgba(255, 248, 239, .62)', true],
  ['--cs-track', 'rgba(255, 248, 239, .22)', true],
  ['--cs-success', 'var(--cs-fg)', false],
  ['--cs-on-success', '#2a1b10', true],
  ['--cs-error', '#e0574c', true],
  ['--cs-on-error', '#fff8ef', true],
  ['--cs-font', 'system-ui, sans-serif', false],
  ['--cs-font-size', '13.5px', false],
  ['--cs-height', '34px', false],
  ['--cs-radius', '17px', false],
  ['--cs-shadow', '0 12px 32px -10px …', false],
  ['--cs-blur', '16px', false],
];

const PRESETS: Record<string, { theme?: string; vars?: Record<string, string> }> = {
  default: {},
  paper: { theme: 'light' },
  lemon: {
    vars: {
      '--cs-bg': '#f5d547',
      '--cs-fg': '#1c1700',
      '--cs-muted': 'rgba(28, 23, 0, .55)',
      '--cs-track': 'rgba(28, 23, 0, .2)',
      '--cs-on-success': '#f5d547',
      '--cs-error': '#b8321f',
      '--cs-shadow': '0 12px 30px -12px rgba(110, 80, 0, .6)',
    },
  },
  square: {
    vars: {
      '--cs-bg': 'rgba(12, 12, 12, .86)',
      '--cs-fg': '#f2f2f2',
      '--cs-on-success': '#0c0c0c',
      '--cs-radius': '7px',
      '--cs-height': '30px',
      '--cs-font': 'ui-monospace, Menlo, monospace',
      '--cs-font-size': '12px',
    },
  },
};

const DEMO: [string, Parameters<CursorStatus['show']>[1]][] = [
  ['Uploading 2 files', { kind: 'progress', progress: 0.65, dots: true }],
  ['Uploaded 2 files', { kind: 'success' }],
  ["Can't upload here", { kind: 'error' }],
  ['Drop 2 files', { kind: 'info', icon: 'plus' }],
];

/** Token table, plus presets applied to a live pill in the preview stage. */
export function theming(section: HTMLElement) {
  const stage = section.querySelector<HTMLElement>('#theme-stage')!;
  const status = stage.querySelector('cursor-status')!;
  const css = section.querySelector('.theme-css code')!;
  const rows = section.querySelector('.tokens tbody')!;
  const buttons = [...section.querySelectorAll<HTMLButtonElement>('[data-preset]')];
  let step = 0;
  let timer = 0;

  rows.innerHTML = TOKENS.map(
    ([name, value, colour]) =>
      `<tr><td><code>${name}</code></td><td>${
        colour ? `<span class="dot-swatch" style="--sw:${value}"></span>` : ''
      }${esc(value)}</td></tr>`,
  ).join('');

  function preset(name: string) {
    const p = PRESETS[name] ?? {};
    for (const [k] of TOKENS) status.style.removeProperty(k);
    for (const [k, v] of Object.entries(p.vars ?? {})) status.style.setProperty(k, v);
    if (p.theme) status.setAttribute('theme', p.theme);
    else status.removeAttribute('theme');
    status.toggleAttribute('data-own-theme', !!p.theme); // the page theme toggle leaves it alone
    for (const b of buttons) b.setAttribute('aria-pressed', `${b.dataset.preset === name}`);
    const lines = [
      ...(p.theme ? [`  /* or the attribute: theme="${p.theme}" */`] : []),
      ...Object.entries(p.vars ?? {}).map(([k, v]) => `  ${k}: ${v};`),
    ];
    css.textContent = lines.length
      ? `cursor-status {\n${lines.join('\n')}\n}`
      : 'cursor-status {\n  /* the defaults */\n}';
  }

  function cycle() {
    const [label, opts] = DEMO[step++ % DEMO.length]!;
    status.show(label, opts);
    timer = window.setTimeout(cycle, 1500);
  }

  for (const b of buttons) b.addEventListener('click', () => preset(b.dataset.preset!));
  stage.addEventListener('pointerenter', () => {
    clearTimeout(timer);
    step = 0;
    cycle();
  });
  stage.addEventListener('pointerleave', () => {
    clearTimeout(timer);
    status.hide();
  });
  preset('default');
}
