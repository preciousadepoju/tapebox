import { Command } from 'commander';
import { registerFund } from './commands/fund.js';
import { registerSnapshot } from './commands/snapshot.js';
import { registerUp } from './commands/up.js';

const program = new Command()
  .name('tapebox')
  .description('A free X Layer mainnet fork for TapeOut builders')
  .version('0.1.0');

// Person A: chain engine
registerUp(program);
registerFund(program);
registerSnapshot(program);
// Person B: add registerTest(program) from ./commands/test.js

program.parseAsync().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
