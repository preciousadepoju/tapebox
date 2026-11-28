import type { Hex } from 'viem';

/**
 * TapeOut packs bits little-endian: byte k holds bits 8k..8k+7, LSB first.
 * So input 0 is bit 0 of byte 0 and input 8 is bit 0 of byte 1 (checked on the fork).
 */
export function packBits(bits: readonly boolean[]): Hex {
  if (bits.length === 0) return '0x';
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((on, i) => {
    if (on) bytes[i >> 3] |= 1 << (i & 7);
  });
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Read `count` bits from packed bytes. Missing bytes read as zero, like the contract does. */
export function unpackBits(hex: Hex, count: number): boolean[] {
  const clean = hex.slice(2);
  const out: boolean[] = [];
  for (let i = 0; i < count; i++) {
    const byte = Number.parseInt(clean.slice((i >> 3) * 2, (i >> 3) * 2 + 2) || '0', 16);
    out.push(((byte >> (i & 7)) & 1) === 1);
  }
  return out;
}

/** Bits of an integer row index, LSB = bit 0. */
export function rowBits(row: number, count: number): boolean[] {
  return Array.from({ length: count }, (_, i) => ((row >> i) & 1) === 1);
}

export function bitsToString(bits: readonly boolean[]): string {
  return bits.map((b) => (b ? '1' : '0')).join('');
}
