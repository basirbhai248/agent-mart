const MASK_64 = (1n << 64n) - 1n;

const SECP256K1_P = BigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F",
);
const SECP256K1_N = BigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
);
const SECP256K1_G = {
  x: BigInt(
    "0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798",
  ),
  y: BigInt(
    "0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8",
  ),
};

const KECCAK_ROUNDS = [
  0x0000000000000001n,
  0x0000000000008082n,
  0x800000000000808an,
  0x8000000080008000n,
  0x000000000000808bn,
  0x0000000080000001n,
  0x8000000080008081n,
  0x8000000000008009n,
  0x000000000000008an,
  0x0000000000000088n,
  0x0000000080008009n,
  0x000000008000000an,
  0x000000008000808bn,
  0x800000000000008bn,
  0x8000000000008089n,
  0x8000000000008003n,
  0x8000000000008002n,
  0x8000000000000080n,
  0x000000000000800an,
  0x800000008000000an,
  0x8000000080008081n,
  0x8000000000008080n,
  0x0000000080000001n,
  0x8000000080008008n,
];

const KECCAK_ROTATION = [
  1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39,
  61, 20, 44,
];

const KECCAK_PI = [
  10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22,
  9, 6, 1,
];

const ZERO_POINT = { x: 0n, y: 0n, inf: true as const };

export const RECOVERY_MESSAGE_PREFIX = "AgentMart API key recovery for";

export function buildRecoveryMessage(wallet: string): string {
  return `${RECOVERY_MESSAGE_PREFIX} ${wallet}`;
}

export function recoverWalletAddress(
  message: string,
  signatureHex: string,
): string | undefined {
  const signature = hexToBytes(signatureHex);
  if (signature.length !== 65) {
    return undefined;
  }

  const r = bytesToNumber(signature.subarray(0, 32));
  const s = bytesToNumber(signature.subarray(32, 64));
  const v = normalizeRecoveryId(signature[64]);

  if (
    v === undefined ||
    r <= 0n ||
    r >= SECP256K1_N ||
    s <= 0n ||
    s >= SECP256K1_N
  ) {
    return undefined;
  }

  const e = bytesToNumber(hashEthereumMessage(message));
  const point = recoverPublicKeyPoint(e, r, s, v);
  if (!point || point.inf) {
    return undefined;
  }

  return publicKeyPointToAddress(point);
}

export function privateKeyToWalletAddress(privateKeyHex: string): string {
  const priv = normalizePrivateKey(privateKeyHex);
  if (priv <= 0n || priv >= SECP256K1_N) {
    throw new Error("Invalid private key");
  }
  return publicKeyPointToAddress(scalarMultiply(SECP256K1_G, priv));
}

export function signRecoveryMessage(
  privateKeyHex: string,
  message: string,
): string {
  const priv = normalizePrivateKey(privateKeyHex);
  if (priv <= 0n || priv >= SECP256K1_N) {
    throw new Error("Invalid private key");
  }

  const e = bytesToNumber(hashEthereumMessage(message));
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const k = deterministicNonce(priv, e, attempt);
    const rPoint = scalarMultiply(SECP256K1_G, k);
    if (rPoint.inf) {
      continue;
    }
    const r = mod(rPoint.x, SECP256K1_N);
    if (r === 0n) {
      continue;
    }
    const kInv = modInv(k, SECP256K1_N);
    let s = mod(kInv * (e + r * priv), SECP256K1_N);
    if (s === 0n) {
      continue;
    }
    if (s > SECP256K1_N / 2n) {
      s = SECP256K1_N - s;
    }

    const signerWallet = privateKeyToWalletAddress(privateKeyHex);
    for (const recoveryId of [0, 1]) {
      const recovered = recoverWalletAddress(
        message,
        serializeSignature(r, s, recoveryId),
      );
      if (recovered?.toLowerCase() === signerWallet.toLowerCase()) {
        return serializeSignature(r, s, recoveryId);
      }
    }
  }

  throw new Error("Unable to sign message");
}

function recoverPublicKeyPoint(
  e: bigint,
  r: bigint,
  s: bigint,
  recoveryId: number,
) {
  const isOddY = recoveryId & 1;
  const x = r + BigInt(recoveryId >> 1) * SECP256K1_N;
  if (x >= SECP256K1_P) {
    return undefined;
  }

  const rPoint = pointFromX(x, isOddY === 1);
  if (!rPoint) {
    return undefined;
  }

  const rInv = modInv(r, SECP256K1_N);
  const sr = scalarMultiply(rPoint, s);
  const eg = scalarMultiply(SECP256K1_G, mod(-e, SECP256K1_N));
  const numerator = pointAdd(sr, eg);
  return scalarMultiply(numerator, rInv);
}

function pointFromX(x: bigint, odd: boolean) {
  const y2 = mod(x * x * x + 7n, SECP256K1_P);
  const y = modPow(y2, (SECP256K1_P + 1n) / 4n, SECP256K1_P);
  const isOdd = (y & 1n) === 1n;
  return {
    x,
    y: isOdd === odd ? y : SECP256K1_P - y,
  };
}

function publicKeyPointToAddress(point: { x: bigint; y: bigint }) {
  const pubBytes = new Uint8Array(64);
  pubBytes.set(numberToBytes(point.x, 32), 0);
  pubBytes.set(numberToBytes(point.y, 32), 32);
  const hash = keccak256(pubBytes);
  const addressBytes = hash.subarray(12);
  return `0x${bytesToHex(addressBytes)}`;
}

function hashEthereumMessage(message: string): Uint8Array {
  const messageBytes = new TextEncoder().encode(message);
  const prefix = `\x19Ethereum Signed Message:\n${messageBytes.length}`;
  const prefixBytes = new TextEncoder().encode(prefix);
  const data = new Uint8Array(prefixBytes.length + messageBytes.length);
  data.set(prefixBytes, 0);
  data.set(messageBytes, prefixBytes.length);
  return keccak256(data);
}

function deterministicNonce(priv: bigint, e: bigint, attempt: number): bigint {
  const seed = new Uint8Array(32 + 32 + 4);
  seed.set(numberToBytes(priv, 32), 0);
  seed.set(numberToBytes(e, 32), 32);
  seed.set(numberToBytes(BigInt(attempt + 1), 4), 64);
  const hash = keccak256(seed);
  const k = mod(bytesToNumber(hash), SECP256K1_N - 1n) + 1n;
  return k;
}

function pointAdd(
  a: { x: bigint; y: bigint; inf?: boolean },
  b: { x: bigint; y: bigint; inf?: boolean },
) {
  if (a.inf) {
    return b;
  }
  if (b.inf) {
    return a;
  }
  if (a.x === b.x) {
    if (mod(a.y + b.y, SECP256K1_P) === 0n) {
      return ZERO_POINT;
    }
    return pointDouble(a);
  }
  const slope = mod((b.y - a.y) * modInv(b.x - a.x, SECP256K1_P), SECP256K1_P);
  const x = mod(slope * slope - a.x - b.x, SECP256K1_P);
  const y = mod(slope * (a.x - x) - a.y, SECP256K1_P);
  return { x, y };
}

function pointDouble(point: { x: bigint; y: bigint; inf?: boolean }) {
  if (point.inf || point.y === 0n) {
    return ZERO_POINT;
  }
  const slope = mod(
    3n * point.x * point.x * modInv(2n * point.y, SECP256K1_P),
    SECP256K1_P,
  );
  const x = mod(slope * slope - 2n * point.x, SECP256K1_P);
  const y = mod(slope * (point.x - x) - point.y, SECP256K1_P);
  return { x, y };
}

function scalarMultiply(
  point: { x: bigint; y: bigint; inf?: boolean },
  scalar: bigint,
) {
  let result: { x: bigint; y: bigint; inf?: boolean } = ZERO_POINT;
  let addend = point;
  let k = scalar;
  while (k > 0n) {
    if (k & 1n) {
      result = pointAdd(result, addend);
    }
    addend = pointDouble(addend);
    k >>= 1n;
  }
  return result;
}

function normalizePrivateKey(value: string): bigint {
  return bytesToNumber(hexToBytes(value));
}

function normalizeRecoveryId(v: number): number | undefined {
  if (v === 27 || v === 28) {
    return v - 27;
  }
  if (v === 0 || v === 1) {
    return v;
  }
  return undefined;
}

function serializeSignature(r: bigint, s: bigint, recoveryId: number): string {
  const out = new Uint8Array(65);
  out.set(numberToBytes(r, 32), 0);
  out.set(numberToBytes(s, 32), 32);
  out[64] = 27 + recoveryId;
  return `0x${bytesToHex(out)}`;
}

function keccak256(data: Uint8Array): Uint8Array {
  const state = new Array<bigint>(25).fill(0n);
  const rate = 136;

  for (let offset = 0; offset + rate <= data.length; offset += rate) {
    absorbBlock(state, data.subarray(offset, offset + rate));
    keccakF1600(state);
  }

  const remaining = data.length % rate;
  const finalBlock = new Uint8Array(rate).fill(0);
  finalBlock.set(data.subarray(data.length - remaining), 0);
  finalBlock[remaining] ^= 0x01;
  finalBlock[rate - 1] ^= 0x80;
  absorbBlock(state, finalBlock);
  keccakF1600(state);

  const out = new Uint8Array(32);
  let outOffset = 0;
  for (let i = 0; i < 25 && outOffset < out.length; i += 1) {
    const laneBytes = numberToBytesLE(state[i], 8);
    const take = Math.min(out.length - outOffset, 8);
    out.set(laneBytes.subarray(0, take), outOffset);
    outOffset += take;
  }
  return out;
}

function absorbBlock(state: bigint[], block: Uint8Array): void {
  for (let i = 0; i < block.length / 8; i += 1) {
    state[i] ^= bytesToNumberLE(block.subarray(i * 8, i * 8 + 8));
  }
}

function keccakF1600(state: bigint[]): void {
  const bc = new Array<bigint>(5).fill(0n);
  for (let round = 0; round < 24; round += 1) {
    for (let i = 0; i < 5; i += 1) {
      bc[i] =
        state[i] ^ state[i + 5] ^ state[i + 10] ^ state[i + 15] ^ state[i + 20];
    }

    for (let i = 0; i < 5; i += 1) {
      const t = bc[(i + 4) % 5] ^ rotl64(bc[(i + 1) % 5], 1);
      for (let j = 0; j < 25; j += 5) {
        state[j + i] ^= t;
      }
    }

    let t = state[1];
    for (let i = 0; i < 24; i += 1) {
      const j = KECCAK_PI[i];
      const current = state[j];
      state[j] = rotl64(t, KECCAK_ROTATION[i]);
      t = current;
    }

    for (let j = 0; j < 25; j += 5) {
      const row0 = state[j];
      const row1 = state[j + 1];
      const row2 = state[j + 2];
      const row3 = state[j + 3];
      const row4 = state[j + 4];

      state[j] = row0 ^ (~row1 & MASK_64 & row2);
      state[j + 1] = row1 ^ (~row2 & MASK_64 & row3);
      state[j + 2] = row2 ^ (~row3 & MASK_64 & row4);
      state[j + 3] = row3 ^ (~row4 & MASK_64 & row0);
      state[j + 4] = row4 ^ (~row0 & MASK_64 & row1);
    }

    state[0] ^= KECCAK_ROUNDS[round];
  }
}

function rotl64(value: bigint, shift: number): bigint {
  const s = BigInt(shift);
  return ((value << s) | (value >> (64n - s))) & MASK_64;
}

function mod(value: bigint, modulo: bigint): bigint {
  const result = value % modulo;
  return result >= 0n ? result : result + modulo;
}

function modPow(base: bigint, exponent: bigint, modulo: bigint): bigint {
  let result = 1n;
  let power = mod(base, modulo);
  let exp = exponent;
  while (exp > 0n) {
    if (exp & 1n) {
      result = mod(result * power, modulo);
    }
    power = mod(power * power, modulo);
    exp >>= 1n;
  }
  return result;
}

function modInv(value: bigint, modulo: bigint): bigint {
  let a = mod(value, modulo);
  let b = modulo;
  let x = 1n;
  let y = 0n;

  while (b !== 0n) {
    const quotient = a / b;
    [a, b] = [b, a - quotient * b];
    [x, y] = [y, x - quotient * y];
  }

  if (a !== 1n) {
    throw new Error("Inverse does not exist");
  }

  return mod(x, modulo);
}

function bytesToNumber(bytes: Uint8Array): bigint {
  let out = 0n;
  for (const byte of bytes) {
    out = (out << 8n) + BigInt(byte);
  }
  return out;
}

function bytesToNumberLE(bytes: Uint8Array): bigint {
  let out = 0n;
  for (let i = bytes.length - 1; i >= 0; i -= 1) {
    out = (out << 8n) + BigInt(bytes[i]);
  }
  return out;
}

function numberToBytes(value: bigint, size: number): Uint8Array {
  let current = value;
  const out = new Uint8Array(size);
  for (let i = size - 1; i >= 0; i -= 1) {
    out[i] = Number(current & 0xffn);
    current >>= 8n;
  }
  return out;
}

function numberToBytesLE(value: bigint, size: number): Uint8Array {
  const out = new Uint8Array(size);
  let current = value;
  for (let i = 0; i < size; i += 1) {
    out[i] = Number(current & 0xffn);
    current >>= 8n;
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (normalized.length === 0 || normalized.length % 2 !== 0) {
    return new Uint8Array();
  }
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    const byte = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      return new Uint8Array();
    }
    out[i] = byte;
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
