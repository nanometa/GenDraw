/**
 * useWriteClient — produces a genlayer-js write client backed by the
 * connected wagmi/RainbowKit wallet.
 *
 * Returns `null` while the wallet is not connected so pages can simply
 * gate their submit button on `writeClient !== null`. The hook has no
 * fallback path: if the user hasn't connected a wallet, no contract
 * write can happen.
 *
 * The returned client is wrapped with the player's address and a tiny
 * `connectChain` no-op (kept on the API for compatibility with the
 * earlier session-wallet flow; wagmi has already switched the wallet
 * to Studionet by the time `useWalletClient` resolves).
 */

import { useMemo } from 'react';
import { useAccount, useWalletClient } from 'wagmi';

import { createWalletClientFromWagmi, type WriteClient } from './contract';

export interface ActiveWriteClient {
  client: WriteClient;
  /** 0x address that will sign every write. */
  address: string;
  /**
   * Mode label kept on the API so error UI can phrase "wallet will
   * prompt for signing" copy uniformly.
   */
  mode: 'extension';
  /**
   * No-op for the wagmi flow — wagmi negotiated the chain switch
   * already. Kept to match the previous hook's shape so pages don't
   * have to special-case missing methods.
   */
  connectChain(): Promise<void>;
}

export function useWriteClient(): ActiveWriteClient | null {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  return useMemo<ActiveWriteClient | null>(() => {
    if (!isConnected) return null;
    if (address === undefined || walletClient === undefined) return null;
    const client = createWalletClientFromWagmi(walletClient);
    return {
      client,
      address,
      mode: 'extension',
      connectChain: async (): Promise<void> => {
        // wagmi has already switched the wallet to Studionet via
        // RainbowKit's chain modal; nothing to do here.
      },
    };
  }, [address, isConnected, walletClient]);
}
