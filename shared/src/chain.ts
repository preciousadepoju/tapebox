import { defineChain } from 'viem';

/** X Layer mainnet, the chain TapeOut is deployed on. */
export const xLayer = defineChain({
  id: 196,
  name: 'X Layer',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.xlayer.tech'] },
  },
  blockExplorers: {
    default: { name: 'OKLink', url: 'https://www.oklink.com/xlayer' },
  },
});

/** Public upstream RPCs, in the order the fork tries them. */
export const UPSTREAM_RPCS = [
  'https://rpc.xlayer.tech',
  'https://xlayerrpc.okx.com',
  'https://xlayer.drpc.org',
] as const;

/**
 * Block the fork is pinned to, so every run sees the same state.
 * Bump deliberately (and re-dump state) when TapeOut ships contract upgrades.
 */
export const FORK_BLOCK = 77_014_830n;

/** Default local port for `tapebox up`. */
export const DEFAULT_FORK_PORT = 8545;

/** Public URL of the hosted shared sandbox (RPC proxy in front of anvil). Empty until deployed. */
export const HOSTED_FORK_RPC =
  (typeof process !== 'undefined' && process.env.TAPEBOX_HOSTED_RPC) || '';

/** The Tapebox fork: same chain id as X Layer, so wallets and contracts behave identically. */
export function tapeboxFork(rpcUrl = `http://127.0.0.1:${DEFAULT_FORK_PORT}`) {
  return defineChain({
    ...xLayer,
    name: 'Tapebox (X Layer fork)',
    rpcUrls: { default: { http: [rpcUrl] } },
    testnet: true,
  });
}

/** The cheat-method prefixes that must never reach anvil from the public internet. */
export const CHEAT_METHOD_PREFIXES = ['anvil_', 'evm_', 'hardhat_', 'tenderly_', 'debug_'] as const;
