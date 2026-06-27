import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { decryptPayload, encryptPayload, generateIv } from "../lib/crypto";
import { base64ToBytes, bytesToBase64 } from "../lib/encoding";

interface EntriesRow {
  user_id: string;
  ciphertext: string;
  iv: string;
  updated_at: string;
}

const DEBOUNCE_MS = 1500;

export interface UseEncryptedEntries<T> {
  data: T | null;
  setData: (next: T) => void;
  hydrating: boolean;
  syncing: boolean;
  hasRemoteEntry: boolean;
  error: string | null;
}

export function useEncryptedEntries<T>(userId: string, dek: Uint8Array): UseEncryptedEntries<T> {
  const [data, setLocalData] = useState<T | null>(null);
  const [hydrating, setHydrating] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [hasRemoteEntry, setHasRemoteEntry] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHydrating(true);
    (async () => {
      try {
        const { data: row, error: loadErr } = await supabase
          .from("entries")
          .select("*")
          .maybeSingle();
        if (cancelled) return;
        if (loadErr) throw new Error(loadErr.message);
        if (!row) {
          setHasRemoteEntry(false);
          return;
        }
        const entry = row as EntriesRow;
        const ciphertext = base64ToBytes(entry.ciphertext);
        const iv = base64ToBytes(entry.iv);
        const plaintext = await decryptPayload(ciphertext, dek, iv);
        const parsed = JSON.parse(plaintext) as T;
        if (cancelled) return;
        setLocalData(parsed);
        setHasRemoteEntry(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "entries 로드 실패");
        }
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dek, userId]);

  const persist = useCallback(
    async (next: T) => {
      try {
        const iv = generateIv();
        const ciphertext = await encryptPayload(JSON.stringify(next), dek, iv);
        const { error: upsertErr } = await supabase.from("entries").upsert({
          user_id: userId,
          ciphertext: bytesToBase64(ciphertext),
          iv: bytesToBase64(iv),
          updated_at: new Date().toISOString(),
        });
        if (upsertErr) throw new Error(upsertErr.message);
        setHasRemoteEntry(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "동기화 실패");
      } finally {
        setSyncing(false);
      }
    },
    [dek, userId],
  );

  const timerRef = useRef<number | null>(null);
  const setData = useCallback(
    (next: T) => {
      setLocalData(next);
      setSyncing(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void persist(next);
      }, DEBOUNCE_MS);
    },
    [persist],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return { data, setData, hydrating, syncing, hasRemoteEntry, error };
}
