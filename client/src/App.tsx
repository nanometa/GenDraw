/**
 * Application shell.
 *
 * Mounts the wagmi + RainbowKit providers, the React Router tree, and
 * the global UI surfaces (`WalletBadge`, connection status, toasts,
 * error modal). The wallet is now an explicit "Connect" flow handled by
 * RainbowKit; there's no auto-generated session wallet anymore.
 */

import '@rainbow-me/rainbowkit/styles.css';

import { useEffect, useRef, useState } from 'react';
import {
  RainbowKitProvider,
  darkTheme,
} from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { WagmiProvider } from 'wagmi';

import ConnectionStatus from './components/ConnectionStatus';
import WalletBadge from './components/WalletBadge';
import {
  onModal,
  onToast,
  type ModalErrorEvent,
  type ToastErrorEvent,
} from './lib/errorBus';
import { wagmiConfig } from './lib/wagmi';
import CreateRoom from './pages/CreateRoom';
import Game from './pages/Game';
import Home from './pages/Home';
import JoinRoom from './pages/JoinRoom';
import Leaderboard from './pages/Leaderboard';
import Lobby from './pages/Lobby';
import Results from './pages/Results';
import { AnimatedDots } from './components/ui/animated-dots';
import { GradientBars } from './components/ui/gradient-bars';
import InteractiveBackground from './components/InteractiveBackground';
import { useGameStore } from './store/gameStore';

/** Default auto-dismiss timeout for toasts in milliseconds. */
const DEFAULT_TOAST_MS = 5_000;

/** Single QueryClient instance shared across the app. */
const queryClient = new QueryClient();

/**
 * Routing tree (Requirement 13.3 + neighbouring nav requirements). The
 * `*` fallback redirects unknown paths back to Home so deep-link typos
 * don't leave the user on a blank screen.
 */
function AppRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/create" element={<CreateRoom />} />
      <Route path="/join" element={<JoinRoom />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/lobby/:roomId" element={<Lobby />} />
      <Route path="/game/:roomId" element={<Game />} />
      <Route path="/results/:roomId" element={<Results />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/**
 * Global connection-status indicator (Requirement 16.4). Rendered
 * top-right on routes where the socket connection actually matters
 * (lobby + game + results). Hidden on the marketing surfaces (home,
 * create, join, leaderboard) so a stray "Disconnected" pill doesn't
 * confuse a visitor who hasn't joined a room yet.
 */
function GlobalConnectionStatus(): JSX.Element | null {
  const connection = useGameStore((s) => s.connection);
  const location = useLocation();
  const path = location.pathname;
  const showsOn =
    path.startsWith('/lobby/') ||
    path.startsWith('/results/');
  if (!showsOn) return null;
  return (
    // Pinned to the top left so it stays out of the way of the WalletBadge
    // (top-right) and the Chat panel (right column).
    <div className="fixed left-6 top-5 z-30">
      <ConnectionStatus status={connection} />
    </div>
  );
}

/**
 * Toast surface (Requirements 16.1, 16.2). Subscribes to the error bus
 * and renders a stack of dismissible banners.
 */
function ToastBanner(): JSX.Element | null {
  const [toasts, setToasts] = useState<ToastErrorEvent[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const unsubscribe = onToast((event) => {
      setToasts((prev) => {
        if (prev.some((t) => t.id === event.id)) return prev;
        return [...prev, event];
      });
      const duration = event.durationMs ?? DEFAULT_TOAST_MS;
      if (duration > 0) {
        const handle = window.setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== event.id));
          timersRef.current.delete(event.id);
        }, duration);
        timersRef.current.set(event.id, handle);
      }
    });
    return () => {
      unsubscribe();
      for (const handle of timersRef.current.values()) {
        window.clearTimeout(handle);
      }
      timersRef.current.clear();
    };
  }, []);

  function dismiss(id: string): void {
    const handle = timersRef.current.get(id);
    if (handle !== undefined) {
      window.clearTimeout(handle);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border-2 border-pink/50 bg-bg-deep/90 backdrop-blur px-4 py-3 text-sm font-semibold text-white shadow-chunky"
        >
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
            className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/70 hover:bg-white/10"
          >
            Close
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Modal surface for blocking errors (Requirements 12.5, 16.3, 9.7).
 */
function ErrorModal(): JSX.Element | null {
  const [event, setEvent] = useState<ModalErrorEvent | null>(null);

  useEffect(() => {
    const unsubscribe = onModal((next) => {
      setEvent(next);
    });
    return unsubscribe;
  }, []);

  if (event === null) return null;

  function close(): void {
    setEvent(null);
  }

  function retry(): void {
    const cb = event?.onRetry;
    close();
    if (cb) {
      try {
        cb();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('retry handler threw', err);
      }
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-error-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
    >
      <div className="glass w-full max-w-md rounded-3xl p-6 text-white shadow-chunky border-2 border-pink/40">
        <h2
          id="global-error-modal-title"
          className="font-display text-2xl font-bold text-pink"
        >
          {event.title}
        </h2>
        <p className="mt-2 text-sm text-white/80">{event.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-xl bg-white/10 border-2 border-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/15"
          >
            Close
          </button>
          {event.onRetry ? (
            <button
              type="button"
              onClick={retry}
              className="btn-chunky tertiary text-sm"
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#a855f7',
            accentColorForeground: 'white',
            borderRadius: 'large',
          })}
        >
          <BrowserRouter>
            <InteractiveBackground />
            <WalletBadge />
            <GlobalConnectionStatus />
            <AppRoutes />
            <ToastBanner />
            <ErrorModal />
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
