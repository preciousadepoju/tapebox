import { DEFAULT_FORK_PORT, FORK_BLOCK } from '@tapebox/shared';
import { keccak256, toBytes, toHex } from 'viem';
import { describe, expect, it } from 'vitest';
import { anvilArgs } from '../src/anvil.js';
import { OZ_ERC1155_STORAGE, erc1155BalanceSlot } from '../src/storage.js';

describe('ERC-1155 storage', () => {
  it('namespace matches the ERC-7201 formula for openzeppelin.storage.ERC1155', () => {
    const h = BigInt(keccak256(toBytes('openzeppelin.storage.ERC1155'))) - 1n;
    const slot = BigInt(keccak256(toHex(h, { size: 32 }))) & ~0xffn;
    expect(toHex(slot, { size: 32 })).toBe(OZ_ERC1155_STORAGE);
  });

  it('balance slot is deterministic and id/account sensitive', () => {
    const a = '0x571d447f4f24688eC35Ccf07f1D6993655F6aF15';
    const s0 = erc1155BalanceSlot(OZ_ERC1155_STORAGE, 0n, a);
    expect(s0).toMatch(/^0x[0-9a-f]{64}$/);
    expect(erc1155BalanceSlot(OZ_ERC1155_STORAGE, 0n, a)).toBe(s0);
    expect(erc1155BalanceSlot(OZ_ERC1155_STORAGE, 1n, a)).not.toBe(s0);
    expect(erc1155BalanceSlot(0n, 0n, a)).not.toBe(s0);
  });
});

describe('anvilArgs', () => {
  it('pins the block and chain id', () => {
    const args = anvilArgs({ forkUrl: 'https://rpc.xlayer.tech' });
    expect(args).toContain('--fork-block-number');
    expect(args[args.indexOf('--fork-block-number') + 1]).toBe(FORK_BLOCK.toString());
    expect(args[args.indexOf('--chain-id') + 1]).toBe('196');
    expect(args[args.indexOf('--port') + 1]).toBe(String(DEFAULT_FORK_PORT));
    expect(args).not.toContain('--load-state');
  });
  it('adds state flags when asked', () => {
    const args = anvilArgs({ forkUrl: 'x', loadState: 'a.json', dumpState: 'b.json' });
    expect(args[args.indexOf('--load-state') + 1]).toBe('a.json');
    expect(args[args.indexOf('--dump-state') + 1]).toBe('b.json');
  });
});
