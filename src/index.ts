// Side-effect free: exports the class and types. Import `@yuskraft/cursor-status/define` to register
// <cursor-status>, or call customElements.define() yourself with a tag of your choice.
export type {
  CursorStatusIcon,
  CursorStatusKind,
  CursorStatusOptions,
  CursorStatusPlacement,
} from './cursor-status';
export { CursorStatus, spring } from './cursor-status';
