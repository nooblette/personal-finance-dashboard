// 의뢰서 §4-8: 기존 localStorage 데이터 -> 첫 로그인 시 1회 마이그레이션.
// 업로드 성공 시에만 원본 삭제, 실패 시 sessionStorage 백업 유지 (재시도 가능).

import { supabase } from "../lib/supabase";
import { encryptPayload, generateIv } from "../lib/crypto";
import { bytesToHex } from "../lib/encoding";

const LEGACY_STORAGE_KEY = "personal-finance-dashboard:v1";
const LEGACY_BACKUP_KEY = "personal-finance-dashboard:v1:legacy-backup";

export interface LegacyMigrationResult<T> {
  migrated: boolean;
  data: T | null;
  error: string | null;
}

export async function migrateLegacyEntriesIfAny<T>(
  userId: string,
  dek: Uint8Array,
): Promise<LegacyMigrationResult<T>> {
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacy) return { migrated: false, data: null, error: null };

  // 업로드 실패 시 사용자가 새로고침해도 잃지 않도록 세션 백업
  sessionStorage.setItem(LEGACY_BACKUP_KEY, legacy);

  let parsed: T;
  try {
    parsed = JSON.parse(legacy) as T;
  } catch (err) {
    return {
      migrated: false,
      data: null,
      error: err instanceof Error ? err.message : "legacy 데이터 JSON 파싱 실패",
    };
  }

  try {
    const iv = generateIv();
    const ciphertext = await encryptPayload(JSON.stringify(parsed), dek, iv);
    const { error: upsertErr } = await supabase.from("entries").upsert({
      user_id: userId,
      ciphertext: bytesToHex(ciphertext),
      iv: bytesToHex(iv),
      updated_at: new Date().toISOString(),
    });
    if (upsertErr) throw new Error(upsertErr.message);

    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return { migrated: true, data: parsed, error: null };
  } catch (err) {
    return {
      migrated: false,
      data: parsed,
      error: err instanceof Error ? err.message : "legacy 데이터 업로드 실패",
    };
  }
}
