import { type Cpu, DEFAULT_CPU, circuitsAbi, tapeboxFork } from '@tapebox/shared';
import { assertWellFormed, encodeNetlist, packBits, unpackBits } from '@tapebox/tap02';
import {
  http,
  type Account,
  type Hex,
  type Transport,
  createPublicClient,
  createWalletClient,
  parseEventLogs,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { NetlistInput, TapeboxSdk } from './types.js';

export interface CreateSdkOptions {
  /** RPC of the fork (`tapebox up`) or mainnet — the API is identical on both. */
  rpcUrl: string;
  /** Which CPU to use. Defaults to the sandbox CPU (`DEFAULT_CPU`). */
  cpu?: Cpu;
  /** Account for writes (`tapeOut`). A viem Account or a 0x-prefixed private key. Reads need none. */
  account?: Account | Hex;
  /** Custom viem transport (e.g. a batching http transport). Defaults to `http(rpcUrl)`. */
  transport?: Transport;
}

/** Normalize a NetlistInput to encoded bytes, running the well-formedness check for structured input. */
function resolveNetlist(input: NetlistInput): { netlist: Hex; inputs: number; outputs: number } {
  if ('netlist' in input) return input;
  assertWellFormed(input);
  return { netlist: encodeNetlist(input.gates), inputs: input.inputs, outputs: input.outputs };
}

/** Create an SDK bound to a single CPU on a fork or on mainnet. */
export function createTapeboxSdk(opts: CreateSdkOptions): TapeboxSdk {
  const cpu = opts.cpu ?? DEFAULT_CPU;
  const chain = tapeboxFork(opts.rpcUrl);
  const transport = opts.transport ?? http(opts.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const account =
    typeof opts.account === 'string' ? privateKeyToAccount(opts.account) : opts.account;
  const walletClient = account ? createWalletClient({ account, chain, transport }) : undefined;

  async function circuitInfo(id: bigint) {
    const [inputs, outputs, latches, gates] = await publicClient.readContract({
      address: cpu.circuits,
      abi: circuitsAbi,
      functionName: 'circuitInfo',
      args: [id],
    });
    return { inputs, outputs, latches, gates };
  }

  return {
    cpu,

    async tapeOut(input) {
      if (!walletClient || !account) {
        throw new Error('tapeOut needs an account: pass `account` to createTapeboxSdk');
      }
      const { netlist, inputs, outputs } = resolveNetlist(input);
      const fee = await publicClient.readContract({
        address: cpu.circuits,
        abi: circuitsAbi,
        functionName: 'TAPEOUT_FEE',
      });
      const { request, result } = await publicClient.simulateContract({
        account,
        address: cpu.circuits,
        abi: circuitsAbi,
        functionName: 'tapeout',
        args: [netlist, inputs, outputs],
        value: fee,
      });
      const txHash = await walletClient.writeContract(request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== 'success') throw new Error(`tapeout reverted: ${txHash}`);
      const minted = parseEventLogs({
        abi: circuitsAbi,
        eventName: 'Transfer',
        logs: receipt.logs,
      })[0];
      return { id: minted?.args.tokenId ?? result, txHash, netlist, inputs, outputs };
    },

    async eval(id, inputs, opts) {
      const raw = typeof inputs === 'string' ? inputs : packBits(inputs);
      const out = await publicClient.readContract({
        address: cpu.circuits,
        abi: circuitsAbi,
        functionName: 'eval',
        args: [id, raw],
      });
      // Skip the extra circuitInfo round-trip when the caller already knows the output width.
      const outputs = opts?.outputs ?? (await circuitInfo(id)).outputs;
      return { outputs: unpackBits(out, outputs), raw: out };
    },

    async step(id, state, inputs) {
      const [newState, outputs] = await publicClient.readContract({
        address: cpu.circuits,
        abi: circuitsAbi,
        functionName: 'step',
        args: [id, state, inputs],
      });
      return { newState, outputs };
    },

    tapeoutFee() {
      return publicClient.readContract({
        address: cpu.circuits,
        abi: circuitsAbi,
        functionName: 'TAPEOUT_FEE',
      });
    },

    circuitInfo,

    getNetlist(id) {
      return publicClient.readContract({
        address: cpu.circuits,
        abi: circuitsAbi,
        functionName: 'netlist',
        args: [id],
      });
    },
  };
}
