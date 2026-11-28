# @tapebox/action

A composite GitHub Action that runs `tapebox test` in CI — against a free X Layer fork, or a
chain-free mock. Results are written as JUnit XML, which GitHub renders natively in the checks UI.

## Usage

Add a `tapebox.config.ts` to your repo (see the CLI's `tapebox.config.example.ts`), then:

```yaml
# .github/workflows/tapebox.yml
name: tapebox
on: [push, pull_request]
jobs:
  circuits:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: preciousadepoju/tapebox/packages/action@main
        with:
          junit: tapebox-results.xml
```

A full example (with artifact upload) is in [`examples/ci.yml`](./examples/ci.yml).

## What it does

1. Sets up Node.js.
2. **Real-fork mode (default):** installs `anvil` via `foundry-rs/foundry-toolchain`, restores the
   fork snapshot from `actions/cache`, starts `tapebox up` in the background, runs
   `tapebox test --rpc …`, then stops the fork.
3. **Mock mode (`mock: 'true'`):** skips anvil entirely and runs `tapebox test --mock` — the TAP-02
   simulator gives real answers with no network. Fast, and enough for pure logic checks.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `tapebox-version` | `latest` | npm version/tag of the CLI to run via `npx`. |
| `node-version` | `20` | Node.js version. |
| `config` | `tapebox.config.ts` | Path to the config. |
| `mock` | `false` | Run against the mock SDK (no fork). |
| `rpc` | `http://127.0.0.1:8545` | Fork RPC when not mocking. |
| `foundry-version` | `stable` | Foundry toolchain version (anvil). |
| `fork-block` | `pinned` | Part of the state cache key. |
| `working-directory` | `.` | Directory to run in. |
| `junit` | `tapebox-results.xml` | JUnit report path. |

## Outputs

| Output | Description |
| --- | --- |
| `junit` | Path to the JUnit XML report (always written). |

The action exits non-zero when any test fails, so it fails the check.
