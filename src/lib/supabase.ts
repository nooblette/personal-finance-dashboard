import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    "Supabase 환경 변수가 비어 있습니다. .env.local 의 VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY 를 채워 주세요.",
  );
}

export const supabase = createClient(url, publishableKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // 모바일 브라우저에서 세션 영속성 보장 위해 localStorage 를 명시 지정
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
