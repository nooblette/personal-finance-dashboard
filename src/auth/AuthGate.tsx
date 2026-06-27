import { FormEvent, ReactNode, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { Callback } from "./Callback";

interface AuthGateProps {
  children: ReactNode;
}

type SessionState = Session | null | undefined;

function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit")) {
    return "메일을 너무 자주 보내고 있어요. 1~2시간 뒤에 다시 시도하거나 Google로 계속해주세요.";
  }
  if (lower.includes("invalid login credentials")) {
    return "로그인 정보가 올바르지 않아요.";
  }
  if (lower.includes("email not confirmed")) {
    return "이메일 인증이 아직 안 됐어요. 받은 메일의 링크를 먼저 눌러주세요.";
  }
  if (lower.includes("network") || lower.includes("failed to fetch")) {
    return "네트워크 연결을 확인해주세요.";
  }
  return message;
}

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<SessionState>(undefined);
  const [email, setEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;

  async function sendMagicLink(event: FormEvent) {
    event.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setBusy(false);
    if (error) {
      setErrorMsg(mapAuthError(error.message));
      return;
    }
    setMagicSent(true);
  }

  async function signInWithGoogle() {
    setErrorMsg(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setBusy(false);
      setErrorMsg(mapAuthError(error.message));
    }
  }

  // session 이 아직 결정되지 않은 동안만 Callback 표시.
  // (이전엔 useMemo 로 mount 시점의 URL 토큰만 보고 영원히 Callback 유지 → OAuth 실패/완료 모두 멈춰 보였음)
  if (session === undefined) {
    return <Callback />;
  }

  if (session) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">내 가계부 들어가기</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          어디서든 안전하게 가계부를 이어가세요. 본인만 볼 수 있게 잠겨 있어요.
        </p>

        {magicSent ? (
          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            <p className="font-medium">메일을 보냈어요</p>
            <p className="mt-1">
              {email}로 보낸 링크를 누르면 바로 로그인돼요.
            </p>
          </div>
        ) : (
          <form onSubmit={sendMagicLink} className="mt-6 space-y-3">
            <label className="block">
              <span className="text-sm text-zinc-700 dark:text-zinc-300">이메일</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !email}
              className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {busy ? "메일 보내는 중이에요" : "메일로 로그인하기"}
            </button>
          </form>
        )}

        <div className="my-5 flex items-center gap-3 text-xs text-zinc-400">
          <hr className="flex-1 border-zinc-200 dark:border-zinc-800" />
          <span>또는</span>
          <hr className="flex-1 border-zinc-200 dark:border-zinc-800" />
        </div>

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={busy}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50"
        >
          Google로 계속하기
        </button>

        {errorMsg && (
          <p className="mt-4 rounded-md bg-rose-50 dark:bg-rose-950 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
            {errorMsg}
          </p>
        )}
      </div>
    </div>
  );
}
