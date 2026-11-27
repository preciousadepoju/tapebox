# @tapebox/sdk

`tapeOut()`, `eval()` and `step()` with **one API on the fork and on mainnet**. Everything is
typed against `TapeboxSdk`, and there are two implementations behind that one interface:

- `createTapeboxSdk({ rpcUrl, account? })` — talks to a real chain (your `tapebox up` fork, or X Layer mainnet).
- `createMockSdk()` — no chain at all; `eval` runs the TAP-02 simulator and returns the real answer.

## For Person C (the website)

Build the whole playground against the **mock** today, then switch one line to the real SDK
when the fork is up — the UI code doesn't change, because both are a `TapeboxSdk`.

```ts
import { createMockSdk, type TapeboxSdk } from '@tapebox/sdk';
import { OP } from '@tapebox/tap02';

const sdk: TapeboxSdk = createMockSdk();

const { id } = await sdk.tapeOut({ inputs: 2, outputs: 1, gates: [{ op: OP.NAND, a: 2, b: 3 }] });
const { outputs } = await sdk.eval(id, [true, true]); // -> [false]  (NAND)
```

Switch to the real chain later (reads need no account; `tapeOut` needs one):

```ts
import { createTapeboxSdk } from '@tapebox/sdk';
const sdk = createTapeboxSdk({ rpcUrl: 'http://127.0.0.1:8545', account: '0x<key>' });
```

## API

| Method | Returns | Notes |
| --- | --- | --- |
| `tapeOut(input)` | `{ id, txHash, netlist, inputs, outputs }` | `input` is a `Circuit` (encoded + checked for you) or `{ netlist, inputs, outputs }`. Needs an account. |
| `eval(id, inputs)` | `{ outputs: boolean[], raw: Hex }` | `inputs` as bits (`boolean[]`) or packed bytes (`Hex`). |
| `step(id, state, inputs)` | `{ newState, outputs }` | Stateful circuits; **not in the mock yet** (LATCH pending vectors). |
| `tapeoutFee()` | `bigint` | OKB wei required by `tapeOut`. |
| `circuitInfo(id)` | `{ inputs, outputs, latches, gates }` | |
| `getNetlist(id)` | `Hex` | |

## Status

The real SDK's reads/writes use the ABIs A confirmed against mainnet and were exercised by A's
spike (tapeout + eval of a NAND). `step()` on the real SDK forwards to the contract; the mock's
`step()` and LATCH evaluation are stubbed until the official TAP-02 vectors land
(see `packages/tap02/vectors/README.md`).
