import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { deriveKek, generateIv, generateSalt, unwrapDek, wrapDek } from "../lib/crypto";
import { cacheDek } from "../lib/dekCache";
import { bytesToBase64, decodeBinary } from "../lib/encoding";

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
      const salt = decodeBinary(vault.kdf_salt);
      const dekIv = decodeBinary(vault.dek_iv);
      const wrappedDek = decodeBinary(vault.wrapped_dek);
      const kek = await deriveKek(passphrase, salt, vault.kdf_iterations);
      const dek = await unwrapDek(wrappedDek, kek, dekIv);
      cacheDek(dek, rememberDevice);
      onUnlock(dek);
    } catch {
      // 복호화 실패 = 잘못된 비밀번호 (의뢰서 §5)
      setError("비밀번호가 일치하지 않아요.");
    } finally {
      setBusy(false);
    }
  }

  async function unlockWithRecovery(event: FormEvent) {
    event.preventDefault();
    if (!vault) return;
    setError(null);

    if (!vault.recovery_wrapped_dek || !vault.recovery_dek_iv || !vault.recovery_salt) {
      setError("복구 코드가 등록되어 있지 않아요.");
      return;
    }
    if (newPassphrase.length < 8) {
      setError("새 비밀번호는 8자 이상으로 만들어주세요.");
      return;
    }
    if (newPassphrase !== newConfirm) {
      setError("두 비밀번호가 달라요. 다시 확인해주세요.");
      return;
    }

    setBusy(true);
    let dek: Uint8Array;
    try {
      const recoverySalt = decodeBinary(vault.recovery_salt);
      const recoveryDekIv = decodeBinary(vault.recovery_dek_iv);
      const recoveryWrappedDek = decodeBinary(vault.recovery_wrapped_dek);
      const recoveryKek = await deriveKek(
        recoveryCode.trim().toUpperCase(),
        recoverySalt,
        vault.kdf_iterations,
      );
      dek = await unwrapDek(recoveryWrappedDek, recoveryKek, recoveryDekIv);
    } catch {
      setError("복구 코드가 일치하지 않아요.");
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
      setError(err instanceof Error ? err.message : "변경사항 저장에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-md rounded-2xl border border-rose-300 bg-rose-50 dark:bg-rose-950 p-6 text-sm text-rose-700 dark:text-rose-300">
          가계부를 불러오지 못했어요. {loadError}
        </div>
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-teal-600" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">잠깐만요</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">비밀번호 입력</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {mode === "passphrase"
            ? "처음 만들 때 정한 비밀번호를 입력해주세요."
            : "복구 코드로 잠금을 풀고 새 비밀번호를 만들어요."}
        </p>

        {mode === "passphrase" ? (
          <form onSubmit={unlockWithPassphrase} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm text-zinc-700 dark:text-zinc-300">비밀번호</span>
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
              <span>이 기기에서 7일간 비밀번호 안 묻기</span>
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
              {busy ? "확인하는 중이에요" : "들어가기"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("recovery");
                setError(null);
              }}
              className="block w-full text-center text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              비밀번호를 잊으셨나요? 복구 코드로 들어가기
            </button>
          </form>
        ) : (
          <form onSubmit={unlockWithRecovery} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm text-zinc-700 dark:text-zinc-300">복구 코드 (저장해둔 24자)</span>
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
              <span className="text-sm text-zinc-700 dark:text-zinc-300">새 비밀번호 (8자 이상)</span>
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
              <span className="text-sm text-zinc-700 dark:text-zinc-300">새 비밀번호 다시 입력</span>
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
              <span>이 기기에서 7일간 비밀번호 안 묻기</span>
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
              {busy ? "확인하고 새 비밀번호 저장 중이에요" : "복구하고 들어가기"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("passphrase");
                setError(null);
              }}
              className="block w-full text-center text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              비밀번호 입력으로 돌아가기
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
