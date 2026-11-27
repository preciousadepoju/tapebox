# TAP-02 conformance vectors

The encoder and one-beat simulator in this package are checked against TapeOut's **official**
TAP-02 vectors. They are the ground truth — don't hand-write expected values when a vector exists.

## How to add them

1. Get `vectors.json` from the TapeOut TAPs repo (the `TAP-02` spec folder).
2. Save it here as `packages/tap02/vectors/vectors.json`.
3. Open `../test/vectors.test.ts` and replace the `it.todo(...)` with a loop over the file.

`test/vectors.test.ts` auto-detects the file: with it absent the suite is skipped (so CI stays
green), and with it present the TODO marks that the assertions still need wiring to the real shape.

## Expected shape (to confirm against the real file)

Likely one of:

```jsonc
[
  {
    "name": "single NAND",
    "netlist": "0x00000002000003",   // or a gate list to encode
    "inputs": 2,
    "outputs": 1,
    "eval": [
      { "in": "0x00", "out": "0x01" },
      { "in": "0x03", "out": "0x00" }
    ]
  }
]
```

Once the shape is known, assert both directions: `encodeNetlist(gates) === netlist`, and for each
`eval` case `packBits(evalBeat(circuit, unpackBits(in)))  === out`.
