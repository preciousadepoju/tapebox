import { packBits as packBitsTap, unpackBits as unpackBitsTap } from '@tapebox/tap02';
import type { Hex } from 'viem';

/**
 * Bit packing is sourced from @tapebox/tap02 (the vector-verified engine), so the web app and the
 * chain always agree: byte k holds bits 8k..8k+7, LSB first; missing bytes read as zero.
 */
export function packBits(bits: readonly boolean[]): Hex {
  return packBitsTap(bits as boolean[]);
}

export function unpackBits(hex: Hex, count: number): boolean[] {
  return unpackBitsTap(hex, count);
}

/** Bits of an integer row index, LSB = bit 0. */
export function rowBits(row: number, count: number): boolean[] {
  return Array.from({ length: count }, (_, i) => ((row >> i) & 1) === 1);
}

export function bitsToString(bits: readonly boolean[]): string {
  return bits.map((b) => (b ? '1' : '0')).join('');
}
