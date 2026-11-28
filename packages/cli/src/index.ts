import { Command } from 'commander';
import { registerFund } from './commands/fund.js';
import { registerInspect } from './commands/inspect.js';
import { registerRun } from './commands/run.js';
import { registerSnapshot } from './commands/snapshot.js';
import { registerTest } from './commands/test.js';
import { registerUp } from './commands/up.js';

const program = new Command()
  .name('tapebox')
  .description('A free X Layer mainnet fork for TapeOut builders')
  .version('0.1.0');

// Person A: chain engine
registerUp(program);
registerFund(program);
registerSnapshot(program);
// Person B: testing
registerTest(program);
registerInspect(program);
registerRun(program);

program.parseAsync().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
