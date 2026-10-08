'use client';

import type {
  CursorStatus as CursorStatusElement,
  CursorStatusPlacement,
} from '@yuskraft/cursor-status';
import * as React from 'react';

type CursorStatusAttributes = {
  /** CSS selector: only follow, and only stay visible, while the pointer is inside it. */
  scope?: string;
  /** Side of the cursor; logical, so it flips in RTL. Default `bottom-end`. */
  placement?: CursorStatusPlacement;
  /** Gap from the cursor, `"x y"` in px. Default `"18 20"`. */
  offset?: string;
  /** How long a success stays after the gesture ends, in ms. Default 1100. */
  linger?: number;
  /** Track the pointer, or position with `moveTo()`. Default `pointer`. */
  follow?: 'pointer' | 'manual';
  /** Force a theme; otherwise it follows `prefers-color-scheme`. */
  theme?: 'light' | 'dark';
  /** Force reduced motion; otherwise the system setting applies. */
  motion?: 'reduce';
  /** Follow spring ω. Default 16. */
  stiffness?: number;
};

type CursorStatusProps = Omit<
  React.HTMLAttributes<CursorStatusElement>,
  keyof CursorStatusAttributes | 'children'
> &
  CursorStatusAttributes;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'cursor-status': CursorStatusProps & React.RefAttributes<CursorStatusElement>;
    }
  }
}

/**
 * A status pill that follows the pointer during a gesture. Render one per area, then drive it
 * through the ref, or with `useCursorStatus()`.
 */
const CursorStatus = React.forwardRef<CursorStatusElement, CursorStatusProps>(
  function CursorStatus(props, ref) {
    React.useEffect(() => {
      // Register <cursor-status> in the browser only, so server rendering never touches the DOM.
      void import('@yuskraft/cursor-status/define');
    }, []);
    return <cursor-status ref={ref} {...props} />;
  },
);

export { CursorStatus, type CursorStatusProps };
