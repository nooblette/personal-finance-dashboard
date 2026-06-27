// 의뢰서 §2.5 키 캐시 정책:
// - 기본: sessionStorage (탭 닫으면 삭제)
// - 옵션: localStorage TTL 7일 ("이 기기 기억" 체크 시)
// - 패스프레이즈/KEK 는 절대 저장 금지 (DEK 만 캐시)
// 캐시는 사용자별로 격리해 같은 브라우저에서 계정을 갈아탈 때 이전 사용자의 DEK 가 잡히지 않도록 한다.

import { base64ToBytes, bytesToBase64 } from "./encoding";

const DEK_CACHE_PREFIX = "personal-finance-dashboard:dek:";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CachedEnvelope {
  dek: string;
  expiresAt: number;
}

function keyFor(userId: string): string {
  return `${DEK_CACHE_PREFIX}${userId}`;
}

function isEnvelope(value: unknown): value is CachedEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.dek === "string" && typeof record.expiresAt === "number";
}

export function cacheDek(userId: string, dek: Uint8Array, rememberDevice: boolean): void {
  const key = keyFor(userId);
  const encoded = bytesToBase64(dek);
  if (rememberDevice) {
    const envelope: CachedEnvelope = { dek: encoded, expiresAt: Date.now() + TTL_MS };
    localStorage.setItem(key, JSON.stringify(envelope));
    sessionStorage.removeItem(key);
  } else {
    sessionStorage.setItem(key, encoded);
    localStorage.removeItem(key);
  }
}

export function readCachedDek(userId: string): Uint8Array | null {
  const key = keyFor(userId);
  const session = sessionStorage.getItem(key);
  if (session) {
    try {
      return base64ToBytes(session);
    } catch {
      sessionStorage.removeItem(key);
    }
  }
  const local = localStorage.getItem(key);
  if (!local) return null;
  try {
    const parsed: unknown = JSON.parse(local);
    if (isEnvelope(parsed) && Date.now() < parsed.expiresAt) {
      return base64ToBytes(parsed.dek);
    }
  } catch {
    // fallthrough cleanup
  }
  localStorage.removeItem(key);
  return null;
}

export function clearCachedDek(userId: string): void {
  const key = keyFor(userId);
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}
