import type { Address, Hex } from 'viem';
import { FAUCET_DRIP } from '../faucet/config';
import { simulate } from '../netlist';
import type { Bits } from '../tnl';
import type { Activity, Chip, Sandbox } from './types';

const WEI = 10n ** 18n;
const FEE = 1_300_000_000_000_000n;

function rand(bytes: number): Hex {
  const b = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(b);
  return `0x${Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * In-browser stand-in used only when the server has no TAPEBOX_RPC. Same rules as the fork
 * (fee, NAND and LATCH burn, step semantics), nothing leaves the page.
 */
export function createMockSandbox(latencyMs = 250): Sandbox {
  let block = 77_014_830n;
  const accounts = new Map<string, { okbWei: bigint; nand: number; latch: number }>();
  const chips = new Map<string, Chip & { gates_: import('../netlist').Circuit }>();
  const log: Activity[] = [];
  let nextId = 1000;
  const wait = () => new Promise((r) => setTimeout(r, latencyMs));
  const acct = (a: Address) => {
    const k = a.toLowerCase();
    let v = accounts.get(k);
    if (!v) {
      v = { okbWei: 0n, nand: 0, latch: 0 };
      accounts.set(k, v);
    }
    return v;
  };
  const record = (e: Omit<Activity, 'timestamp' | 'blockNumber'>) => {
    block += 1n;
    log.unshift({ ...e, blockNumber: block, timestamp: Date.now() });
    return block;
  };
  const bitsOf = (names: string[], v: Bits) => names.map((n) => Boolean(v[n]));
  const named = (names: string[], bits: boolean[]): Bits =>
    Object.fromEntries(names.map((n, i) => [n, Boolean(bits[i])]));

  const sandbox: Sandbox = {
    mode: 'mock',
    credit(address) {
      const a = acct(address);
      a.okbWei = BigInt(FAUCET_DRIP.okb) * WEI;
      a.nand += Number(FAUCET_DRIP.nand);
      a.latch += Number(FAUCET_DRIP.latch);
      record({
        txHash: rand(32),
        kind: 'faucet',
        from: address,
        summary: `${FAUCET_DRIP.okb} OKB, +${FAUCET_DRIP.nand} NAND, +${FAUCET_DRIP.latch} LATCH`,
      });
    },
    async balances(address) {
      const a = acct(address);
      const frac = ((a.okbWei % WEI) * 10000n) / WEI;
      return {
        okb: `${a.okbWei / WEI}.${frac.toString().padStart(4, '0')}`,
        okbWei: a.okbWei,
        nand: a.nand,
        latch: a.latch,
      };
    },
    async tapeOut({ compiled, account, name }) {
      await wait();
      const a = acct(account);
      const { nand, latch } = compiled.cost;
      if (a.nand < nand || a.latch < latch) {
        throw new Error(
          `not enough transistors: need ${nand} NAND + ${latch} LATCH, have ${a.nand} + ${a.latch}. Use the faucet.`,
        );
      }
      if (a.okbWei < FEE) throw new Error('not enough OKB for the 0.0013 OKB fee. Use the faucet.');
      a.nand -= nand;
      a.latch -= latch;
      a.okbWei -= FEE;
      const id = String(nextId++);
      const txHash = rand(32);
      const label = name?.trim() || `chip #${id}`;
      const blockNumber = record({
        txHash,
        kind: 'tapeOut',
        from: account,
        summary: `taped out ${label} (${nand} NAND, ${latch} LATCH)`,
      });
      chips.set(id, {
        circuitId: id,
        name: label,
        owner: account,
        createdAt: Date.now(),
        blockNumber,
        txHash,
        gates_: compiled.circuit,
      });
      return { circuitId: id, txHash };
    },
    async eval({ circuitId, compiled, inputs, state }) {
      await wait();
      const chip = chips.get(circuitId);
      if (!chip) throw new Error(`no circuit ${circuitId} on this sandbox`);
      const r = simulate(
        chip.gates_,
        bitsOf(compiled.inputs, inputs),
        bitsOf(compiled.latches, state ?? {}),
      );
      return named(compiled.outputs, r.outputs);
    },
    async step({ circuitId, compiled, inputs, state }) {
      await wait();
      const chip = chips.get(circuitId);
      if (!chip) throw new Error(`no circuit ${circuitId} on this sandbox`);
      const r = simulate(
        chip.gates_,
        bitsOf(compiled.inputs, inputs),
        bitsOf(compiled.latches, state),
      );
      return {
        outputs: named(compiled.outputs, r.outputs),
        state: named(compiled.latches, r.nextState),
      };
    },
    async chips(owner) {
      const list = [...chips.values()].map(({ gates_, ...c }) => c);
      return (
        owner ? list.filter((c) => c.owner.toLowerCase() === owner.toLowerCase()) : list
      ).sort((a, b) => b.createdAt - a.createdAt);
    },
    async activity(limit = 50) {
      return log.slice(0, limit);
    },
    log(entry) {
      log.unshift({ ...entry, blockNumber: entry.blockNumber ?? block, timestamp: Date.now() });
    },
  };
  return sandbox;
}
