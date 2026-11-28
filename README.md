# Tapebox

A free fork of X Layer mainnet for TapeOut builders, with the real contracts, free test transistors, a test runner and a browser playground.

```
pnpm install
pnpm spike          # day-1 spike: fork, fund, tape out a 1-NAND circuit, eval, dump state
pnpm tapebox up     # local fork on :8545, dev accounts pre-funded
pnpm tapebox fund 0xYourAddress
pnpm tapebox snapshot
```

Requires Node 20+, pnpm and [Foundry](https://book.getfoundry.sh/getting-started/installation) (`anvil`). On Windows, use WSL or the prebuilt Windows binaries, or set `ANVIL_BIN`.

## Layout

| Folder | Owner | Holds |
| --- | --- | --- |
| `shared/` | everyone, by review | `src/chain.ts`, `src/addresses.ts`, `src/abis.ts` |
| `packages/fork` | A | `startFork()`, `fund()`, `dumpStateToFile()`, spike script |
| `packages/cli` | A (`up`, `fund`, `snapshot`), B (`test`) | the `tapebox` command |
| `infra/` | A | anvil container, RPC proxy, Caddy, nightly reset |
| `packages/tap02`, `packages/sdk`, `packages/action` | B | |
| `apps/web` | C | |

## What A has established about TapeOut (X Layer, chain 196)

- **Factory** `0x1f09…0761` (UUPS proxy). `cpuAt(i)` returns a CPU's **Circuits** contract (ERC-721). `circuits.transistors()` returns its **Transistors** contract (ERC-1155).
- Transistor token IDs: **NAND = 0, LATCH = 1**. `mint(id, amount)` is payable.
- `tapeout(bytes netlist, uint32 inputs, uint32 outputs)` costs **0.0013 OKB** (`TAPEOUT_FEE`), burns NAND, and returns the circuit ID.
- Netlist records are 7 bytes: an op byte (`00` = NAND), then two 3-byte wire numbers. Inputs start at wire 2, and each gate drives the next wire. A single NAND is `0x00000002000003`. This was confirmed by `eth_call` on mainnet.
- `eval(id, inputs)`: inputs are bit-packed with the LSB as input 0, and it returns bit-packed outputs. `step(id, state, inputs)` returns `(newState, outputs)`.
- Balances use OpenZeppelin v5's namespaced ERC-1155 storage (`0x88be…4500`), which was verified against a real holder. `fund()` writes them directly and falls back to impersonating the CPU creator and transferring tokens.
- Default sandbox CPU: #0 "OnlyTestXLayer", circuits `0x839b…574e`, transistors `0xbe0e…e26d`.

## For C: faucet

```ts
import { fund, forkClient } from '@tapebox/fork';
// server-side only (Next.js API route):
const client = forkClient(process.env.TAPEBOX_RPC!, { adminToken: process.env.TAPEBOX_ADMIN_TOKEN });
await fund(client, address); // 100 OKB, +1000 NAND, +100 LATCH
```

## Hosted sandbox

See `infra/`. On a VPS, in `infra/`:

```
cp .env.example .env   # set ADMIN_TOKEN, DOMAIN and STATE_URL
./fetch-state.sh       # pull the published snapshot into ../state (anvil --load-state)
docker compose up -d
```

State dumps are gitignored (they are large), so they ship as **release assets**, not in the repo. Produce and publish one from a machine with anvil:

```
pnpm spike                                            # writes state/xlayer-fork.json
gh release create fork-state state/xlayer-fork.json   # then set STATE_URL to that asset's URL
```

Without a snapshot the fork still boots, but anvil backfills from the public X Layer RPC on demand, which is slow and rate-limited — so `fetch-state.sh` is the recommended path. The public proxy blocks `anvil_*`, `evm_*`, `hardhat_*`, `debug_*`, `eth_sendTransaction` and `eth_sign*`, rate-limits each IP, and lets only the admin token through for cheat methods. `infra/reset.sh` runs from a nightly cron and reloads `state/xlayer-fork.json`.
