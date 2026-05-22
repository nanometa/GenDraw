/**
 * WalletBadge — fully custom glassmorphic wrapper around RainbowKit's
 * `<ConnectButton.Custom>` render-prop API. Default RainbowKit chips
 * ship with an opaque dark background that clashes with the rest of
 * the site, so we build the layout ourselves and only borrow
 * RainbowKit's connection state + dialog handlers.
 *
 * Layout (connected state):
 *   [ chain pill ]  [ balance · 0x1234…abcd  ▾ ]
 * Each chip is a frosted-glass surface with a thin bright border that
 * lights up on hover. The avatar is a pure CSS gradient — no
 * cartoonish PNG, no third-party blockie. The dropdown chevron uses
 * a `stroke-width: 1.5` line for an elegant look.
 *
 * The component still wires RainbowKit's three primary actions:
 *   - openConnectModal   (when no wallet is connected)
 *   - openChainModal     (chain pill click — switches network)
 *   - openAccountModal   (account pill click — opens account dialog)
 */

import { ConnectButton } from '@rainbow-me/rainbowkit';

/** Lightweight Web3 avatar — CSS gradient circle keyed off the address
 *  so each wallet gets a consistent personal hue without shipping any
 *  bitmap art. */
function GradientAvatar({ address }: { address: string }): JSX.Element {
  // Two stable hues derived from the address — first byte and last
  // byte modulo 360 give us a colour pair the user can recognise
  // without being noisy.
  const hueA = parseInt(address.slice(2, 4), 16) % 360;
  const hueB = parseInt(address.slice(-2), 16) % 360;
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex h-5 w-5 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-white/30"
      style={{
        background: `conic-gradient(from 220deg at 50% 50%, hsl(${hueA} 80% 60%), hsl(${hueB} 85% 55%), hsl(${hueA} 80% 60%))`,
      }}
    />
  );
}

/** Thin chevron used by both dropdowns (chain + account). */
function Chevron(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      className="ml-1 text-white/55"
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const PILL_BASE = [
  'inline-flex items-center gap-2 rounded-xl px-3 py-2',
  'bg-white/5 border border-white/10 backdrop-blur-md',
  'text-white/85 text-sm font-medium',
  'transition-all duration-300 ease-out',
  'hover:bg-white/10 hover:border-white/30 hover:text-white',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow/50',
].join(' ');

export default function WalletBadge(): JSX.Element {
  return (
    <div className="fixed right-3 top-3 z-30">
      <ConnectButton.Custom>
        {({
          account,
          chain,
          openAccountModal,
          openChainModal,
          openConnectModal,
          authenticationStatus,
          mounted,
        }) => {
          const ready = mounted && authenticationStatus !== 'loading';
          const connected =
            ready &&
            account &&
            chain &&
            (!authenticationStatus || authenticationStatus === 'authenticated');

          return (
            <div
              {...(!ready && {
                'aria-hidden': true,
                style: {
                  opacity: 0,
                  pointerEvents: 'none',
                  userSelect: 'none',
                },
              })}
              className="flex items-center gap-2"
            >
              {(() => {
                if (!connected) {
                  return (
                    <button
                      type="button"
                      onClick={openConnectModal}
                      className={PILL_BASE}
                    >
                      Connect Wallet
                    </button>
                  );
                }

                if (chain.unsupported) {
                  return (
                    <button
                      type="button"
                      onClick={openChainModal}
                      className={[PILL_BASE, 'border-pink/40 text-pink'].join(
                        ' ',
                      )}
                    >
                      Wrong network
                      <Chevron />
                    </button>
                  );
                }

                // Chain pill is intentionally not rendered — the only
                // network we ship for is Studionet, and a redundant
                // pill on every page just adds visual noise. The
                // account pill stays as the single wallet anchor.
                return (
                  <button
                    type="button"
                    onClick={openAccountModal}
                    className={PILL_BASE}
                    aria-label={`Open account dialog. Address: ${account.address}`}
                  >
                    <GradientAvatar address={account.address} />

                    {account.displayBalance ? (
                      <>
                        <span className="text-white/60 text-sm font-medium tabular-nums">
                          {account.displayBalance}
                        </span>
                        <span
                          aria-hidden="true"
                          className="h-3 w-px bg-white/15"
                        />
                      </>
                    ) : null}

                    <span className="font-mono text-sm text-white tracking-wide">
                      {account.displayName}
                    </span>

                    <Chevron />
                  </button>
                );
              })()}
            </div>
          );
        }}
      </ConnectButton.Custom>
    </div>
  );
}
