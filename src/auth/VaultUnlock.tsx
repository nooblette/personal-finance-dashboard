import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { deriveKek, generateIv, generateSalt, unwrapDek, wrapDek } from "../lib/crypto";
import { cacheDek } from "../lib/dekCache";
import { base64ToBytes, bytesToBase64 } from "../lib/encoding";

interface VaultUnlockProps {
  onUnlock: (dek: Uint8Array) => void;
}

interface VaultRow {
  user_id: string;
  wrapped_dek: string;
  dek_iv: string;
  kdf_salt: string;
  kdf_iterations: number;
  recovery_wrapped_dek: string | null;
  recovery_dek_iv: string | null;
  recovery_salt: string | null;
  version: number;
}

type Mode = "passphrase" | "recovery";

export function VaultUnlock({ onUnlock }: VaultUnlockProps) {
  const [vault, setVault] = useState<VaultRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("passphrase");
  const [passphrase, setPassphrase] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassphrase, setNewPassphrase] = useState("");
  const [newConfirm, setNewConfirm] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: loadErr } = await supabase.from("vaults").select("*").single();
      if (cancelled) return;
      if (loadErr) {
        setLoadError(loadErr.message);
        return;
      }
      setVault(data as VaultRow);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function unlockWithPassphrase(event: FormEvent) {
    event.preventDefault();
    if (!vault) return;
    setError(null);
    setBusy(true);
    try {
      const salt = base64ToBytes(vault.kdf_salt);
      const dekIv = base64ToBytes(vault.dek_iv);
      const wrappedDek = base64ToBytes(vault.wrapped_dek);
      const kek = await deriveKek(passphrase, salt, vault.kdf_iterations);
      const dek = await unwrapDek(wrappedDek, kek, dekIv);
      cacheDek(dek, rememberDevice);
      onUnlock(dek);
    } catch {
      // 복호화 실패 = 잘못된 패스프레이즈 (의뢰서 §5)
      setError("패스프레이즈가 올바르지 않습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function unlockWithRecovery(event: FormEvent) {
    event.preventDefault();
    if (!vault) return;
    setError(null);

    if (!vault.recovery_wrapped_dek || !vault.recovery_dek_iv || !vault.recovery_salt) {
      setError("이 vault 에는 복구 코드가 등록되어 있지 않습니다.");
      return;
    }
    if (newPassphrase.length < 8) {
      setError("새 패스프레이즈는 8자 이상이어야 합니다.");
      return;
    }
    if (newPassphrase !== newConfirm) {
      setError("새 패스프레이즈 확인이 일치하지 않습니다.");
      return;
    }

    setBusy(true);
    let dek: Uint8Array;
    try {
      const recoverySalt = base64ToBytes(vault.recovery_salt);
      const recoveryDekIv = base64ToBytes(vault.recovery_dek_iv);
      const recoveryWrappedDek = base64ToBytes(vault.recovery_wrapped_dek);
      const recoveryKek = await deriveKek(
        recoveryCode.trim().toUpperCase(),
        recoverySalt,
        vault.kdf_iterations,
      );
      dek = await unwrapDek(recoveryWrappedDek, recoveryKek, recoveryDekIv);
    } catch {
      setError("복구 코드가 올바르지 않습니다.");
      setBusy(false);
      return;
    }

    try {
      const newSalt = generateSalt();
      const newDekIv = generateIv();
      const newKek = await deriveKek(newPassphrase, newSalt);
      const newWrappedDek = await wrapDek(dek, newKek, newDekIv);

      const { error: updateError } = await supabase
        .from("vaults")
        .update({
          wrapped_dek: bytesToBase64(newWrappedDek),
          dek_iv: bytesToBase64(newDekIv),
          kdf_salt: bytesToBase64(newSalt),
        })
        .eq("user_id", vault.user_id);
      if (updateError) throw new Error(updateError.message);

      cacheDek(dek, rememberDevice);
      onUnlock(dek);
    } catch (err) {
      setError(err instanceof Error ? err.message : "vault 갱신에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-md rounded-2xl border border-rose-300 bg-rose-50 dark:bg-rose-950 p-6 text-sm text-rose-700 dark:text-rose-300">
          vault 로드 실패: {loadError}
        </div>
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-zinc-500">
        vault 불러오는 중…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">잠금 해제</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {mode === "passphrase"
            ? "가입 시 설정한 패스프레이즈를 입력하면 데이터를 복호화합니다."
            : "복구 코드로 잠금을 해제하고 새 패스프레이즈를 설정합니다."}
        </p>

        {mode === "passphrase" ? (
          <form onSubmit={unlockWithPassphrase} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm text-zinc-700 dark:text-zinc-300">패스프레이즈</span>
              <input
                type="password"
                required
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                autoComplete="current-password"
                autoFocus
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700"
              />
              <span>이 기기 기억하기 (7일간 패스프레이즈 재입력 없이 사용)</span>
            </label>
            {error && (
              <p className="rounded-md bg-rose-50 dark:bg-rose-950 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !passphrase}
              className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {busy ? "복호화 중…" : "잠금 해제"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("recovery");
                setError(null);
              }}
              className="block w-full text-center text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              패스프레이즈를 분실했어요 — 복구 코드로 잠금 해제
            </button>
          </form>
        ) : (
          <form onSubmit={unlockWithRecovery} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm text-zinc-700 dark:text-zinc-300">복구 코드 (24자)</span>
              <input
                type="text"
                required
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 font-mono text-base tracking-widest text-zinc-900 dark:text-zinc-100"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                autoFocus
              />
            </label>
            <label className="block">
              <span className="text-sm text-zinc-700 dark:text-zinc-300">새 패스프레이즈 (8자 이상)</span>
              <input
                type="password"
                required
                minLength={8}
                value={newPassphrase}
                onChange={(e) => setNewPassphrase(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                autoComplete="new-password"
              />
            </label>
            <label className="block">
              <span className="text-sm text-zinc-700 dark:text-zinc-300">새 패스프레이즈 확인</span>
              <input
                type="password"
                required
                value={newConfirm}
                onChange={(e) => setNewConfirm(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                autoComplete="new-password"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700"
              />
              <span>이 기기 기억하기 (7일간 패스프레이즈 재입력 없이 사용)</span>
            </label>
            {error && (
              <p className="rounded-md bg-rose-50 dark:bg-rose-950 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !recoveryCode || !newPassphrase}
              className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {busy ? "복호화 및 갱신 중…" : "복구 후 잠금 해제"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("passphrase");
                setError(null);
              }}
              className="block w-full text-center text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              패스프레이즈 입력으로 돌아가기
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
