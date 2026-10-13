"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useIdentityToken, useLogin, usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { Wallet, Mail, Sparkles, FlaskConical } from "lucide-react";
import { SolCoin } from "./SolCoin";
import { PRIVY_APP_ID } from "./Providers";
import { api, ClientError } from "@/lib/client";

const DEV_LOGIN_UI = process.env.NEXT_PUBLIC_DEV_LOGIN === "true" || process.env.NODE_ENV !== "production";

export function SignIn() {
  return PRIVY_APP_ID ? <PrivySignIn /> : <DevOnlySignIn />;
}

function Hero() {
  return (
    <div className="flex flex-col items-center text-center">
      <SolCoin size={190} />
      <h1 className="mt-8 text-[40px] font-bold tracking-tight">Money Drops</h1>
      <p className="mt-2 max-w-[300px] text-[17px] text-muted">
        Money becomes a real-world treasure hunt.
      </p>
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="shell flex flex-col justify-between px-6 pt-[18vh] pb-10">
      <Hero />
      <div className="mx-auto w-full max-w-[380px]">{children}</div>
    </main>
  );
}

function useFinishSignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/home";
  return useCallback(() => router.replace(next), [router, next]);
}

function PrivySignIn() {
  const finish = useFinishSignIn();
  const { ready, authenticated, logout } = usePrivy();
  const { identityToken } = useIdentityToken();
  const { ready: walletsReady, wallets } = useWallets();
  const [status, setStatus] = useState<"idle" | "linking" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const attempts = useRef(0);
  const [loginCompleted, setLoginCompleted] = useState(false);
  // Also link when already logged into Privy from a previous visit.
  const wantsSession = loginCompleted || (ready && authenticated);

  const { login } = useLogin({
    onComplete: () => setLoginCompleted(true),
    onError: (e) => {
      if (e !== "exited_auth_flow") setError(`Sign-in failed (${e})`);
    },
  });

  // Once Privy has authenticated the user and issued an identity token that
  // includes their Solana wallet, exchange it for a Money Drops session.
  useEffect(() => {
    if (!wantsSession || !authenticated || !identityToken || !walletsReady) return;
    let cancelled = false;
    const run = async () => {
      setStatus("linking");
      try {
        const preferred = wallets.find((w) => w.standardWallet.name !== "Privy") ?? wallets[0];
        await api("/api/auth/privy", {
          method: "POST",
          json: { identityToken, wallet: preferred?.address },
        });
        if (!cancelled) finish();
      } catch (e) {
        if (cancelled) return;
        // Embedded wallet may still be provisioning: retry a few times.
        if (e instanceof ClientError && e.status === 409 && attempts.current < 8) {
          attempts.current += 1;
          setTimeout(run, 1500);
          return;
        }
        setStatus("error");
        setError(e instanceof Error ? e.message : "Sign-in failed");
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [wantsSession, authenticated, identityToken, walletsReady, wallets, finish]);

  return (
    <Frame>
      {status === "linking" ? (
        <div className="card p-5 text-center">
          <div className="text-lg font-semibold">Setting up your wallet…</div>
          <p className="mt-1 text-sm text-muted">Creating a Solana wallet if you don&apos;t have one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <button className="btn btn-primary w-full" disabled={!ready} onClick={() => login()}>
            <Wallet size={18} /> Continue with wallet
          </button>
          <button
            className="btn btn-ghost w-full"
            disabled={!ready}
            onClick={() => login({ loginMethods: ["google", "apple", "email"] })}
          >
            <Mail size={18} /> Google, Apple or email
          </button>
          <p className="px-4 text-center text-xs text-faint">
            <Sparkles className="mr-1 inline" size={12} />
            No wallet? One is created for you automatically.
          </p>
          {DEV_LOGIN_UI && <DevButton onDone={finish} />}
          {error && (
            <p className="text-center text-sm text-danger">
              {error}{" "}
              <button className="underline" onClick={() => { setError(null); setStatus("idle"); logout(); }}>
                Reset
              </button>
            </p>
          )}
        </div>
      )}
    </Frame>
  );
}

function DevOnlySignIn() {
  const finish = useFinishSignIn();
  return (
    <Frame>
      <div className="space-y-3">
        <div className="card p-4 text-sm text-muted">
          Wallet, Google and Apple sign-in need a Privy app id. Add{" "}
          <code className="font-mono text-xs">NEXT_PUBLIC_PRIVY_APP_ID</code> to the environment to enable them.
        </div>
        {DEV_LOGIN_UI ? (
          <DevButton onDone={finish} />
        ) : (
          <p className="text-center text-xs text-faint">Sign-in isn&apos;t configured on this deployment yet.</p>
        )}
      </div>
    </Frame>
  );
}

function DevButton({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        className="btn btn-secondary w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api("/api/auth/dev", { method: "POST", json: {} });
            onDone();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Dev login failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <FlaskConical size={18} /> Continue as test hunter
      </button>
      {error && <p className="mt-2 text-center text-sm text-danger">{error}</p>}
    </div>
  );
}
