import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { Callback } from "./Callback";

interface AuthGateProps {
  children: ReactNode;
}

type SessionState = Session | null | undefined;

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<SessionState>(undefined);
  const [email, setEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // detectSessionInUrl 이 토큰을 비동기로 흡수하는 동안 깜빡임 방지
  const isProcessingCallback = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.location.hash.includes("access_token") || window.location.search.includes("code=");
  }, []);

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
      setErrorMsg(error.message);
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
      setErrorMsg(error.message);
    }
  }

  if (session === undefined || isProcessingCallback) {
    return <Callback />;
  }

  if (session) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">로그인</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          매직링크 또는 Google 계정으로 로그인합니다. 가계부 데이터는 종단간 암호화로 보호됩니다.
        </p>

        {magicSent ? (
          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            <p className="font-medium">메일을 확인해주세요.</p>
            <p className="mt-1">
              {email} 로 로그인 링크를 보냈습니다. 메일의 링크를 클릭하면 자동으로 로그인됩니다.
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
              {busy ? "전송 중…" : "매직링크 받기"}
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
          Google 계정으로 로그인
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
