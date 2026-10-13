// Sign-In With Solana: the wallet signs a human-readable message containing a
// server-issued nonce; the server verifies the ed25519 signature.
import nacl from "tweetnacl";
import bs58 from "bs58";

export const APP_NAME = "Drops";

export function buildSignInMessage(opts: { wallet: string; nonce: string; issuedAt: string; domain: string }) {
  return [
    `${opts.domain} wants you to sign in with your Solana account:`,
    opts.wallet,
    "",
    `Sign in to ${APP_NAME}. This is free and does not send a transaction.`,
    "",
    `Nonce: ${opts.nonce}`,
    `Issued At: ${opts.issuedAt}`,
  ].join("\n");
}

export function verifySignature(opts: { message: string; signatureB58: string; wallet: string }): boolean {
  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(opts.message),
      bs58.decode(opts.signatureB58),
      bs58.decode(opts.wallet),
    );
  } catch {
    return false;
  }
}
