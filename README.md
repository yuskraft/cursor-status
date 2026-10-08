# cursor-status

A status pill that follows the pointer during a gesture: “Removing 3 files…” → “Removed 3 files”.
One dependency-free web component, with a spring follow, a text morph and a ring that turns into a
check.

**[Live demos →](https://yuskraft.github.io/cursor-status/)** · by
[Nurlan Yusifli](https://github.com/yuskraft) ([@yuskraft](https://github.com/yuskraft))

```html
<cursor-status></cursor-status>
<script type="module">
  import '@yuskraft/cursor-status/define';
  const status = document.querySelector('cursor-status');

  status.show('Removing 3 files', { kind: 'progress', progress: 0, dots: true });
  status.progress = 0.4;             // springs smoothly
  status.success('Removed 3 files'); // ring → check, lingers after release, fades
</script>
```

## Why

Feedback works best where the user is already looking: at the pointer, _during_ a gesture, about
something happening because of that gesture. A toast in a corner is too far away; a status line
on a button is gone once you start dragging.

## When to use it

- **Press-and-hold or dwell actions** (hold to delete, cover to remove). The ring answers “how long
  do I hold?”, and releasing early cancels.
- **Drag and drop.** Say what will happen on drop: “Move 3 files to Archive”, “Copy”, “Can’t drop
  here”.
- **Canvas tools.** Live values while resizing (“240 × 160”), rotating (“45°”), selecting
  (“12 selected”) or snapping (“Snapped to grid”).
- **Gesture shortcuts with a cancel window** (drag to trash, swipe to archive): “Release to delete”
  when armed, “Moved to trash” after.
- **Modifier hints mid-drag**: “Hold ⇧ to keep ratio”, “⌥ to duplicate”.

## When not to

- The result **outlives the gesture** or needs action: use a toast with Undo.
- A **plain button click**: show the status on the button.
- **Long or multi-line** text.
- Anything **interactive**: it moves away from the pointer.
- As the **only** feedback on touch or keyboard. It’s supplementary; reflect the outcome in the UI
  too.

## Install

```sh
npm i @yuskraft/cursor-status
```

```js
import '@yuskraft/cursor-status/define'; // registers <cursor-status>
```

Or register it yourself, under any tag:

```js
import { CursorStatus } from '@yuskraft/cursor-status'; // no side effects
customElements.define('drag-status', CursorStatus);
```

### With shadcn

A React wrapper, a hook, and the theme tokens mapped to yours (`--popover`, `--popover-foreground`,
`--destructive`, `--radius`, `--border`):

```sh
npx shadcn@latest add https://yuskraft.github.io/cursor-status/r/cursor-status.json
```

```tsx
import { CursorStatus } from '@/components/cursor-status';
import { useCursorStatus } from '@/hooks/use-cursor-status';

function Files() {
  const status = useCursorStatus();
  return (
    <div id="files" onDragOver={() => status.info('Drop 3 files', { icon: 'plus' })}>
      …
      <CursorStatus ref={status.ref} scope="#files" />
    </div>
  );
}
```

The element is registered in `useEffect`, so it's safe with server rendering; helpers called
before that wait for it. The token mapping expects shadcn's Tailwind v4 theme (colour values in the
variables, as in `oklch(...)`).

Without a bundler:

```html
<script type="module" src="https://esm.sh/@yuskraft/cursor-status/define"></script>
```

The import is SSR-safe: nothing touches `window` or `document` until the element is used.

## Quick start

Hold to delete, in ten lines (the [demo](https://yuskraft.github.io/cursor-status/) adds cancel):

```js
const status = document.querySelector('cursor-status');
row.addEventListener('pointerdown', () => {
  status.show('Deleting', { kind: 'progress', dots: true });
  const t0 = performance.now();
  requestAnimationFrame(function tick(now) {
    status.progress = Math.min((now - t0) / 900, 1);
    if (status.progress < 1) requestAnimationFrame(tick);
    else status.success('Deleted'); // ring → check, lingers after release
  });
});
```

## API

### Attributes

Each attribute is reflected as a property of the same name.

| attribute   | values                                                   | default      | meaning                                                                |
| ----------- | -------------------------------------------------------- | ------------ | ---------------------------------------------------------------------- |
| `kind`      | `info` \| `progress` \| `success` \| `error`             | `info`       | icon and colour treatment                                              |
| `label`     | string                                                   | `''`         | text shown; changes animate                                            |
| `progress`  | 0–1                                                      | `0`          | ring fill (`progress` kind); springs                                   |
| `dots`      | boolean                                                  | `false`      | animated trailing “…”                                                  |
| `icon`      | `none` \| `plus` \| `ring` \| `check` \| `cross`         | by `kind`    | override the icon                                                      |
| `open`      | boolean                                                  | `false`      | visible or not (`show()`/`hide()` set it)                              |
| `follow`    | `pointer` \| `manual`                                    | `pointer`    | track the pointer, or position via `moveTo(x, y)`                      |
| `scope`     | CSS selector                                             | document     | only follow, and only stay visible, while the pointer is inside it     |
| `placement` | `bottom-end` \| `bottom-start` \| `top-end` \| `top-start` | `bottom-end` | side of the cursor (logical, so it flips in RTL)                     |
| `offset`    | `"x y"` px                                               | `"18 20"`    | gap from the cursor                                                    |
| `linger`    | ms                                                       | `1100`       | how long a success stays after the gesture ends, before fading        |
| `theme`     | `light` \| `dark`                                        | system       | force a theme instead of following `prefers-color-scheme`              |
| `motion`    | `reduce`                                                 | system       | force reduced motion (for an in-app setting)                           |
| `stiffness` | number                                                   | `16`         | follow spring ω                                                        |

Icons by kind: `info` → none, `progress` → ring, `success` → check, `error` → cross.

### Methods

| method                   | does                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `show(label, opts?)`     | Show the pill, or morph it if visible. `opts`: `{ kind, progress, dots, icon }`; `kind` defaults to `info`. |
| `info(label, opts?)`     | `show()` with `kind: 'info'`.                                                                 |
| `error(label, opts?)`    | `show()` with `kind: 'error'`.                                                                |
| `success(label?, opts?)` | Ring → check. Stays until `linger` ms after the gesture ends (pointer up, drop), then fades.  |
| `flash(label, opts?)`    | One-shot: show as a success (or `opts.kind`), linger, fade. For the click case.               |
| `hide({ delay }?)`       | Fade out, optionally after `delay` ms.                                                        |
| `moveTo(x, y)`           | Position in client px: for `follow="manual"`, or to anchor at a drop point or focused control. |
| `announce(text)`         | Say something through the polite live region.                                                 |

Rapid label changes of the same kind (a live readout updating every frame) change in place; any
other change morphs.

### Events

| event                  | when                                         |
| ---------------------- | -------------------------------------------- |
| `cursor-status:shown`  | the pill appeared on screen (bubbles)        |
| `cursor-status:hidden` | the pill started to disappear (bubbles)      |

Several instances on one page are independent; give each a `scope` to tie it to an area.

## Behaviour

- **Follow:** a critically damped spring (ω = 16), solved implicitly so it’s stable at any frame
  rate. One `requestAnimationFrame` loop runs only while something moves, and sleeps when settled.
  Transforms only, no layout reads per frame; text is measured once per label change.
- **Edges:** clamps 8px inside the viewport and flips to the other side of the cursor rather than
  squashing. The pill hangs off its cursor-side corner, so width changes grow away from the cursor.
- **Appear / disappear:** jumps to the pointer (never flies in), scales 0.88 → 1 and un-blurs.
- **Touch:** sits centred about 78px above the finger.
- **Top layer:** renders as a manual popover, so `overflow: hidden` and stacking contexts can’t clip
  it (falls back to `position: fixed`).
- **Drag and drop:** follows `dragover`, so it works while dragging files; also during pointer
  capture.
- **Leaving:** when the pointer leaves the window or `scope`, it freezes and hides, unless it’s
  showing a success.
- Nothing renders until a pointer position is known.

## Theming

Custom properties on the element (shown with their dark defaults):

| token             | default                     |
| ----------------- | --------------------------- |
| `--cs-bg`         | `rgba(26, 18, 12, .7)`      |
| `--cs-fg`         | `#fff8ef`                   |
| `--cs-muted`      | `rgba(255, 248, 239, .62)` (dots) |
| `--cs-track`      | `rgba(255, 248, 239, .22)` (ring track) |
| `--cs-success`    | `var(--cs-fg)` (check disc) |
| `--cs-on-success` | `#2a1b10` (check)           |
| `--cs-error`      | `#e0574c` (cross disc)      |
| `--cs-on-error`   | `#fff8ef` (cross)           |
| `--cs-font`       | `system-ui, sans-serif`     |
| `--cs-font-size`  | `13.5px`                    |
| `--cs-height`     | `34px`                      |
| `--cs-radius`     | `17px`                      |
| `--cs-shadow`     | `0 12px 32px -10px rgba(30,14,4,.55), …` |
| `--cs-blur`       | `16px` (backdrop blur)      |

```css
cursor-status {
  --cs-bg: #f5d547;
  --cs-fg: #1c1700;
  --cs-radius: 8px;
}
cursor-status::part(label) {
  font-weight: 600;
}
```

A light variant follows `prefers-color-scheme`; force either with `theme="light"` or
`theme="dark"`. Parts: `::part(pill)`, `::part(icon)`, `::part(label)`.

## Accessibility

- The pill is **supplementary feedback**. The real outcome must also show in the UI: the row
  disappears, the file appears in the list.
- The visual pill is `aria-hidden`. State changes and final results (“Removed 3 files”) are
  mirrored to a polite `role="status"` live region, and never progress ticks or live readouts. Use
  `announce()` for anything else, such as the final count after a lasso.
- **Keyboard:** there’s no pointer to follow. Set `follow="manual"` and `moveTo()` the focused
  control, or rely on the live region alone. Every demo on the site works from the keyboard.
- **Reduced motion:** position snaps, transitions are cut to near zero, the dots are a static “…”,
  and only the opacity fade remains. `motion="reduce"` forces it.
- **Forced colours:** system colours (`Canvas`, `CanvasText`, `Highlight`) with a visible border.
- **Contrast:** text is above 4.5:1 on both default surfaces, even over a white or black page.

## Browser support

Current Chrome, Edge, Safari and Firefox (tested with Playwright on Chromium, WebKit and Firefox).
The top layer needs popover support (Chrome 114, Safari 17, Firefox 125); older browsers fall back
to `position: fixed`.

## Size

Zero dependencies. 4.4 kB min+gzip with styles included, checked in CI with
[size-limit](https://github.com/ai/size-limit).

## Development

```sh
pnpm install
pnpm dev          # demo at http://localhost:5173
pnpm test         # unit tests (Vitest + happy-dom)
pnpm e2e          # end-to-end tests (Playwright: Chromium, Firefox, WebKit)
pnpm lint         # Biome
pnpm typecheck
pnpm build        # dist/ (ESM + .d.ts)
pnpm registry:build  # shadcn registry JSON into demo/public/r (also part of build:demo)
pnpm size
```

Visual snapshots are stored per platform. To create or refresh the Linux baselines CI compares
against, run the **Update snapshots** workflow and commit the files it uploads.

The demo deploys to GitHub Pages from `main` (Settings → Pages → Source: GitHub Actions).

Started as the status pill of a rug-shaped file dropzone.

## License

MIT © [Nurlan Yusifli](https://github.com/yuskraft) ([@yuskraft](https://github.com/yuskraft))
