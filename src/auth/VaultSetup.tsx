import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  E2EE_PARAMS,
  deriveKek,
  generateDek,
  generateIv,
  generateRecoveryCode,
  generateSalt,
  wrapDek,
} from "../lib/crypto";
import { cacheDek } from "../lib/dekCache";
import { bytesToHex } from "../lib/encoding";

interface VaultSetupProps {
  userId: string;
  onComplete: (dek: Uint8Array) => void;
}

type Stage = "form" | "showRecovery";

export function VaultSetup({ userId, onComplete }: VaultSetupProps) {
  const [stage, setStage] = useState<Stage>("form");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [createdDek, setCreatedDek] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [copyLabel, setCopyLabel] = useState("복사하기");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (passphrase.length < 8) {
      setError("비밀번호는 8자 이상으로 만들어주세요.");
      return;
    }
    if (passphrase !== confirm) {
      setError("두 비밀번호가 달라요. 다시 확인해주세요.");
      return;
    }

    setBusy(true);
    try {
      const newDek = generateDek();
      const salt = generateSalt();
      const dekIv = generateIv();
      const kek = await deriveKek(passphrase, salt);
      const wrappedDek = await wrapDek(newDek, kek, dekIv);

      const recovery = generateRecoveryCode();
      const recoverySalt = generateSalt();
      const recoveryDekIv = generateIv();
      const recoveryKek = await deriveKek(recovery, recoverySalt);
      const recoveryWrappedDek = await wrapDek(newDek, recoveryKek, recoveryDekIv);

      const { error: insertError } = await supabase.from("vaults").insert({
        user_id: userId,
        wrapped_dek: bytesToHex(wrappedDek),
        dek_iv: bytesToHex(dekIv),
        kdf_salt: bytesToHex(salt),
        kdf_iterations: E2EE_PARAMS.KDF_ITERATIONS,
        recovery_wrapped_dek: bytesToHex(recoveryWrappedDek),
        recovery_dek_iv: bytesToHex(recoveryDekIv),
        recovery_salt: bytesToHex(recoverySalt),
        version: 1,
      });
      if (insertError) throw new Error(insertError.message);

      setCreatedDek(newDek);
      setRecoveryCode(recovery);
      setStage("showRecovery");
    } catch (err) {
      setError(err instanceof Error ? err.message : "잠금 만들기에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function copyRecovery() {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopyLabel("복사했어요");
    } catch {
      setCopyLabel("복사 실패");
    }
    setTimeout(() => setCopyLabel("복사하기"), 1500);
  }

  function finish() {
    if (!createdDek || !acknowledged) return;
    cacheDek(userId, createdDek, rememberDevice);
    onComplete(createdDek);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm">
        {stage === "form" ? (
          <>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">내 가계부 만들기</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              비밀번호로 가계부를 잠가요. 비밀번호를 잊으면 복구 코드로만 풀 수 있고, 저희도 안에 있는 내용을 볼 수 없어요.
            </p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">비밀번호 (8자 이상)</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                  autoComplete="new-password"
                />
              </label>
              <label className="block">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">비밀번호 다시 입력</span>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
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
                disabled={busy || !passphrase || !confirm}
                className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {busy ? "잠금 만드는 중이에요" : "비밀번호 만들기"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">복구 코드</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              비밀번호를 잊었을 때 가계부를 되찾을 수 있는 유일한 코드예요.{" "}
              <strong>한 번만 보여드려요.</strong> 비밀번호 매니저 같은 안전한 곳에 꼭 저장해주세요.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-3 font-mono text-base tracking-widest text-zinc-900 dark:text-zinc-100">
                {recoveryCode}
              </code>
              <button
                type="button"
                onClick={copyRecovery}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                {copyLabel}
              </button>
            </div>
            <label className="mt-6 flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700"
              />
              <span>
                복구 코드를 안전한 곳에 저장했어요. 이 코드와 비밀번호를 모두 잃어버리면 가계부를 영영 볼 수 없다는 점을
                알고 있어요.
              </span>
            </label>
            <button
              type="button"
              onClick={finish}
              disabled={!acknowledged}
              className="mt-6 w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              가계부 시작하기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
