/**
 * Day-1 spike: the whole project rests on this.
 *   1. Fork X Layer mainnet with anvil at the pinned block
 *   2. Use the default CPU (transistors + circuits behind the factory)
 *   3. Give a fresh test wallet OKB, NAND and LATCH
 *   4. Tape out a 1-NAND circuit and eval its full truth table
 *   5. Dump the state so everyone loads the same fork
 *
 *   pnpm spike                      # starts its own anvil
 *   pnpm spike -- --rpc http://127.0.0.1:8545   # use an anvil you already started
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_CPU, TRANSISTOR_IDS, circuitsAbi, transistorsAbi } from '@tapebox/shared';
import { type Hex, formatEther, parseEventLogs } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { dumpStateToFile, forkClient, fund, startFork } from '../src/index.js';

const argRpc = process.argv.indexOf('--rpc');
const externalRpc = argRpc > 0 ? process.argv[argRpc + 1] : undefined;
const stateDir = join(import.meta.dirname, '..', '..', '..', 'state');

const step = (n: number, msg: string) => console.log(`\n[${n}/5] ${msg}`);
const ok = (msg: string) => console.log(`      ok  ${msg}`);

step(1, 'Forking X Layer mainnet');
const fork = externalRpc ? undefined : await startFork();
const rpcUrl = externalRpc ?? fork?.rpcUrl ?? '';
const client = forkClient(rpcUrl);
try {
  const block = await client.getBlockNumber();
  ok(`anvil at ${rpcUrl}, chain ${await client.getChainId()}, block ${block}`);

  step(2, `Using CPU "${DEFAULT_CPU.name}"`);
  const [nandId, latchId, fee, transistorsOfCircuits] = await Promise.all([
    client.readContract({
      address: DEFAULT_CPU.transistors,
      abi: transistorsAbi,
      functionName: 'NAND',
    }),
    client.readContract({
      address: DEFAULT_CPU.transistors,
      abi: transistorsAbi,
      functionName: 'LATCH',
    }),
    client.readContract({
      address: DEFAULT_CPU.circuits,
      abi: circuitsAbi,
      functionName: 'TAPEOUT_FEE',
    }),
    client.readContract({
      address: DEFAULT_CPU.circuits,
      abi: circuitsAbi,
      functionName: 'transistors',
    }),
  ]);
  if (nandId !== TRANSISTOR_IDS.NAND || latchId !== TRANSISTOR_IDS.LATCH)
    throw new Error('unexpected token ids');
  if (transistorsOfCircuits.toLowerCase() !== DEFAULT_CPU.transistors.toLowerCase())
    throw new Error('CPU pair mismatch');
  ok(
    `circuits ${DEFAULT_CPU.circuits}, transistors ${DEFAULT_CPU.transistors}, tapeout fee ${formatEther(fee)} OKB`,
  );

  step(3, 'Funding a fresh test wallet');
  const account = privateKeyToAccount(generatePrivateKey());
  const funded = await fund(client, account.address);
  ok(
    `${account.address}: ${formatEther(funded.okb)} OKB, ${funded.nand} NAND, ${funded.latch} LATCH (via ${funded.method})`,
  );

  step(4, 'Taping out a 1-NAND circuit');
  // TAP-02 record (7 bytes): op 0x00 = NAND, wire a (3 bytes), wire b (3 bytes).
  // Wires 0/1 are constants, inputs start at 2, each gate drives the next wire (here: 4 = output).
  const netlist: Hex = '0x00000002000003';
  const { request, result } = await client.simulateContract({
    account,
    address: DEFAULT_CPU.circuits,
    abi: circuitsAbi,
    functionName: 'tapeout',
    args: [netlist, 2, 1],
    value: fee,
  });
  const hash = await client.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`tapeout reverted: ${hash}`);
  const minted = parseEventLogs({ abi: circuitsAbi, eventName: 'Transfer', logs: receipt.logs })[0];
  const circuitId = minted?.args.tokenId ?? result;
  const nandAfter = await client.readContract({
    address: DEFAULT_CPU.transistors,
    abi: transistorsAbi,
    functionName: 'balanceOf',
    args: [account.address, TRANSISTOR_IDS.NAND],
  });
  ok(
    `circuit #${circuitId} minted, tx ${hash}, NAND left ${nandAfter} (used ${funded.nand - nandAfter})`,
  );

  const table: string[] = [];
  let pass = true;
  for (const [a, b] of [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ] as const) {
    const input = `0x${(a | (b << 1)).toString(16).padStart(2, '0')}` as Hex;
    const out = await client.readContract({
      address: DEFAULT_CPU.circuits,
      abi: circuitsAbi,
      functionName: 'eval',
      args: [circuitId, input],
    });
    const y = Number.parseInt(out.slice(2, 4) || '0', 16) & 1;
    const expect = a & b ? 0 : 1;
    if (y !== expect) pass = false;
    table.push(`${a} ${b} -> ${y}${y === expect ? '' : `  (expected ${expect})`}`);
  }
  console.log(table.map((r) => `          ${r}`).join('\n'));
  if (!pass) throw new Error('truth table mismatch');
  ok('eval matches NAND truth table');

  step(5, 'Dumping fork state');
  await mkdir(stateDir, { recursive: true });
  const file = join(stateDir, 'xlayer-fork.json');
  const bytes = await dumpStateToFile(client, file);
  ok(`${file} (${(bytes / 1024).toFixed(0)} KiB). Load it with: tapebox up --state ${file}`);

  console.log('\nSPIKE PASSED: free NAND on a fork + real tape-out works.');
} finally {
  await fork?.stop();
}
