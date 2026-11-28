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

## apps/web (C)

Next.js 16 app with the Tapebox landing page at `/` and the sandbox at `/app`:

| Route | What it does |
| --- | --- |
| `/app/playground` | Netlist editor (`input` / `nand` / `latch` / `output`), live gate diagram, truth table, tapeout through the real Circuits contract (0.0013 OKB fee), `eval` with bit-packed inputs, `step` for circuits with latches |
| `/app/faucet` | Burner wallet funding through `POST /api/faucet` (100 OKB, +1000 NAND, +100 LATCH) |
| `/app/explorer` | Chips taped out on the fork, recent activity, latest blocks |
| `/app/reports` | Viewer for `tapebox test` JSON reports (`?url=` or drag and drop) |
| `/app/docs` | Quick start and netlist format |

```
cp apps/web/.env.example apps/web/.env.local   # set TAPEBOX_RPC and TAPEBOX_ADMIN_TOKEN
pnpm tapebox up                                 # in another terminal
pnpm --filter @tapebox/web dev                  # http://localhost:3000
```

- **Mock mode.** With `TAPEBOX_RPC` unset, the faucet route and the sandbox run in memory with the same fee and burn rules, so the UI works without a chain.
- **Wallets.** A burner key is created in `localStorage` and signs raw transactions, which pass the public proxy. MetaMask or OKX Wallet can be used instead. Chain ID 196 is shared with real X Layer, so the app checks the wallet's block number and hash against the fork before sending anything.
- **Faucet.** `TAPEBOX_ADMIN_TOKEN` stays on the server. Addresses are validated (checksum, no zero address), and requests are limited per address and per IP (`FAUCET_*` env vars). The limiter is in memory, so each server instance keeps its own counts; use a shared store if you run more than one.
- **Netlist encoding.** Records drive wires in order after the inputs: NAND `00|a(3)|b(3)` (operands must be earlier wires), LATCH `01|d(3)` (4 bytes, `d` may point forward), REF `02|circuits(20)|id(8)|arg(2)` (decode only). Outputs are the last `outputs` wires, lowest first. The text compiler adds 2 routing NANDs per output when outputs are not already the last wires, and 4 NANDs per enabled latch.
- **Build.** `dev` and `build` use `--webpack` because `shared/` and `packages/fork` import `.js` paths that point at `.ts` files, which Turbopack does not resolve yet.

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
