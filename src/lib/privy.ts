import "server-only";
import { PrivyClient } from "@privy-io/node";

export const privyEnabled = () =>
  Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);

let client: PrivyClient | null = null;
export function privy(): PrivyClient {
  if (!client) {
    client = new PrivyClient({
      appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
      appSecret: process.env.PRIVY_APP_SECRET!,
      jwtVerificationKey: process.env.PRIVY_VERIFICATION_KEY || undefined,
    });
  }
  return client;
}

export type PrivyIdentity = {
  privyId: string;
  email: string | null;
  loginMethod: string | null;
  /** All Solana wallet addresses linked to the user. */
  solanaWallets: { address: string; embedded: boolean }[];
};

/**
 * Verify a Privy identity token (signed by Privy, carries the user's linked
 * accounts) and extract what Money Drops needs from it.
 */
export async function identityFromToken(identityToken: string): Promise<PrivyIdentity> {
  const user = await privy().users().get({ id_token: identityToken });
  const solanaWallets: PrivyIdentity["solanaWallets"] = [];
  let email: string | null = null;
  let loginMethod: string | null = null;

  for (const acct of user.linked_accounts) {
    if (acct.type === "wallet" && "chain_type" in acct && acct.chain_type === "solana") {
      solanaWallets.push({
        address: acct.address,
        embedded: acct.connector_type === "embedded" || acct.wallet_client_type === "privy",
      });
      loginMethod ??= "wallet";
    } else if (acct.type === "email") {
      email ??= acct.address;
      loginMethod ??= "email";
    } else if (acct.type === "google_oauth") {
      email ??= acct.email;
      loginMethod ??= "google";
    } else if (acct.type === "apple_oauth") {
      email ??= acct.email;
      loginMethod ??= "apple";
    }
  }
  return { privyId: user.id, email, loginMethod, solanaWallets };
}
