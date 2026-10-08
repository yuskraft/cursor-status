// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CursorStatus } from '../registry/cursor-status/cursor-status';

describe('<CursorStatus> on the server', () => {
  it('renders the bare tag with its attributes, without touching the DOM', () => {
    expect(typeof globalThis.document).toBe('undefined');
    const html = renderToString(<CursorStatus scope="#drop" linger={800} placement="top-end" />);
    expect(html).toBe(
      '<cursor-status scope="#drop" linger="800" placement="top-end"></cursor-status>',
    );
  });
});
