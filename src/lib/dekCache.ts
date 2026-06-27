// 의뢰서 §2.5 키 캐시 정책:
// - 기본: sessionStorage (탭 닫으면 삭제)
// - 옵션: localStorage TTL 7일 ("이 기기 기억" 체크 시)
// - 패스프레이즈/KEK 는 절대 저장 금지 (DEK 만 캐시)

import { base64ToBytes, bytesToBase64 } from "./encoding";

const DEK_CACHE_KEY = "personal-finance-dashboard:dek";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CachedEnvelope {
  dek: string;
  expiresAt: number;
}

function isEnvelope(value: unknown): value is CachedEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.dek === "string" && typeof record.expiresAt === "number";
}

export function cacheDek(dek: Uint8Array, rememberDevice: boolean): void {
  const encoded = bytesToBase64(dek);
  if (rememberDevice) {
    const envelope: CachedEnvelope = { dek: encoded, expiresAt: Date.now() + TTL_MS };
    localStorage.setItem(DEK_CACHE_KEY, JSON.stringify(envelope));
    sessionStorage.removeItem(DEK_CACHE_KEY);
  } else {
    sessionStorage.setItem(DEK_CACHE_KEY, encoded);
    localStorage.removeItem(DEK_CACHE_KEY);
  }
}

export function readCachedDek(): Uint8Array | null {
  const session = sessionStorage.getItem(DEK_CACHE_KEY);
  if (session) {
    try {
      return base64ToBytes(session);
    } catch {
      sessionStorage.removeItem(DEK_CACHE_KEY);
    }
  }
  const local = localStorage.getItem(DEK_CACHE_KEY);
  if (!local) return null;
  try {
    const parsed: unknown = JSON.parse(local);
    if (isEnvelope(parsed) && Date.now() < parsed.expiresAt) {
      return base64ToBytes(parsed.dek);
    }
  } catch {
    // fallthrough cleanup
  }
  localStorage.removeItem(DEK_CACHE_KEY);
  return null;
}

export function clearCachedDek(): void {
  sessionStorage.removeItem(DEK_CACHE_KEY);
  localStorage.removeItem(DEK_CACHE_KEY);
}
