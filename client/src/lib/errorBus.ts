/**
 * Tiny module-level pub/sub used by the global error surfaces in
 * `App.tsx` (Requirements 12.5, 16.1, 16.2, 16.3).
 *
 * The bus is intentionally minimal — it keeps the App-shell scaffold
 * agnostic of how individual pages choose to report errors (via
 * `lib/contract.ts`, socket events, etc.) and lets the orchestrator wire
 * publishers in later without a refactor.
 *
 * Two channels are exposed:
 *  - `toast`: transient banner errors that auto-dismiss (Req 16.1, 16.2).
 *  - `modal`: blocking errors that need an explicit user action, such as
 *    `END_ROUND_FAILED` (Req 9.7) and consensus timeouts (Req 12.5, 16.3).
 *
 * The bus is a synchronous event emitter; subscribers are notified in
 * registration order. Subscribers must be careful not to throw — failures
 * are caught and logged so a single misbehaving subscriber cannot break
 * the rest of the UI.
 */

/** Payload for a transient toast error (Req 16.1, 16.2). */
export interface ToastErrorEvent {
  /** Stable id used as React key + dedupe handle. */
  id: string;
  /** User-visible message. */
  message: string;
  /**
   * Auto-dismiss timeout in milliseconds. Defaults to 5_000. Pass `0` to
   * disable auto-dismiss entirely (the user must dismiss manually).
   */
  durationMs?: number;
}

/** Payload for a blocking modal error (Req 12.5, 16.3, 9.7). */
export interface ModalErrorEvent {
  /** Stable id used to coalesce duplicate modals. */
  id: string;
  /**
   * Discriminator for known classes of failure. Free-form strings are
   * accepted so future error sources don't require a code change here.
   */
  kind: 'END_ROUND_FAILED' | 'CONSENSUS_TIMEOUT' | (string & {});
  /** Short heading rendered in the modal. */
  title: string;
  /** Full message body. */
  message: string;
  /**
   * Optional retry callback. When present, the modal renders a "Retry"
   * button that invokes this handler before closing.
   */
  onRetry?: () => void;
}

type ToastListener = (event: ToastErrorEvent) => void;
type ModalListener = (event: ModalErrorEvent) => void;

const toastListeners = new Set<ToastListener>();
const modalListeners = new Set<ModalListener>();

/** Subscribe to toast events. Returns an unsubscribe handle. */
export function onToast(listener: ToastListener): () => void {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

/** Subscribe to modal events. Returns an unsubscribe handle. */
export function onModal(listener: ModalListener): () => void {
  modalListeners.add(listener);
  return () => {
    modalListeners.delete(listener);
  };
}

/** Publish a toast error to all subscribers. */
export function emitToast(event: ToastErrorEvent): void {
  for (const listener of toastListeners) {
    try {
      listener(event);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('toast listener threw', err);
    }
  }
}

/** Publish a modal error to all subscribers. */
export function emitModal(event: ModalErrorEvent): void {
  for (const listener of modalListeners) {
    try {
      listener(event);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('modal listener threw', err);
    }
  }
}
