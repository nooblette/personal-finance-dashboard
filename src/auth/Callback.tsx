export function Callback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-3 text-zinc-600 dark:text-zinc-300">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-teal-600" />
        <p className="text-sm">로그인 처리 중…</p>
      </div>
    </div>
  );
}
