import type { Cpu } from '@tapebox/shared';
import type { Circuit } from '@tapebox/tap02';
import type { Hex } from 'viem';

/**
 * Public SDK surface. This is the contract Person C's website builds against — the real
 * `createTapeboxSdk` (talks to a fork or mainnet) and `createMockSdk` (chain-free, fixed
 * answers from the TAP-02 simulator) both implement `TapeboxSdk`, so swapping one for the
 * other never changes a line of UI code.
 */

/** Either a structured circuit (encoded for you) or a pre-encoded netlist blob. */
export type NetlistInput = Circuit | { netlist: Hex; inputs: number; outputs: number };

export interface TapeOutResult {
  /** The minted circuit's token id (ERC-721). */
  id: bigint;
  txHash: Hex;
  /** The exact netlist bytes that were taped out. */
  netlist: Hex;
  inputs: number;
  outputs: number;
}

export interface EvalResult {
  /** Output bits, lowest output wire first. */
  outputs: boolean[];
  /** The raw bit-packed bytes the contract returned. */
  raw: Hex;
}

export interface StepResult {
  newState: Hex;
  outputs: Hex;
}

/** What `circuits.circuitInfo(id)` reports (shape confirmed; field names are our reading). */
export interface CircuitInfo {
  inputs: number;
  outputs: number;
  latches: number;
  gates: number;
}

export interface TapeboxSdk {
  /** The CPU (circuits + transistors pair) this SDK talks to. */
  readonly cpu: Cpu;
  /** Encode (if needed), check, and tape out a circuit. Needs a funded account. */
  tapeOut(input: NetlistInput): Promise<TapeOutResult>;
  /** Evaluate a circuit for one beat. `inputs` may be bits or pre-packed bytes. */
  eval(id: bigint, inputs: boolean[] | Hex): Promise<EvalResult>;
  /** Advance a stateful circuit one beat: (state, inputs) -> (newState, outputs). */
  step(id: bigint, state: Hex, inputs: Hex): Promise<StepResult>;
  /** The fee (in OKB wei) `tapeOut` must pay. */
  tapeoutFee(): Promise<bigint>;
  circuitInfo(id: bigint): Promise<CircuitInfo>;
  /** The stored netlist bytes of a circuit. */
  getNetlist(id: bigint): Promise<Hex>;
}
