/**
 * Wagmi + RainbowKit configuration for GenDraw.
 *
 * Uses the canonical `studionet` chain that genlayer-js ships in
 * `genlayer-js/chains`. That object is already a valid viem `Chain`, and
 * — crucially — it carries the SDK-specific fields the write path needs
 * (`defaultConsensusMaxRotations`, `consensusMainContract`, etc.). If we
 * rebuild it with `defineChain` ourselves, those fields are missing and
 * `writeContract` blows up with "Cannot convert undefined to a BigInt".
 *
 * Re-exporting it as `studionetChain` keeps the rest of the codebase
 * (`lib/contract.ts`) decoupled from the SDK's chain registry — if we
 * later want to support testnetBradbury / testnetAsimov this is the file
 * to extend.
 */

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { studionet } from 'genlayer-js/chains';
import type { Config } from 'wagmi';

/** Re-exported genlayer-js Studionet chain (carries SDK-specific fields). */
export const studionetChain = studionet;

/**
 * RainbowKit + wagmi config. WalletConnect's `projectId` is required for
 * the WalletConnect-based wallets to work (Rainbow mobile, Trust, etc.).
 * Set it in `client/.env.local` as `VITE_WALLETCONNECT_PROJECT_ID=...`;
 * a free project id can be created at https://cloud.reown.com/.
 *
 * The placeholder fallback keeps the dev server running even when the
 * env var is missing — MetaMask + injected wallets still work without
 * WalletConnect.
 */
const projectId =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined) ??
  'gendraw-dev';

export const wagmiConfig: Config = getDefaultConfig({
  appName: 'GenDraw',
  projectId,
  chains: [studionetChain as never],
  // SSR is off — Vite client-only — so wagmi will use the in-memory
  // storage by default, which is fine for our use case.
  ssr: false,
});
