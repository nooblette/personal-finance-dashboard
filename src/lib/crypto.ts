// E2EE Phase 1: PBKDF2 로 패스프레이즈 -> KEK 파생,
// AES-GCM 으로 DEK wrap / payload 암복호화.
// WebCrypto SubtleCrypto 만 사용 (외부 라이브러리 금지).
// 패스프레이즈/KEK/DEK 는 절대 콘솔/에러 로그에 출력하지 않는다.

const KDF_ITERATIONS = 600_000;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const DEK_LENGTH = 32;
const RECOVERY_CODE_LENGTH = 24;
// 혼동 가능한 글자(0, O, 1, I, L) 제외한 32자 알파벳 — & 31 로 균일 매핑되어 모듈로 편향 없음
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const E2EE_PARAMS = {
  KDF_ITERATIONS,
  IV_LENGTH,
  SALT_LENGTH,
  DEK_LENGTH,
  RECOVERY_CODE_LENGTH,
} as const;

function randomBytes(length: number): Uint8Array {
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);
  return buffer;
}

// TS 5.7+ 의 lib.dom.d.ts 가 BufferSource 를 ArrayBuffer 기반으로만 받는데
// Uint8Array 의 기본 generic 은 ArrayBufferLike(=ArrayBuffer | SharedArrayBuffer)다.
// SubtleCrypto 호출 시 cast 가 필요하므로 호출부를 깨끗하게 유지하기 위한 헬퍼.
const buf = (view: Uint8Array): BufferSource => view as BufferSource;

export function generateSalt(): Uint8Array {
  return randomBytes(SALT_LENGTH);
}

export function generateIv(): Uint8Array {
  return randomBytes(IV_LENGTH);
}

export function generateDek(): Uint8Array {
  return randomBytes(DEK_LENGTH);
}

export function generateRecoveryCode(): string {
  const bytes = randomBytes(RECOVERY_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < bytes.length; i++) {
    code += RECOVERY_ALPHABET[bytes[i] & 31];
  }
  return code;
}

function assertLength(value: Uint8Array, expected: number, label: string): void {
  if (value.length !== expected) {
    throw new Error(`${label} length must be ${expected} bytes, got ${value.length}`);
  }
}

export async function deriveKek(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = KDF_ITERATIONS,
): Promise<CryptoKey> {
  assertLength(salt, SALT_LENGTH, "salt");
  const passphraseBytes = new TextEncoder().encode(passphrase);
  const baseKey = await crypto.subtle.importKey(
    "raw",
    buf(passphraseBytes),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: buf(salt), iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function wrapDek(
  dek: Uint8Array,
  kek: CryptoKey,
  iv: Uint8Array,
): Promise<Uint8Array> {
  assertLength(dek, DEK_LENGTH, "dek");
  assertLength(iv, IV_LENGTH, "iv");
  const wrapped = await crypto.subtle.encrypt({ name: "AES-GCM", iv: buf(iv) }, kek, buf(dek));
  return new Uint8Array(wrapped);
}

export async function unwrapDek(
  wrappedDek: Uint8Array,
  kek: CryptoKey,
  iv: Uint8Array,
): Promise<Uint8Array> {
  assertLength(iv, IV_LENGTH, "iv");
  const dek = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf(iv) }, kek, buf(wrappedDek));
  return new Uint8Array(dek);
}

async function importDek(dek: Uint8Array): Promise<CryptoKey> {
  assertLength(dek, DEK_LENGTH, "dek");
  return crypto.subtle.importKey("raw", buf(dek), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptPayload(
  plaintext: string,
  dek: Uint8Array,
  iv: Uint8Array,
): Promise<Uint8Array> {
  assertLength(iv, IV_LENGTH, "iv");
  const key = await importDek(dek);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: buf(iv) },
    key,
    buf(new TextEncoder().encode(plaintext)),
  );
  return new Uint8Array(ciphertext);
}

export async function decryptPayload(
  ciphertext: Uint8Array,
  dek: Uint8Array,
  iv: Uint8Array,
): Promise<string> {
  assertLength(iv, IV_LENGTH, "iv");
  const key = await importDek(dek);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf(iv) }, key, buf(ciphertext));
  return new TextDecoder().decode(plaintext);
}
