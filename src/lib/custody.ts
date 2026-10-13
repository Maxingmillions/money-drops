import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

// --- Custodial wallets for accounts that signed up without one --------------

function custodyKey() {
  const secret = process.env.CUSTODY_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new Error("CUSTODY_SECRET or SESSION_SECRET must be set");
  return scryptSync(secret, "drops-custody", 32);
}

/** Creates a fresh Solana keypair and returns its address plus the encrypted secret. */
export function createCustodialWallet() {
  const kp = Keypair.generate();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", custodyKey(), iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(kp.secretKey)), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    address: kp.publicKey.toBase58(),
    custodialSecret: `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`,
  };
}

/** Decrypts a stored custodial secret (for exports / signing later). */
export function openCustodialWallet(custodialSecret: string): Keypair {
  const [iv, tag, enc] = custodialSecret.split(".").map((s) => Buffer.from(s, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", custodyKey(), iv);
  decipher.setAuthTag(tag);
  const secret = Buffer.concat([decipher.update(enc), decipher.final()]);
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

export const exportSecretBase58 = (custodialSecret: string) => bs58.encode(openCustodialWallet(custodialSecret).secretKey);

// --- Passwords ----------------------------------------------------------------

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("base64")}.${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [saltB64, hashB64] = stored.split(".");
  if (!saltB64 || !hashB64) return false;
  const hash = scryptSync(password, Buffer.from(saltB64, "base64"), 64);
  const expected = Buffer.from(hashB64, "base64");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}
