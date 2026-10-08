import css from './cursor-status.css?inline';

export type CursorStatusKind = 'info' | 'progress' | 'success' | 'error';
export type CursorStatusIcon = 'none' | 'plus' | 'ring' | 'check' | 'cross';
export type CursorStatusPlacement = 'bottom-end' | 'bottom-start' | 'top-end' | 'top-start';

export interface CursorStatusOptions {
  kind?: CursorStatusKind;
  /** Ring fill, 0–1 (`progress` kind). */
  progress?: number;
  /** Animated trailing "…". */
  dots?: boolean;
  /** Override the icon picked by `kind`. */
  icon?: CursorStatusIcon;
}

/** Attribute defaults. Every attribute is reflected as a property of the same name. */
const PROPS = {
  kind: 'info',
  label: '',
  progress: 0,
  dots: false,
  icon: '',
  open: false,
  follow: 'pointer',
  scope: '',
  placement: 'bottom-end',
  offset: '18 20',
  linger: 1100,
  stiffness: 16,
  theme: '',
  motion: '',
};

const ICONS: Record<string, CursorStatusIcon> = {
  info: 'none',
  progress: 'ring',
  success: 'check',
  error: 'cross',
};

const RING = 43.98; // 2π · 7
const EDGE = 8; // keep the pill this far inside the viewport
const TOUCH_LIFT = 78; // on touch, sit centred this far above the finger
// Horizontal chrome around the label (padding + icon slot), mirrored from the CSS.
const CHROME_ICON = 9 + 18 + 8 + 14;
const CHROME_NONE = 9 + 5 + 14;
const EVENTS =
  'pointermove pointerdown pointerup pointercancel pointerout dragover dragleave drop dragend scroll';
const { abs, min, max } = Math;

/**
 * One step of a critically damped spring, solved implicitly so it stays stable at any frame time.
 * Returns the new `[position, velocity]`.
 */
export function spring(
  x: number,
  v: number,
  target: number,
  omega: number,
  dt: number,
): [number, number] {
  const f = 1 + 2 * dt * omega;
  const hoo = dt * omega * omega;
  const hhoo = dt * hoo;
  const det = 1 / (f + hhoo);
  return [(f * x + dt * v + hhoo * target) * det, (v + hoo * (target - x)) * det];
}

const clamp = (v: number, lo: number, hi: number) => min(max(v, lo), hi);

/** One axis: put a box of `size` on side `s` (1 after, -1 before) of point `p` at offset `o`,
 *  flip to the other side if it doesn't fit in `view`, then clamp. Returns [anchor, side]. */
function axis(p: number, o: number, size: number, view: number, s: number) {
  if (s > 0 ? p + o + size > view - EDGE : p - o - size < EDGE) s = -s;
  return [
    s > 0 ? clamp(p + o, EDGE, view - EDGE - size) : clamp(p - o, EDGE + size, view - EDGE),
    s,
  ];
}

/**
 * Where the pill goes for a pointer at (x, y), in client px, given the pill size (w, h) and the
 * viewport (vw, vh). Returns the anchor point, which is the pill's cursor-side corner, and the
 * sides the pill hangs off it: sx 1 right, -1 left, 0 centred; sy 1 below, -1 above. Flips to the
 * other side of the cursor near an edge instead of squashing, then clamps.
 */
export function place(
  x: number,
  y: number,
  placement: string,
  [ox, oy]: number[],
  rtl: boolean,
  touch: boolean,
  [w, h, vw, vh]: number[],
): number[] {
  if (touch) {
    return [
      clamp(x, EDGE + w / 2, vw - EDGE - w / 2),
      max(y - TOUCH_LIFT + h / 2, EDGE + h),
      0,
      -1,
    ];
  }
  const [ax, sx] = axis(x, ox, w, vw, placement.endsWith('start') === rtl ? 1 : -1);
  const [ay, sy] = axis(y, oy, h, vh, placement.startsWith('top') ? -1 : 1);
  return [ax, ay, sx, sy];
}

// Extending HTMLElement only when it exists keeps the import SSR-safe.
const Base = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;
let reduceQuery: MediaQueryList | undefined;

/**
 * `<cursor-status>`: a status pill that follows the pointer during a gesture.
 *
 * @fires cursor-status:shown - the pill appeared on screen (bubbles)
 * @fires cursor-status:hidden - the pill started to disappear (bubbles)
 * @csspart pill - the pill surface
 * @csspart icon - the 18×18 SVG icon
 * @csspart label - the text box
 */
export class CursorStatus extends Base {
  static observedAttributes = Object.keys(PROPS);

  declare kind: CursorStatusKind;
  declare label: string;
  declare progress: number;
  declare dots: boolean;
  declare icon: CursorStatusIcon | '';
  declare open: boolean;
  declare follow: 'pointer' | 'manual';
  declare scope: string;
  declare placement: CursorStatusPlacement;
  declare offset: string;
  declare linger: number;
  /** Follow spring ω (default 16). */
  declare stiffness: number;
  /** Force a theme; otherwise it follows `prefers-color-scheme`. */
  declare theme: '' | 'light' | 'dark';
  /** `reduce` forces reduced motion; otherwise the system setting applies. */
  declare motion: '' | 'reduce';

  #p: HTMLElement; // the pill, a manual popover in the top layer
  #l: HTMLElement; // label box
  #f: SVGElement; // ring fill
  #sr: HTMLElement; // live region
  #cur?: HTMLElement; // current label span
  #ac?: AbortController;

  // pointer: position, touch, inside window and scope, pressed
  #x = 0;
  #y = 0;
  #known = false;
  #touch = false;
  #inside = true;
  #down = false;
  #se?: Element | null; // scope element, resolved on render
  // springs [x, y, scale %, progress %] with velocities, and the sides the pill hangs off
  #st = [0, 0, 100, 0];
  #v = [0, 0, 0, 0];
  #sx = 1;
  #sy = 1;
  // cached geometry, measured on appear, label change and resize only: never per frame
  #o = [18, 20];
  #tw = 0;
  #box = [0, 34, 0, 0]; // pill w, h; viewport w, h
  #rtl = false;
  #rm = false;
  // render state
  #raf = 0;
  #t = 0;
  #vis = false; // should be on screen
  #shown = false; // displayed, including the fade-out
  #text = '';
  #kind = '';
  #lt = 0; // last label change
  #said = ''; // last announcement key
  #queued = false;
  #lingering = false;
  #hideT?: ReturnType<typeof setTimeout>;
  #offT?: ReturnType<typeof setTimeout>;
  #leaveT?: ReturnType<typeof setTimeout>;
  #hit = 0; // pending post-scroll hit test

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${css}</style><div class=p part=pill popover=manual hidden aria-hidden=true><svg class=i part=icon viewBox="0 0 18 18"><circle class=t cx=9 cy=9 r=7 /><path class=f d=M9,2a7,7,0,1,1,0,14a7,7,0,1,1,0-14 /><path class=plus d=M9,4.5V13.5M4.5,9H13.5 /><circle class=d cx=9 cy=9 r=8.2 /><path class=c d=M5.6,9.3L8,11.6L12.5,6.8 /><path class=x pathLength=10 d=M6.3,6.3L11.7,11.7M11.7,6.3L6.3,11.7 /></svg><span class=l part=label></span></div><div class=sr role=status aria-live=polite></div>`;
    this.#p = root.querySelector('.p')!;
    this.#l = root.querySelector('.l')!;
    this.#f = root.querySelector('.f')!;
    this.#sr = root.querySelector('.sr')!;
  }

  connectedCallback() {
    this.#ac = new AbortController();
    const signal = this.#ac.signal;
    for (const t of EVENTS.split(' ')) {
      document.addEventListener(t, this, { capture: true, passive: true, signal });
    }
    addEventListener('resize', this, { passive: true, signal });
    this.#render();
  }

  disconnectedCallback() {
    this.#ac?.abort();
    this.#vis = this.#shown = false;
    this.#display(false);
  }

  attributeChangedCallback() {
    // Batched: show() sets several attributes, which must land as one morph.
    if (!this.#queued) {
      this.#queued = true;
      queueMicrotask(() => this.#render());
    }
  }

  /** Show the pill, or morph it if it's visible. Defaults to `kind: 'info'`. */
  show(label: string, opts: CursorStatusOptions = {}) {
    const kind = opts.kind ?? 'info';
    clearTimeout(this.#hideT);
    this.#lingering = false;
    this.progress = opts.progress ?? (kind === this.kind && this.open ? this.progress : 0);
    this.kind = kind;
    this.label = label;
    this.dots = !!opts.dots;
    this.icon = opts.icon ?? '';
    this.open = true;
  }

  info(label: string, opts?: CursorStatusOptions) {
    this.show(label, { ...opts, kind: 'info' });
  }

  error(label: string, opts?: CursorStatusOptions) {
    this.show(label, { ...opts, kind: 'error' });
  }

  /** Ring → check. Stays until `linger` ms after the gesture ends, then fades. */
  success(label = this.label, opts?: CursorStatusOptions) {
    this.flash(label, { ...opts, kind: 'success', progress: 1 });
  }

  /** One-shot: show (as a success unless `opts.kind` says otherwise), linger, fade. */
  flash(label: string, opts?: CursorStatusOptions) {
    this.show(label, { kind: 'success', ...opts });
    this.#lingering = true;
    if (!this.#down) this.hide({ delay: this.linger });
  }

  hide({ delay = 0 }: { delay?: number } = {}) {
    clearTimeout(this.#hideT);
    this.#hideT = setTimeout(() => {
      this.#lingering = false;
      this.open = false;
    }, delay);
  }

  /** Move to a point in client px: for `follow="manual"`, or to anchor at a drop point. */
  moveTo(x: number, y: number) {
    this.#point(x, y, false);
  }

  /** Say something through the polite live region. */
  announce(text: string) {
    const sr = this.#sr;
    // Identical text wouldn't be read again; nudge it.
    sr.textContent = sr.textContent === text ? `${text}\u00a0` : text;
  }

  /** @internal */
  handleEvent(e: Event) {
    const t = e.type;
    const pe = e as PointerEvent;
    if (t === 'resize') return this.#viewport();
    if (t === 'scroll') {
      // Scrolling moves the page under a still pointer, and no pointer event says so: check what's
      // under it now, once per frame, so a scoped pill leaves when its area scrolls away.
      if (this.#se && this.open && !this.#hit) {
        this.#hit = requestAnimationFrame(() => {
          this.#hit = 0;
          this.#leave(!!this.#se?.contains(document.elementFromPoint(this.#x, this.#y)));
        });
      }
      return;
    }
    if (t === 'pointerdown') this.#down = true;
    if (/up|cancel|drop|end/.test(t)) {
      this.#down = false;
      if (this.#lingering) this.hide({ delay: this.linger });
    }
    if (this.follow === 'manual' || /cancel|end/.test(t)) return;
    if (t === 'pointerout') {
      if (!pe.relatedTarget && pe.pointerType === 'mouse') this.#leave();
    } else if (t === 'dragleave') {
      // Fires between elements too; it's only a leave if no dragover follows.
      if (!pe.relatedTarget) this.#leaveT = setTimeout(() => this.#leave(), 100);
    } else {
      const inside = !this.#se || this.#se.contains(e.target as Node);
      clearTimeout(this.#leaveT);
      if (inside) {
        // The freshest sample, when the browser coalesced several moves into this event.
        const p = pe.getCoalescedEvents?.().at(-1) ?? pe;
        this.#point(p.clientX, p.clientY, pe.pointerType === 'touch');
      }
      if (inside !== this.#inside) this.#leave(inside);
    }
  }

  #leave(inside = false) {
    this.#inside = inside;
    this.#sync();
  }

  #point(x: number, y: number, touch: boolean) {
    this.#x = x;
    this.#y = y;
    this.#touch = touch;
    if (this.#known) this.#wake();
    else {
      this.#known = true;
      this.#sync();
    }
  }

  #viewport() {
    const d = document.documentElement;
    this.#box[2] = d.clientWidth;
    this.#box[3] = d.clientHeight;
    this.#wake();
  }

  #render() {
    const [ox = 18, oy = ox] = this.offset.split(/[\s,]+/).map((n) => +n || 0);
    this.#queued = false;
    if (!this.isConnected) return;
    this.#o = [ox, oy];
    this.#se = this.scope ? (this.closest(this.scope) ?? document.querySelector(this.scope)) : null;
    reduceQuery ??= matchMedia('(prefers-reduced-motion: reduce)');
    this.#rm = this.motion === 'reduce' || reduceQuery.matches;
    this.#p.toggleAttribute('data-rm', this.#rm);
    this.#sync();
    if (this.#shown) this.#paint();
    this.#speak();
    this.#wake();
  }

  /**
   * Visible = open, position known, and the pointer inside the window and scope. A lingering result
   * (success() or flash() after the gesture) that's already showing may stay outside, but nothing
   * appears there. Manual positioning isn't tied to the pointer, so the scope doesn't apply.
   */
  #sync() {
    const vis =
      this.open &&
      this.#known &&
      this.isConnected &&
      (this.#inside || this.follow === 'manual' || (this.#lingering && this.#vis));
    const p = this.#p;
    if (vis === this.#vis) return;
    this.#vis = vis;
    clearTimeout(this.#offT);
    if (!vis) {
      this.#offT = setTimeout(() => {
        this.#shown = false;
        this.#display(false);
      }, 340);
    } else if (!this.#shown) {
      // From fully hidden: start at the target. Whatever is set before the first style flush
      // starts there without transitions, and the label width goes auto → px, which can't animate.
      this.#shown = true;
      this.#display(true);
      this.#l.replaceChildren();
      this.#l.style.width = '';
      p.dataset.icon = this.#icon() === 'none' ? 'none' : ''; // no glyph yet, so it animates in
      this.#rtl = getComputedStyle(this).direction === 'rtl';
      this.#viewport();
      this.#paint(true);
      this.#box[1] = p.offsetHeight;
      const [ax, ay, sx, sy] = this.#target();
      this.#st = [ax, ay, this.#rm ? 100 : 88, clamp(this.progress, 0, 1) * 100];
      this.#v = [0, 0, 0, 0];
      this.#sx = sx;
      this.#sy = sy;
      this.#frame();
    }
    if (vis) p.dataset.icon = this.#icon();
    p.toggleAttribute('data-on', vis); // after the appear flush, so it fades in
    this.#wake();
    this.dispatchEvent(new Event(`cursor-status:${vis ? 'shown' : 'hidden'}`, { bubbles: true }));
  }

  #icon() {
    return this.icon || ICONS[this.kind] || 'none';
  }

  /** Apply icon and label. Label changes morph, unless they're a live readout. */
  #paint(appear?: boolean) {
    const icon = this.#icon();
    const text = this.label;
    const key = text + this.dots;
    const now = performance.now();
    if (!appear) this.#p.dataset.icon = icon;
    if (appear || key !== this.#text) {
      // Rapid same-kind updates (240 × 160 while resizing) change in place; the rest morph.
      const morph = !appear && (this.kind !== this.#kind || now - this.#lt > 160);
      let s = this.#cur;
      this.#text = key;
      this.#lt = now;
      if (morph || appear || !s) {
        if (s) {
          s.className = 'out';
          setTimeout((old: Element) => old.remove(), 450, s);
        }
        s = this.#cur = document.createElement('span');
        if (morph) s.className = 'in';
        this.#l.append(s);
      }
      s.textContent = text;
      if (this.dots) s.append(document.createElement('i')); // the dots, drawn by CSS
      this.#tw = s.offsetWidth; // the one layout read per label change
      this.#l.style.width = `${this.#tw}px`;
      s.className = '';
    }
    this.#kind = this.kind;
    this.#box[0] = this.#tw + (icon === 'none' ? CHROME_NONE : CHROME_ICON);
  }

  /** Announce state changes and every final result; never progress ticks or live readouts. */
  #speak() {
    const kind = this.kind;
    const text = this.label + (this.dots ? '…' : '');
    const key = /^[se]/.test(kind) ? kind + text : kind; // success and error are final results
    if (!this.open) this.#said = '';
    else if (text && key !== this.#said) {
      this.#said = key;
      this.announce(text);
    }
  }

  #display(on: boolean) {
    const p = this.#p;
    p.hidden = !on;
    try {
      on ? p.showPopover() : p.hidePopover();
    } catch {
      // No popover support (falls back to position: fixed), or already in that state.
    }
  }

  #target() {
    return place(this.#x, this.#y, this.placement, this.#o, this.#rtl, this.#touch, this.#box);
  }

  #wake() {
    if (!this.#raf && this.#shown) {
      this.#t = performance.now();
      this.#raf = requestAnimationFrame(this.#tick);
    }
  }

  #tick = (now: number) => {
    this.#raf = 0;
    if (!this.#shown) return;
    const dt = min(max(now - this.#t, 1), 64) / 1000;
    const [ax, ay, sx, sy] = this.#target();
    const k = this.stiffness;
    const st = this.#st;
    const v = this.#v;
    const target = [ax, ay, this.#vis || this.#rm ? 100 : 94, clamp(this.progress, 0, 1) * 100];
    const omega = [k, k, 22, 14];
    let busy = 0;
    this.#t = now;
    // Switching sides re-anchors the pill; shift the spring so nothing jumps, then glide over.
    st[0] += ((this.#sx - sx) * this.#box[0]) / 2;
    st[1] += ((this.#sy - sy) * this.#box[1]) / 2;
    this.#sx = sx;
    this.#sy = sy;
    for (let i = 0; i < 4; i++) {
      [st[i], v[i]] = spring(st[i], v[i], target[i], omega[i], dt);
      busy += abs(target[i] - st[i]) + abs(v[i]);
    }
    if (this.#rm || busy < 0.05) {
      // Settled (or reduced motion): snap and sleep.
      this.#st = target;
      this.#v = [0, 0, 0, 0];
    } else this.#raf = requestAnimationFrame(this.#tick);
    this.#frame();
  };

  /** Transforms only. The % translate puts the pill's cursor-side corner on the anchor, so scale
   *  and width changes grow away from the cursor. */
  #frame() {
    const [x, y, s, pr] = this.#st;
    this.#p.style.transform = `translate3d(${x}px,${y}px,0) scale(${s / 100}) translate(${(this.#sx - 1) * 50}%,${(this.#sy - 1) * 50}%)`;
    this.#f.style.strokeDashoffset = `${RING * (1 - pr / 100)}`;
  }
}

for (const [name, fallback] of Object.entries(PROPS)) {
  Object.defineProperty(CursorStatus.prototype, name, {
    get(this: HTMLElement) {
      const v = this.getAttribute(name);
      // Booleans are true when present; numbers parse; strings fall back to the default.
      return v === null ? fallback : typeof fallback === 'number' ? +v : fallback === false || v;
    },
    set(this: HTMLElement, v: unknown) {
      if (v === false || v == null || v === '') this.removeAttribute(name);
      else this.setAttribute(name, v === true ? '' : `${v}`);
    },
  });
}

declare global {
  interface HTMLElementTagNameMap {
    'cursor-status': CursorStatus;
  }
}
