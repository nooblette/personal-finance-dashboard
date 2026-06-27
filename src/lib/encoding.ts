// Uint8Array <-> 이진 인코딩 글루.
// PostgREST 는 bytea 쓰기를 base64 로 받지만 읽기는 PostgreSQL hex 형식 ("\x...") 으로 반환한다.
// 따라서 write 경로는 bytesToBase64, read 경로는 decodeBinary (자동 감지) 사용.

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function hexToBytes(value: string): Uint8Array {
  const clean = value.startsWith("\\x") ? value.slice(2) : value;
  if (clean.length % 2 !== 0) {
    throw new Error("hex string length must be even");
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function decodeBinary(value: string): Uint8Array {
  return value.startsWith("\\x") ? hexToBytes(value) : base64ToBytes(value);
}
