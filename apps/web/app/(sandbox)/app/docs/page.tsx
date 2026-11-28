import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = { title: 'Quick-start · Tapebox sandbox' };

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-line bg-panel p-4 font-mono text-[13px] leading-relaxed">
      <code>{children.trim()}</code>
    </pre>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-3 font-semibold text-lg">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent font-mono text-accent-ink text-sm">
          {n}
        </span>
        {title}
      </h2>
      <div className="space-y-3 pl-10 text-[15px] text-ink/90 leading-relaxed">{children}</div>
    </section>
  );
}

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link className="text-accent hover:underline" href={href}>
    {children}
  </Link>
);

export default function Page() {
  return (
    <article className="mx-auto max-w-3xl space-y-10 px-4 py-12">
      <header>
        <p className="text-accent text-sm">Quick-start · 5 minutes</p>
        <h1 className="mt-1 font-semibold text-3xl">Your first chip on Tapebox</h1>
        <p className="mt-3 text-muted">
          Tapebox is a free fork of X Layer mainnet with the real TapeOut contracts. Tokens here
          cost nothing and nothing you do touches mainnet, so break things.
        </p>
      </header>

      <Step n={1} title="Get free transistors">
        <p>
          Open the <A href="/app/faucet">faucet</A>. The site makes a burner wallet in your browser,
          so you don&apos;t need MetaMask. One click gives you 1000 NAND, 100 LATCH and 100 OKB for
          fees.
        </p>
      </Step>

      <Step n={2} title="Write a circuit">
        <p>
          In the <A href="/app/playground">playground</A>, describe gates one per line. This XOR
          uses four NAND gates:
        </p>
        <Code>{`
input a b
nand n1 a b
nand n2 a n1
nand n3 b n1
nand y  n2 n3
output y
`}</Code>
        <p>
          The diagram redraws as you type. Click an input to flip it and watch the signal move
          through the gates. The truth table tab shows every combination.
        </p>
        <p className="text-muted text-sm">
          <code className="font-mono">latch q d</code> stores a bit: each beat,{' '}
          <code className="font-mono">q</code> takes <code className="font-mono">d</code>. Add an
          enable with <code className="font-mono">latch q d en</code> and{' '}
          <code className="font-mono">q</code> only changes when{' '}
          <code className="font-mono">en</code> is 1. Loops must go through a latch.
        </p>
      </Step>

      <Step n={3} title="Tape it out">
        <p>
          Press <b>Tape out on the sandbox</b>. That sends one transaction to the real Circuits
          contract: it costs the 0.0013 OKB tapeout fee, burns one NAND per gate and one LATCH per
          latch, and mints your chip as an NFT with an on-chain id. Then use{' '}
          <code className="font-mono">eval()</code> to read outputs and{' '}
          <code className="font-mono">step()</code> to run one beat. Both are free read calls. Every
          tape-out shows up in the <A href="/app/explorer">explorer</A>.
        </p>
        <p className="text-muted text-sm">
          On chain a netlist is a list of records: a NAND is 7 bytes (
          <code className="font-mono">00</code>, then two 3-byte wire numbers) and a latch is 4
          bytes (<code className="font-mono">01</code>, then its input wire). Wires 0 and 1 are
          constant 0 and 1, inputs start at wire 2, each record drives the next wire, and the
          outputs are the last wires. The playground lays this out for you, adding a small mux for
          enables and buffers where an output is not already last.
        </p>
      </Step>

      <Step n={4} title="Do the same from code">
        <p>Run your own fork with free tokens, then point your project at it.</p>
        <Code>{`
pnpm install
pnpm tapebox up                 # local fork on :8545, dev accounts funded
pnpm tapebox fund 0xYourAddress  # 100 OKB, +1000 NAND, +100 LATCH
`}</Code>
        <Code>{`
import { DEFAULT_CPU, circuitsAbi, tapeboxFork } from '@tapebox/shared';
// tapeout(netlist, inputs, outputs) with 0.0013 OKB, then eval(id, packedInputs)
await wallet.writeContract({
  address: DEFAULT_CPU.circuits, abi: circuitsAbi, functionName: 'tapeout',
  args: ['0x00000002000003', 2, 1], value: 1_300_000_000_000_000n,
});
`}</Code>
      </Step>

      <Step n={5} title="Test it in CI">
        <p>
          Put truth tables and beat sequences in{' '}
          <code className="font-mono">tapebox.config.ts</code> and run{' '}
          <code className="font-mono">npx tapebox test</code>. The GitHub Action runs the same thing
          on every pull request, and <A href="/app/reports">Reports</A> renders its JSON output.
        </p>
        <Code>{`
# .github/workflows/chips.yml
- uses: tapebox/action@v1
`}</Code>
      </Step>

      <footer className="border-line border-t pt-6 text-muted text-sm">
        The hosted sandbox resets every night from a fresh snapshot. Need a private fork for your
        team? Run <code className="font-mono">pnpm tapebox up</code> or ask in the event Telegram.
      </footer>
    </article>
  );
}
