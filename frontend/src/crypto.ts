const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type EncryptedDeckBlob = {
  algorithm: "AES-256-GCM";
  ciphertextB64: string;
  ivB64: string;
  saltB64: string;
  kdf: "PBKDF2-SHA256";
  iterations: number;
};

const PBKDF2_ITERATIONS = 150_000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKey(secretKey: string, salt: Uint8Array): Promise<CryptoKey> {
  const saltBytes = new Uint8Array(salt);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secretKey),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBytes as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptPersonalDeck(
  words: string[],
  secretKey: string,
): Promise<EncryptedDeckBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const aesKey = await deriveAesKey(secretKey, salt);

  const serialized = JSON.stringify(
    words
      .map((word) => word.trim().toLowerCase())
      .filter((word) => word.length > 0),
  );

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as unknown as BufferSource,
    },
    aesKey,
    textEncoder.encode(serialized),
  );

  return {
    algorithm: "AES-256-GCM",
    ciphertextB64: bytesToBase64(new Uint8Array(ciphertext)),
    ivB64: bytesToBase64(iv),
    saltB64: bytesToBase64(salt),
    kdf: "PBKDF2-SHA256",
    iterations: PBKDF2_ITERATIONS,
  };
}

export async function decryptPersonalDeck(
  blob: EncryptedDeckBlob,
  secretKey: string,
): Promise<string[]> {
  const iv = base64ToBytes(blob.ivB64);
  const salt = base64ToBytes(blob.saltB64);
  const ciphertext = base64ToBytes(blob.ciphertextB64);

  const aesKey = await deriveAesKey(secretKey, salt);

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv as unknown as BufferSource,
    },
    aesKey,
    ciphertext as unknown as BufferSource,
  );

  const parsed = JSON.parse(textDecoder.decode(plaintext));
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid decrypted payload format");
  }

  return parsed.map((entry) => String(entry));
}
