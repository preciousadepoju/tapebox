import type { Address } from 'viem';

/**
 * TapeOut contracts on X Layer mainnet (chain 196), read on-chain at block 77,014,830.
 *
 * Layout:
 *   Factory (UUPS proxy) ── createCPU() ──▶ one "CPU" per project, made of two beacon proxies:
 *     • Transistors  (ERC-1155, token ids NAND = 0, LATCH = 1, mint(id, amount) payable)
 *     • Circuits     (ERC-721, tapeout(netlist, inputs, outputs) burns transistors, eval(), step())
 *   factory.cpuAt(i) returns the CPU's Circuits contract; circuits.transistors() gives its ERC-1155.
 */
export const addresses = {
  factory: '0x1f09DAeFA827f02CBb40967cc91b259763760761',
  factoryImplementation: '0x336e9f0f4c3fee7c8c803377e4dea00293f4ae2a',
  factoryOwner: '0xb3d85b42a045c1a88d800cad0f55d2566a4d3138',
  transistorBeacon: '0x1059ad62cabb6a6925bb65aa617300556c60a51b',
  transistorImplementation: '0x265bf10fab9ddec0ee0a649c6b9db845f1b9a06b',
  circuitBeacon: '0xf70d1ed4f62cf3780157b0b421b7e2f45bd0991c',
  circuitImplementation: '0x977f217887e085d298cb3819cdad5a0ee35f29b2',
  protocolWallet: '0x571d447f4f24688ec35ccf07f1d6993655f6af15',
  treasury: '0xebecedea36e598b64e17f8d519eb77441c539f76',
  /** BEM: LayerZero OFT token referenced by the factory. */
  bem: '0x60e62efa9405d6873c5deabd4e6cc91c25363952',
} as const satisfies Record<string, Address>;

/** A CPU = the pair of contracts a builder actually talks to. */
export interface Cpu {
  name: string;
  circuits: Address;
  transistors: Address;
}

/**
 * Default CPU used by the sandbox: CPU #0, "OnlyTestXLayer", deployed by the protocol wallet.
 * Its public supply is sold out on mainnet, which does not matter on the fork: fund() writes balances.
 */
export const DEFAULT_CPU: Cpu = {
  name: 'OnlyTestXLayer',
  circuits: '0x839bdd6fa7a66416a609a735e11de5411b98574e',
  transistors: '0xbe0eee424c49d44592e4d498740f5b031ef8e26d',
};

/** ERC-1155 token ids on every Transistors contract. */
export const TRANSISTOR_IDS = { NAND: 0n, LATCH: 1n } as const;

/** Fee in wei (OKB) charged by Circuits.tapeout, read from TAPEOUT_FEE(): 0.0013 OKB. */
export const TAPEOUT_FEE_WEI = 1_300_000_000_000_000n;
