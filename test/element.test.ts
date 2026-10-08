import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import '../src/define';
import type { CursorStatus } from '../src/cursor-status';

const flush = () => new Promise((r) => setTimeout(r, 0));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pointer(
  type: string,
  x: number,
  y: number,
  target: Element = document.body,
  pointerType = 'mouse',
) {
  target.dispatchEvent(
    new PointerEvent(type, { clientX: x, clientY: y, pointerType, bubbles: true }),
  );
}
const move = (x: number, y: number, target?: Element) => pointer('pointermove', x, y, target);

const pill = (el: CursorStatus) => el.shadowRoot!.querySelector<HTMLElement>('.p')!;
const transform = (el: CursorStatus) => pill(el).style.transform.replace(/\s/g, '');
/** [x, y, scale] from the pill's transform, rounded to 2 decimals */
const pos = (el: CursorStatus) =>
  (transform(el).match(/-?[\d.]+/g) ?? [])
    .slice(1, 5)
    .filter((_, i) => i !== 2)
    .map((n) => Math.round(+n * 100) / 100);
const spoken = (el: CursorStatus) => el.shadowRoot!.querySelector('[role=status]')!.textContent;
const visible = (el: CursorStatus) => pill(el).hasAttribute('data-on');
const labels = (el: CursorStatus) =>
  [...el.shadowRoot!.querySelectorAll('.l > span')].map((s) => `${s.className}:${s.textContent}`);

function mount(attrs: Record<string, string> = {}, parent: Element = document.body) {
  const el = document.createElement('cursor-status');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent.append(el);
  return el;
}

beforeAll(() => {
  Object.defineProperty(document.documentElement, 'clientWidth', {
    value: 1000,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    value: 800,
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('attributes and properties', () => {
  it('has the documented defaults', () => {
    const el = mount();
    expect(el.kind).toBe('info');
    expect(el.label).toBe('');
    expect(el.progress).toBe(0);
    expect(el.dots).toBe(false);
    expect(el.icon).toBe('');
    expect(el.open).toBe(false);
    expect(el.follow).toBe('pointer');
    expect(el.placement).toBe('bottom-end');
    expect(el.offset).toBe('18 20');
    expect(el.linger).toBe(1100);
  });

  it('reflects properties to attributes and back', () => {
    const el = mount();
    el.label = 'Hello';
    el.progress = 0.4;
    el.dots = true;
    el.kind = 'progress';
    expect(el.getAttribute('label')).toBe('Hello');
    expect(el.getAttribute('progress')).toBe('0.4');
    expect(el.hasAttribute('dots')).toBe(true);
    expect(el.getAttribute('kind')).toBe('progress');
    el.dots = false;
    expect(el.hasAttribute('dots')).toBe(false);
    el.setAttribute('linger', '500');
    expect(el.linger).toBe(500);
  });

  it('show() sets everything in one go', () => {
    const el = mount();
    el.show('Removing 3 files', { kind: 'progress', progress: 0.25, dots: true });
    expect([el.kind, el.label, el.progress, el.dots, el.open]).toEqual([
      'progress',
      'Removing 3 files',
      0.25,
      true,
      true,
    ]);
    el.info('Drop 3 files', { icon: 'plus' });
    expect([el.kind, el.icon, el.dots, el.progress]).toEqual(['info', 'plus', false, 0]);
    el.error("Can't drop here");
    expect([el.kind, el.icon]).toEqual(['error', '']);
  });

  it('success() completes the ring', () => {
    const el = mount();
    el.show('Uploading', { kind: 'progress', progress: 0.5 });
    el.success('Uploaded');
    expect([el.kind, el.label, el.progress]).toEqual(['success', 'Uploaded', 1]);
  });

  it('success() without a label keeps the current one', () => {
    const el = mount();
    el.show('Saved');
    el.success();
    expect(el.label).toBe('Saved');
  });
});

describe('visibility', () => {
  it('renders nothing until the pointer position is known', async () => {
    const el = mount();
    const shown = vi.fn();
    el.addEventListener('cursor-status:shown', shown);
    el.show('Hi');
    await flush();
    expect(visible(el)).toBe(false);
    expect(pill(el).hidden).toBe(true);
    move(100, 100);
    expect(visible(el)).toBe(true);
    expect(shown).toHaveBeenCalledOnce();
  });

  it('appears at the pointer, not flying in from the last spot', async () => {
    const el = mount();
    move(100, 100);
    el.show('Hi');
    await flush();
    expect(pos(el).slice(0, 2)).toEqual([118, 120]);
    el.hide();
    await wait(400);
    move(500, 300);
    el.show('Again');
    await flush();
    expect(pos(el).slice(0, 2)).toEqual([518, 320]);
  });

  it('scales in from 0.88', async () => {
    const el = mount();
    move(100, 100);
    el.show('Hi');
    await flush();
    expect(pos(el)[2]).toBeGreaterThanOrEqual(0.88);
    expect(pos(el)[2]).toBeLessThan(0.9);
  });

  it('hide() fades out, fires an event and finally takes it off screen', async () => {
    const el = mount();
    const hidden = vi.fn();
    el.addEventListener('cursor-status:hidden', hidden);
    move(10, 10);
    el.show('Hi');
    await flush();
    el.hide();
    await flush();
    expect(el.open).toBe(false);
    expect(visible(el)).toBe(false);
    expect(hidden).toHaveBeenCalledOnce();
    expect(pill(el).hidden).toBe(false); // still fading
    await wait(400);
    expect(pill(el).hidden).toBe(true);
  });

  it('hide({ delay }) waits', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const el = mount();
    move(10, 10);
    el.show('Hi');
    el.hide({ delay: 800 });
    await vi.advanceTimersByTimeAsync(700);
    expect(el.open).toBe(true);
    await vi.advanceTimersByTimeAsync(200);
    expect(el.open).toBe(false);
  });

  it('show() cancels a pending hide', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const el = mount();
    el.show('Hi');
    el.hide({ delay: 300 });
    el.show('Still here');
    await vi.advanceTimersByTimeAsync(1000);
    expect(el.open).toBe(true);
  });
});

describe('success and linger', () => {
  it('stays during the gesture, then lingers after release', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const el = mount();
    pointer('pointerdown', 50, 50);
    el.show('Removing', { kind: 'progress' });
    el.success('Removed');
    await vi.advanceTimersByTimeAsync(5000);
    expect(el.open).toBe(true); // still holding
    pointer('pointerup', 50, 50);
    await vi.advanceTimersByTimeAsync(1000);
    expect(el.open).toBe(true);
    await vi.advanceTimersByTimeAsync(200);
    expect(el.open).toBe(false);
  });

  it('lingers right away when no gesture is in progress', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const el = mount({ linger: '400' });
    el.success('Saved');
    await vi.advanceTimersByTimeAsync(450);
    expect(el.open).toBe(false);
  });

  it('flash() is a one-shot success', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const el = mount();
    el.flash('Copied #FF5F57');
    expect([el.kind, el.open]).toEqual(['success', true]);
    await vi.advanceTimersByTimeAsync(1200);
    expect(el.open).toBe(false);
  });

  it('flash() can be an error', () => {
    const el = mount();
    el.flash('Copy blocked', { kind: 'error' });
    expect(el.kind).toBe('error');
  });

  it('a success stays visible when the pointer leaves the window', async () => {
    const el = mount();
    move(10, 10);
    el.success('Removed');
    await flush();
    document.body.dispatchEvent(
      new PointerEvent('pointerout', { pointerType: 'mouse', bubbles: true }),
    );
    expect(visible(el)).toBe(true);
  });

  it('anything else hides when the pointer leaves the window, and returns with it', async () => {
    const el = mount();
    move(10, 10);
    el.show('Drop 3 files');
    await flush();
    document.body.dispatchEvent(
      new PointerEvent('pointerout', { pointerType: 'mouse', bubbles: true }),
    );
    expect(visible(el)).toBe(false);
    expect(el.open).toBe(true);
    move(20, 20);
    expect(visible(el)).toBe(true);
  });
});

describe('icon and label', () => {
  it('picks the icon from the kind, unless overridden', async () => {
    const el = mount();
    move(10, 10);
    const icons: string[] = [];
    for (const [kind, icon] of [
      ['info', undefined],
      ['progress', undefined],
      ['success', undefined],
      ['error', undefined],
      ['info', 'plus'],
    ] as const) {
      el.show('x', { kind, icon });
      await flush();
      icons.push(pill(el).dataset.icon!);
    }
    expect(icons).toEqual(['none', 'ring', 'check', 'cross', 'plus']);
  });

  it('morphs a changed label: the old span leaves, the new one enters', async () => {
    const el = mount();
    move(10, 10);
    el.show('Hold to delete');
    await flush();
    expect(labels(el)).toEqual([':Hold to delete']);
    el.show('Deleting', { kind: 'progress', dots: true });
    await flush();
    expect(labels(el)).toEqual(['out:Hold to delete', ':Deleting']);
    expect(el.shadowRoot!.querySelector('.l > span:last-child i')).not.toBeNull(); // dots
    await wait(500);
    expect(labels(el)).toEqual([':Deleting']);
  });

  it('updates rapid same-kind changes in place (live readouts)', async () => {
    const el = mount();
    move(10, 10);
    el.info('Resize');
    await flush();
    await wait(200);
    el.info('240 × 160');
    await flush();
    el.info('241 × 160');
    await flush();
    el.info('242 × 161');
    await flush();
    const spans = labels(el).filter((s) => !s.startsWith('out'));
    expect(spans).toEqual([':242 × 161']);
  });
});

describe('announcements', () => {
  it('announces state changes and final results, not ticks or live readouts', async () => {
    const el = mount();
    el.show('Removing 3 files', { kind: 'progress', dots: true });
    await flush();
    expect(spoken(el)).toBe('Removing 3 files…');
    el.progress = 0.5;
    await flush();
    el.show('Removing 4 files', { kind: 'progress', dots: true });
    await flush();
    expect(spoken(el)).toBe('Removing 3 files…');
    el.success('Removed 4 files');
    await flush();
    expect(spoken(el)).toBe('Removed 4 files');
  });

  it('announces even before the pointer is known (keyboard users)', async () => {
    const el = mount();
    el.flash('Copied');
    await flush();
    expect(spoken(el)).toBe('Copied');
  });

  it('re-announces an identical final result', async () => {
    const el = mount();
    el.flash('Copied');
    await flush();
    el.hide();
    await flush();
    el.flash('Copied');
    await flush();
    expect(spoken(el)?.trim()).toBe('Copied');
    expect(spoken(el)).not.toBe('Copied'); // nudged so screen readers read it again
  });

  it('announce() speaks arbitrary text', () => {
    const el = mount();
    el.announce('Hold Shift to keep the ratio');
    expect(spoken(el)).toBe('Hold Shift to keep the ratio');
  });

  it('keeps the visual pill out of the accessibility tree', () => {
    const el = mount();
    expect(pill(el).getAttribute('aria-hidden')).toBe('true');
    expect(el.shadowRoot!.querySelector('[role=status]')!.getAttribute('aria-live')).toBe('polite');
  });
});

describe('scope and follow', () => {
  it('only follows and shows inside its scope', async () => {
    const area = document.createElement('div');
    area.id = 'area';
    const outside = document.createElement('div');
    document.body.append(area, outside);
    const el = mount({ scope: '#area' }, area);
    el.show('Inside only');
    await flush();
    move(10, 10, outside);
    expect(visible(el)).toBe(false);
    move(20, 20, area);
    expect(visible(el)).toBe(true);
    move(30, 30, outside);
    expect(visible(el)).toBe(false);
    expect(el.open).toBe(true);
  });

  it('nothing appears outside the scope; only a lingering result stays after leaving', async () => {
    const area = document.createElement('div');
    area.id = 'area';
    const outside = document.createElement('div');
    document.body.append(area, outside);
    const el = mount({ scope: '#area' }, area);
    move(20, 20, area);
    move(30, 30, outside);
    el.show('Done', { kind: 'success' });
    await flush();
    expect(visible(el)).toBe(false); // e.g. a "Success" control outside the area
    move(25, 25, area);
    expect(visible(el)).toBe(true);
    move(35, 35, outside);
    expect(visible(el)).toBe(false); // a standing success leaves like any other state

    move(25, 25, area);
    pointer('pointerdown', 25, 25, area);
    el.success('Removed'); // the end of a gesture: lingers
    await flush();
    pointer('pointerup', 25, 25, area);
    move(35, 35, outside);
    expect(visible(el)).toBe(true); // frozen where it was until the linger runs out
  });

  it('follow="manual" ignores the scope', async () => {
    const area = document.createElement('div');
    area.id = 'area';
    const outside = document.createElement('div');
    document.body.append(area, outside);
    const el = mount({ scope: '#area' }, area);
    move(30, 30, outside);
    el.follow = 'manual';
    el.moveTo(100, 100);
    el.info('From the keyboard');
    await flush();
    expect(visible(el)).toBe(true);
  });

  it('follow="manual" ignores the pointer and goes where moveTo() says', async () => {
    const el = mount({ follow: 'manual' });
    el.show('Pinned');
    await flush();
    move(100, 100);
    expect(visible(el)).toBe(false);
    el.moveTo(300, 200);
    expect(visible(el)).toBe(true);
    expect(pos(el).slice(0, 2)).toEqual([318, 220]);
  });

  it('runs several instances independently', async () => {
    const a = mount();
    const b = mount();
    move(10, 10);
    a.show('A');
    await flush();
    expect(visible(a)).toBe(true);
    expect(visible(b)).toBe(false);
    b.flash('B');
    a.hide();
    await flush();
    expect(visible(a)).toBe(false);
    expect(visible(b)).toBe(true);
  });

  it('stops listening once removed', async () => {
    const el = mount();
    el.show('Hi');
    await flush();
    el.remove();
    move(10, 10);
    expect(visible(el)).toBe(false);
  });
});

describe('reduced motion', () => {
  it('motion="reduce" switches to the reduced variant and skips the scale-in', async () => {
    const el = mount({ motion: 'reduce' });
    move(10, 10);
    el.show('Hi');
    await flush();
    expect(pill(el).hasAttribute('data-rm')).toBe(true);
    expect(pos(el)[2]).toBe(1);
  });
});
