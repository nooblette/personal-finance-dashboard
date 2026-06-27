import { describe, expect, it } from "vitest";
import {
  E2EE_PARAMS,
  decryptPayload,
  deriveKek,
  encryptPayload,
  generateDek,
  generateIv,
  generateRecoveryCode,
  generateSalt,
  unwrapDek,
  wrapDek,
} from "./crypto";

// PBKDF2 600k 는 테스트에서 너무 느려서 알고리즘 검증용으로 작은 값 사용.
// 보안 파라미터(=실서비스 값) 자체의 검증은 E2EE_PARAMS 상수로 따로 확인.
const SHORT_ITERATIONS = 1_000;

describe("E2EE_PARAMS", () => {
  it("의뢰서 §2.3 동결값과 일치", () => {
    expect(E2EE_PARAMS.KDF_ITERATIONS).toBe(600_000);
    expect(E2EE_PARAMS.IV_LENGTH).toBe(12);
    expect(E2EE_PARAMS.SALT_LENGTH).toBe(16);
    expect(E2EE_PARAMS.DEK_LENGTH).toBe(32);
    expect(E2EE_PARAMS.RECOVERY_CODE_LENGTH).toBe(24);
  });
});

describe("랜덤 생성기", () => {
  it("generateSalt 는 16바이트", () => {
    expect(generateSalt().length).toBe(E2EE_PARAMS.SALT_LENGTH);
  });
  it("generateIv 는 12바이트", () => {
    expect(generateIv().length).toBe(E2EE_PARAMS.IV_LENGTH);
  });
  it("generateDek 는 32바이트", () => {
    expect(generateDek().length).toBe(E2EE_PARAMS.DEK_LENGTH);
  });
  it("generateIv 는 호출마다 다른 값 (IV 재사용 방지 기본)", () => {
    expect(generateIv()).not.toEqual(generateIv());
  });
  it("generateRecoveryCode 는 24자 + 알파벳 범위 내", () => {
    const code = generateRecoveryCode();
    expect(code).toHaveLength(E2EE_PARAMS.RECOVERY_CODE_LENGTH);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });
});

describe("DEK wrap / unwrap (KEK)", () => {
  it("같은 패스프레이즈+salt 라운드트립 성공", async () => {
    const passphrase = "테스트 패스프레이즈 한글 123";
    const salt = generateSalt();
    const dek = generateDek();
    const iv = generateIv();

    const kek = await deriveKek(passphrase, salt, SHORT_ITERATIONS);
    const wrapped = await wrapDek(dek, kek, iv);

    const kek2 = await deriveKek(passphrase, salt, SHORT_ITERATIONS);
    const unwrapped = await unwrapDek(wrapped, kek2, iv);
    expect(unwrapped).toEqual(dek);
  });

  it("패스프레이즈가 틀리면 unwrap 실패", async () => {
    const salt = generateSalt();
    const dek = generateDek();
    const iv = generateIv();
    const kek = await deriveKek("올바른", salt, SHORT_ITERATIONS);
    const wrapped = await wrapDek(dek, kek, iv);

    const wrongKek = await deriveKek("틀린", salt, SHORT_ITERATIONS);
    await expect(unwrapDek(wrapped, wrongKek, iv)).rejects.toThrow();
  });

  it("salt 가 다르면 unwrap 실패", async () => {
    const dek = generateDek();
    const iv = generateIv();
    const kek = await deriveKek("p", generateSalt(), SHORT_ITERATIONS);
    const wrapped = await wrapDek(dek, kek, iv);
    const kek2 = await deriveKek("p", generateSalt(), SHORT_ITERATIONS);
    await expect(unwrapDek(wrapped, kek2, iv)).rejects.toThrow();
  });
});

describe("payload encrypt / decrypt (DEK)", () => {
  it("라운드트립 성공", async () => {
    const dek = generateDek();
    const iv = generateIv();
    const json = JSON.stringify({ salary: 3_000_000, memo: "급여" });
    const ciphertext = await encryptPayload(json, dek, iv);
    expect(await decryptPayload(ciphertext, dek, iv)).toBe(json);
  });

  it("ciphertext 는 평문을 포함하지 않음", async () => {
    const dek = generateDek();
    const iv = generateIv();
    const plaintext = "민감한 가계부 데이터 12345";
    const ciphertext = await encryptPayload(plaintext, dek, iv);
    expect(new TextDecoder().decode(ciphertext)).not.toContain(plaintext);
  });

  it("DEK 가 다르면 복호화 실패", async () => {
    const iv = generateIv();
    const ciphertext = await encryptPayload("hello", generateDek(), iv);
    await expect(decryptPayload(ciphertext, generateDek(), iv)).rejects.toThrow();
  });

  it("IV 가 다르면 복호화 실패", async () => {
    const dek = generateDek();
    const ciphertext = await encryptPayload("hello", dek, generateIv());
    await expect(decryptPayload(ciphertext, dek, generateIv())).rejects.toThrow();
  });
});

describe("길이 가드", () => {
  it("IV 11바이트는 거부", async () => {
    await expect(encryptPayload("x", generateDek(), new Uint8Array(11))).rejects.toThrow(/iv/);
  });
  it("IV 13바이트도 거부", async () => {
    await expect(encryptPayload("x", generateDek(), new Uint8Array(13))).rejects.toThrow(/iv/);
  });
  it("salt 15바이트는 거부", async () => {
    await expect(deriveKek("p", new Uint8Array(15), SHORT_ITERATIONS)).rejects.toThrow(/salt/);
  });
  it("DEK 31바이트는 거부", async () => {
    await expect(encryptPayload("x", new Uint8Array(31), generateIv())).rejects.toThrow(/dek/);
  });
});
