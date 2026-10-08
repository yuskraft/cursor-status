import { CursorStatus } from './cursor-status';

if (typeof customElements !== 'undefined' && !customElements.get('cursor-status')) {
  customElements.define('cursor-status', CursorStatus);
}

export { CursorStatus };
