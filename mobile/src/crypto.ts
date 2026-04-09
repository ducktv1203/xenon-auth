import "react-native-get-random-values";
import { gcm } from "@noble/ciphers/aes";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToUtf8, randomBytes, utf8ToBytes } from "@noble/hashes/utils";
import base64 from "base-64";

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
  return base64.encode(binary);
}

function base64ToBytes(input: string): Uint8Array {
  const binary = base64.decode(input);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function deriveAesKey(secretKey: string, salt: Uint8Array): Uint8Array {
  return pbkdf2(sha256, utf8ToBytes(secretKey), salt, {
    c: PBKDF2_ITERATIONS,
    dkLen: 32,
  });
}

export async function encryptPersonalDeck(
  words: string[],
  secretKey: string,
): Promise<EncryptedDeckBlob> {
  const iv = randomBytes(12);
  const salt = randomBytes(16);
  const key = deriveAesKey(secretKey, salt);

  const normalized = words
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word.length > 0);

  const plaintext = utf8ToBytes(JSON.stringify(normalized));
  const cipher = gcm(key, iv);
  const ciphertext = cipher.encrypt(plaintext);

  return {
    algorithm: "AES-256-GCM",
    ciphertextB64: bytesToBase64(ciphertext),
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
  const key = deriveAesKey(secretKey, salt);

  const cipher = gcm(key, iv);
  const plaintext = cipher.decrypt(ciphertext);

  const parsed = JSON.parse(bytesToUtf8(plaintext));
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid decrypted payload format");
  }

  return parsed.map((entry) => String(entry));
}
