import { type Address, type Hex, encodeAbiParameters, keccak256, pad, toHex } from 'viem';

/**
 * ERC-7201 namespace of OpenZeppelin v5 ERC1155Upgradeable:
 *   keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ERC1155")) - 1)) & ~bytes32(uint256(0xff))
 * TapeOut's Transistors contract is an OZ v5 upgradeable ERC-1155 behind a beacon, so balances live
 * in `mapping(uint256 id => mapping(address account => uint256)) _balances` at offset 0 of this struct.
 */
export const OZ_ERC1155_STORAGE =
  '0x88be536d5240c274a3b1d3a1be54482fd9caa294f08c62a7cde569f49a3c4500' as const;

/** Storage slot of `_balances[id][account]` for a nested mapping rooted at `base`. */
export function erc1155BalanceSlot(base: Hex | bigint, id: bigint, account: Address): Hex {
  const baseWord = typeof base === 'bigint' ? pad(toHex(base)) : base;
  const inner = keccak256(
    encodeAbiParameters([{ type: 'uint256' }, { type: 'bytes32' }], [id, baseWord]),
  );
  return keccak256(
    encodeAbiParameters([{ type: 'address' }, { type: 'bytes32' }], [account, inner]),
  );
}

/** Candidate roots for the balances mapping, most likely first (namespaced OZ v5, then classic layouts). */
export const BALANCE_SLOT_CANDIDATES: (Hex | bigint)[] = [
  OZ_ERC1155_STORAGE,
  0n,
  1n,
  2n,
  3n,
  4n,
  5n,
  51n, // OZ v4 upgradeable: after Initializable(1) + ContextUpgradeable gap(50)
  101n,
];

export function toWord(value: bigint): Hex {
  return pad(toHex(value));
}
