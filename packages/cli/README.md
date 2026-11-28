# tapebox

A free fork of X Layer mainnet for [TapeOut](https://github.com/TapeOutProtocol/TAPs) builders —
real contracts, free test transistors, a test runner, and a circuit builder.

```bash
npm i -g @zevbuilds/tapebox         # or run any command with: npx @zevbuilds/tapebox <cmd>
tapebox up                          # local X Layer fork on :8545, dev accounts pre-funded
tapebox fund 0xYourAddress          # free OKB + NAND/LATCH
tapebox test --mock                 # run tapebox.config.ts (no chain needed)
tapebox inspect 0x00000002000003 --inputs 2 --table
```

Requires Node 20+ and [Foundry](https://book.getfoundry.sh/getting-started/installation) (`anvil`)
for the fork commands. On Windows, set `ANVIL_BIN` if `anvil` is not on `PATH`.

## Commands

| Command | What it does |
| --- | --- |
| `tapebox up` | Start a local fork (loads `./state/xlayer-fork.json` if present) |
| `tapebox fund <address>` | Give a wallet free OKB, NAND and LATCH |
| `tapebox snapshot [file]` | Dump the running fork's state |
| `tapebox test` | Run `tapebox.config.ts` (truth tables + stateful `beats`) against a fork or `--mock`; reports to the terminal and `--json` / `--md` / `--junit` / `--html` |
| `tapebox inspect [netlist]` | Decode a circuit (hex, or `--id <n>` from a fork) into its parts |
| `tapebox run <id>` | Evaluate/step a deployed circuit on a fork |

See the [repository](https://github.com/preciousadepoju/tapebox) for the SDK (`@tapebox/sdk`), the
circuit builder (`@tapebox/tap02`), and the browser playground.
