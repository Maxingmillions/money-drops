"use client";

import { useMemo, type ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { CLUSTER, rpcUrl } from "@/lib/solana";

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function Providers({ children }: { children: ReactNode }) {
  const rpcs = useMemo(() => {
    const http = rpcUrl();
    const ws = http.replace(/^http/, "ws");
    const key = CLUSTER === "mainnet-beta" ? "solana:mainnet" : "solana:devnet";
    return {
      [key]: {
        rpc: createSolanaRpc(http),
        rpcSubscriptions: createSolanaRpcSubscriptions(ws),
        blockExplorerUrl: "https://explorer.solana.com",
      },
    } as const;
  }, []);

  if (!PRIVY_APP_ID) return <>{children}</>;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "light",
          accentColor: "#8b3dff",
          walletChainType: "solana-only",
          showWalletLoginFirst: true,
          landingHeader: "Drops",
          loginMessage: "Sign in to hunt and hide drops",
        },
        loginMethods: ["wallet", "google", "apple", "email"],
        externalWallets: { solana: { connectors: toSolanaWalletConnectors() } },
        // Users who sign in with Google / Apple / email get a Solana wallet
        // created for them automatically.
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
          ethereum: { createOnLogin: "off" },
        },
        solana: { rpcs },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
