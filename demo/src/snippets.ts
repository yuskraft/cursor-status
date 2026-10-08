// "View code" snippets: the essence of each tile, not its full source.
export const snippets: Record<string, string> = {
  hold: `const status = document.querySelector('cursor-status');
let raf;

row.addEventListener('pointerdown', () => {
  status.show('Deleting', { kind: 'progress', progress: 0, dots: true });
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min((now - start) / 900, 1);
    status.progress = p;
    if (p < 1) raf = requestAnimationFrame(tick);
    else {
      status.success('Deleted'); // lingers after release
      row.remove();
    }
  };
  raf = requestAnimationFrame(tick);
});

row.addEventListener('pointerup', () => {
  if (status.kind !== 'progress') return;
  cancelAnimationFrame(raf);
  status.info('Cancelled');
  status.hide({ delay: 600 });
});`,

  drop: `zone.addEventListener('dragover', (e) => {
  e.preventDefault();
  const n = e.dataTransfer.items.length;
  if (e.target.closest('.locked')) status.error("Can't drop here");
  else status.info(\`Drop \${n} files\`, { icon: 'plus' });
});

zone.addEventListener('dragleave', (e) => {
  if (!zone.contains(e.relatedTarget)) status.hide();
});

zone.addEventListener('drop', (e) => {
  e.preventDefault();
  addFiles(e.dataTransfer.files);
  status.success(\`Added \${e.dataTransfer.files.length} files\`);
});`,

  resize: `handle.addEventListener('pointerdown', (e) => {
  handle.setPointerCapture(e.pointerId);
  start = { x: e.clientX, y: e.clientY, w, h };
});

handle.addEventListener('pointermove', (e) => {
  if (!start) return;
  w = start.w + e.clientX - start.x;
  h = e.shiftKey ? w / (start.w / start.h) : start.h + e.clientY - start.y;
  resizeBox(w, h);
  status.info(e.shiftKey ? \`Keep ratio · \${w} × \${h}\` : \`\${w} × \${h}\`);
});

handle.addEventListener('lostpointercapture', () => {
  start = null;
  status.hide({ delay: 450 });
});`,

  trash: `card.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  moveCard(e);
  const armed = distance(card, bin) < 80;
  if (armed !== wasArmed) {
    if (armed) status.info('Release to delete', { icon: 'cross' });
    else status.hide();
  }
  wasArmed = armed;
});

card.addEventListener('lostpointercapture', () => {
  if (wasArmed) {
    dropInBin(card);
    status.success('Moved to trash');
  } else {
    springBack(card); // letting go anywhere else is safe
    status.hide();
  }
});`,

  lasso: `area.addEventListener('pointermove', (e) => {
  if (!start) return;
  const rect = marquee(start, e);
  let n = 0;
  for (const dot of dots) n += dot.classList.toggle('on', contains(rect, dot));
  status.info(\`\${n} selected\`); // rapid updates change in place
});

area.addEventListener('lostpointercapture', () => {
  status.announce(\`\${count()} selected\`); // the final result, for screen readers
  status.hide({ delay: 700 });
});`,

  rotate: `const step = 15;

function turn(angle) {
  const near = Math.round(angle / step) * step;
  const snapped = Math.abs(angle - near) <= 4;
  if (snapped) angle = near % 360;
  knob.style.rotate = \`\${angle}deg\`;
  status.info(snapped ? \`Snapped · \${angle}°\` : \`\${angle}°\`, {
    icon: snapped ? 'check' : 'none',
  });
}`,

  swatch: `swatch.addEventListener('click', async () => {
  await navigator.clipboard.writeText(hex);
  status.flash(\`Copied \${hex}\`); // show, succeed, fade
  swatch.classList.add('copied'); // and on the thing you clicked
});`,
};
