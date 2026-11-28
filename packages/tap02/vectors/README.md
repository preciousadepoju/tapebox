# TAP-02 conformance vectors

`vectors.json` is the **official** TAP-02 conformance suite, vendored verbatim from the spec repo:

- Source: [`TapeOutProtocol/TAPs`](https://github.com/TapeOutProtocol/TAPs) → `assets/tap-02/vectors.json`
- Format tag: `tap-netlist-vectors/1`
- Kept byte-for-byte as upstream (Biome is configured to ignore it), so it stays diffable against the source. Re-vendor by copying a newer `assets/tap-02/vectors.json`.

`test/vectors.test.ts` runs the encoder, well-formedness check and one-beat simulator against it.

## What is covered

- **`valid` (combinational, `nState: 0`)** — `nand`, `constants`, and `popcount8_3151` (3,151 NAND
  gates, all 256 rows) are checked by taping-out/evaluating every truth-table row.
- **`illFormed`** — all 8 cases must be rejected (unknown opcode, truncated record, forward
  reference, `nOut = 0`, too few signals, REF arity/target).
- **`packingEdgeCases`** — padding bits, extra bytes, and empty input, via LSB-first packing.

## Not covered yet

The stateful vectors (`toggle`, `ref_with_state`) use LATCH/REF and have no truth table — they
belong to the multi-beat `step()` path, which is still stubbed. Wire them in when `step()` lands.
