import { FORK_BLOCK } from '@tapebox/shared';
import { type Address, type Hex, formatEther, parseAbiItem, zeroAddress } from 'viem';
import { packBits, unpackBits } from '../bits';
import { publicClient } from '../chain';
import { sandboxSdk } from '../sdk';
import { cpu, readBalances, readTapeoutFee, tapeout as sendTapeout } from '../tapeout';
import type { Bits, Compiled } from '../tnl';
import type { Activity, Chip, Sandbox } from './types';

const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
);

function toBits(names: string[], values: Bits) {
  return names.map((n) => Boolean(values[n]));
}
function fromBits(names: string[], bits: boolean[]): Bits {
  return Object.fromEntries(names.map((n, i) => [n, Boolean(bits[i])]));
}

export function fmtOkb(wei: bigint) {
  const [whole, frac = ''] = formatEther(wei).split('.');
  return `${whole}.${frac.padEnd(4, '0').slice(0, 4)}`;
}

/** The real thing: TapeOut contracts on the Tapebox fork, through the public RPC. */
export function createForkSandbox(names: Map<string, string>): Sandbox {
  const local: Activity[] = [];
  const blockTimes = new Map<bigint, number>();

  async function step(args: { circuitId: string; compiled: Compiled; inputs: Bits; state: Bits }) {
    const { compiled } = args;
    const { newState, outputs } = await sandboxSdk.step(
      BigInt(args.circuitId),
      packBits(toBits(compiled.latches, args.state)),
      packBits(toBits(compiled.inputs, args.inputs)),
    );
    return {
      outputs: fromBits(compiled.outputs, unpackBits(outputs, compiled.outputs.length)),
      state: fromBits(compiled.latches, unpackBits(newState, compiled.latches.length)),
    };
  }

  async function mintedLogs() {
    const latest = await publicClient.getBlockNumber();
    return publicClient.getLogs({
      address: cpu.circuits,
      event: transferEvent,
      args: { from: zeroAddress },
      fromBlock: FORK_BLOCK + 1n > latest ? latest : FORK_BLOCK + 1n,
      toBlock: latest,
    });
  }

  return {
    mode: 'fork',
    async balances(address) {
      const b = await readBalances(address);
      return { okb: fmtOkb(b.okb), okbWei: b.okb, nand: Number(b.nand), latch: Number(b.latch) };
    },
    async tapeOut({ compiled, account, wallet, name }) {
      if (!wallet) throw new Error('no wallet yet');
      const fee = await readTapeoutFee();
      const r = await sendTapeout(wallet, account, compiled.circuit, fee);
      const id = r.id.toString();
      if (name) names.set(id, name);
      return { circuitId: id, txHash: r.hash };
    },
    async eval(args) {
      if (args.compiled.latches.length > 0) {
        return (await step({ ...args, state: args.state ?? {} })).outputs;
      }
      const { outputs } = await sandboxSdk.eval(
        BigInt(args.circuitId),
        toBits(args.compiled.inputs, args.inputs),
        { outputs: args.compiled.outputs.length },
      );
      return fromBits(args.compiled.outputs, outputs);
    },
    step,
    async chips(owner) {
      const logs = await mintedLogs();
      const missing = [...new Set(logs.map((l) => l.blockNumber))].filter(
        (n) => !blockTimes.has(n),
      );
      await Promise.all(
        missing.map(async (n) => {
          const b = await publicClient.getBlock({ blockNumber: n });
          blockTimes.set(n, Number(b.timestamp) * 1000);
        }),
      );
      const chips: Chip[] = [];
      for (const l of logs) {
        const to = l.args.to as Address;
        if (owner && to.toLowerCase() !== owner.toLowerCase()) continue;
        const id = (l.args.tokenId as bigint).toString();
        chips.push({
          circuitId: id,
          name: names.get(id) ?? `chip #${id}`,
          owner: to,
          createdAt: blockTimes.get(l.blockNumber) ?? Date.now(),
          blockNumber: l.blockNumber,
          txHash: l.transactionHash as Hex,
        });
      }
      // Enrich with each circuit's composition (inputs/outputs/latches/gates) for the explorer.
      await Promise.all(
        chips.map(async (c) => {
          try {
            const info = await sandboxSdk.circuitInfo(BigInt(c.circuitId));
            c.inputs = info.inputs;
            c.outputs = info.outputs;
            c.latches = info.latches;
            c.gates = info.gates;
          } catch {
            // leave the stats undefined if the read fails
          }
        }),
      );
      return chips.reverse();
    },
    async activity(limit = 50) {
      const chips = await this.chips();
      const onChain: Activity[] = chips.map((c) => ({
        txHash: c.txHash ?? `0x${c.circuitId}`,
        kind: 'tapeOut',
        from: c.owner,
        summary: `taped out ${c.name}`,
        blockNumber: c.blockNumber ?? null,
        timestamp: c.createdAt,
      }));
      return [...local, ...onChain].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    },
    log(entry) {
      local.unshift({ ...entry, blockNumber: entry.blockNumber ?? null, timestamp: Date.now() });
      local.splice(200);
    },
  };
}
