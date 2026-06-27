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
import { bytesToBase64 } from "../lib/encoding";

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
  const [copyLabel, setCopyLabel] = useState("복사");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (passphrase.length < 8) {
      setError("패스프레이즈는 8자 이상이어야 합니다.");
      return;
    }
    if (passphrase !== confirm) {
      setError("패스프레이즈 확인이 일치하지 않습니다.");
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
        wrapped_dek: bytesToBase64(wrappedDek),
        dek_iv: bytesToBase64(dekIv),
        kdf_salt: bytesToBase64(salt),
        kdf_iterations: E2EE_PARAMS.KDF_ITERATIONS,
        recovery_wrapped_dek: bytesToBase64(recoveryWrappedDek),
        recovery_dek_iv: bytesToBase64(recoveryDekIv),
        recovery_salt: bytesToBase64(recoverySalt),
        version: 1,
      });
      if (insertError) throw new Error(insertError.message);

      setCreatedDek(newDek);
      setRecoveryCode(recovery);
      setStage("showRecovery");
    } catch (err) {
      setError(err instanceof Error ? err.message : "vault 생성에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function copyRecovery() {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopyLabel("복사됨");
    } catch {
      setCopyLabel("복사 실패");
    }
    setTimeout(() => setCopyLabel("복사"), 1500);
  }

  function finish() {
    if (!createdDek || !acknowledged) return;
    cacheDek(createdDek, rememberDevice);
    onComplete(createdDek);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm">
        {stage === "form" ? (
          <>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">데이터 보호 설정</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              패스프레이즈로 가계부 데이터를 종단간 암호화합니다. 분실 시 복구 코드 외에는 데이터를 풀 방법이 없으며,
              Supabase 운영자도 복호화할 수 없습니다.
            </p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">패스프레이즈 (8자 이상)</span>
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
                <span className="text-sm text-zinc-700 dark:text-zinc-300">패스프레이즈 확인</span>
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
                <span>이 기기 기억하기 (7일간 패스프레이즈 재입력 없이 사용)</span>
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
                {busy ? "키 생성 중…" : "패스프레이즈 설정"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">복구 코드</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              패스프레이즈를 분실했을 때 데이터를 복구할 유일한 수단입니다.{" "}
              <strong>이 화면을 닫으면 다시 표시되지 않습니다.</strong> 비밀번호 매니저 등 안전한 곳에 저장하세요.
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
                복구 코드를 안전한 곳에 저장했고, 이 코드와 패스프레이즈 둘 다 분실하면 데이터를 영구적으로 복호화할 수
                없음을 이해했습니다.
              </span>
            </label>
            <button
              type="button"
              onClick={finish}
              disabled={!acknowledged}
              className="mt-6 w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              가계부 시작
            </button>
          </>
        )}
      </div>
    </div>
  );
}
