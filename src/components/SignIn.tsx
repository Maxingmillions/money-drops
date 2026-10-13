"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useIdentityToken, useLogin, usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { Mail, Sparkles, FlaskConical, Smartphone, ExternalLink, KeyRound, Map as MapIcon, Target } from "lucide-react";
import { SolCoin } from "./SolCoin";
import { DropsTokenCard } from "./DropsToken";
import { PRIVY_APP_ID } from "./Providers";
import { api, ClientError } from "@/lib/client";
import { WALLET_APPS, isMobile, useSolanaWallets, type SolanaWallet } from "@/hooks/useSolanaWallets";

const DEV_LOGIN_UI = process.env.NODE_ENV !== "production";

function useFinishSignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/home";
  return useCallback(() => router.replace(next), [router, next]);
}

export function SignIn() {
  const finish = useFinishSignIn();
  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-2">
      {/* Brand side */}
      <section className="flex flex-col items-center px-6 pt-[calc(env(safe-area-inset-top)+28px)] lg:justify-center lg:border-r lg:border-line lg:bg-elev">
        <div className="w-full max-w-[380px]">
          <DropsTokenCard external />
        </div>
        <div className="mt-6 lg:mt-10">
          <SolCoin size={200} />
        </div>
        <h1 className="mt-4 text-[40px] font-bold tracking-tight">Drops</h1>
        <p className="mt-1 max-w-[300px] text-center text-[17px] text-muted">
          Money becomes a real-world treasure hunt. Hide SOL anywhere; strangers find it.
        </p>
      </section>

      {/* Sign-in side */}
      <section className="flex flex-col items-center px-6 pb-10 pt-8 lg:justify-center">
        <div className="w-full max-w-[380px] space-y-3">
          <h2 className="hidden text-2xl font-bold lg:block">Sign in</h2>
          <WalletButtons onDone={finish} />
          <EmailForm onDone={finish} />
          {PRIVY_APP_ID && <PrivySocial onDone={finish} />}
          <p className="px-4 text-center text-xs text-faint">
            <Sparkles className="mr-1 inline" size={12} />
            No wallet? Email sign-up creates a Solana wallet for you.
          </p>
          <div className="pt-2">
            <p className="mb-2 text-center text-xs text-faint">Just looking?</p>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/explore" className="btn btn-secondary !py-3 text-sm">
                <MapIcon size={16} /> View the map
              </Link>
              <Link href="/explore/bounties" className="btn btn-secondary !py-3 text-sm">
                <Target size={16} /> Active bounties
              </Link>
            </div>
          </div>
          {DEV_LOGIN_UI && <DevButton onDone={finish} />}
        </div>
      </section>
    </main>
  );
}

/** Native Sign-In With Solana for installed wallets (Phantom, Solflare, Backpack...). */
function WalletButtons({ onDone }: { onDone: () => void }) {
  const { wallets, signIn } = useSolanaWallets();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = async (w: SolanaWallet) => {
    setBusy(w.name);
    setError(null);
    try {
      await signIn(w);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(null);
    }
  };

  // No wallet injected into this browser: on a phone, hand the page to a
  // wallet app's built-in browser; on desktop, point at the extensions.
  if (wallets.length === 0) {
    const mobile = isMobile();
    return (
      <div className="space-y-2">
        <p className="text-center text-xs text-muted">
          {mobile ? "Open Drops inside your wallet app to sign in" : "No Solana wallet extension detected. Install one, then reload."}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {WALLET_APPS.map((w) =>
            mobile ? (
              <button key={w.name} className="btn btn-ghost flex-col !gap-1 !py-3 text-sm" onClick={() => window.location.assign(w.browse(window.location.href))}>
                <span className="grid h-8 w-8 place-items-center rounded-full text-white" style={{ background: w.color }}>
                  <Smartphone size={16} />
                </span>
                {w.name}
              </button>
            ) : (
              <a key={w.name} href={w.install} target="_blank" rel="noreferrer" className="btn btn-ghost flex-col !gap-1 !py-3 text-sm">
                <span className="grid h-8 w-8 place-items-center rounded-full text-white" style={{ background: w.color }}>
                  <ExternalLink size={14} />
                </span>
                {w.name}
              </a>
            ),
          )}
        </div>
        <p className="text-center text-[11px] text-faint">Any Solana wallet works: Phantom, Solflare, Backpack, Glow, Coinbase Wallet and more.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-center text-xs text-muted">
        {wallets.length === 1 ? "Wallet detected" : `${wallets.length} wallets detected`}
      </p>
      {wallets.map((w) => (
        <button key={w.name} className="btn btn-primary w-full" disabled={busy !== null} onClick={() => go(w)}>
          <Image src={w.icon} alt="" width={20} height={20} className="rounded-md" unoptimized />
          {busy === w.name ? "Check your wallet…" : `Continue with ${w.name}`}
        </button>
      ))}
      {error && <p className="text-center text-sm text-danger">{error}</p>}
    </div>
  );
}

/** Google / Apple / email via Privy (only rendered when an app id is configured). */
function PrivySocial({ onDone }: { onDone: () => void }) {
  const { ready, authenticated, logout } = usePrivy();
  const { identityToken } = useIdentityToken();
  const { ready: walletsReady, wallets } = useWallets();
  const [status, setStatus] = useState<"idle" | "linking" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const attempts = useRef(0);
  const [loginCompleted, setLoginCompleted] = useState(false);
  const wantsSession = loginCompleted || (ready && authenticated);

  const { login } = useLogin({
    onComplete: () => setLoginCompleted(true),
    onError: (e) => {
      if (e !== "exited_auth_flow") setError(`Sign-in failed (${e})`);
    },
  });

  useEffect(() => {
    if (!wantsSession || !authenticated || !identityToken || !walletsReady) return;
    let cancelled = false;
    const run = async () => {
      setStatus("linking");
      try {
        const preferred = wallets.find((w) => w.standardWallet.name !== "Privy") ?? wallets[0];
        await api("/api/auth/privy", { method: "POST", json: { identityToken, wallet: preferred?.address } });
        if (!cancelled) onDone();
      } catch (e) {
        if (cancelled) return;
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
  }, [wantsSession, authenticated, identityToken, walletsReady, wallets, onDone]);

  if (status === "linking") {
    return (
      <div className="card p-4 text-center text-sm">
        <div className="font-semibold">Setting up your wallet…</div>
        <div className="text-muted">Creating a Solana wallet if you don&apos;t have one.</div>
      </div>
    );
  }
  return (
    <div>
      <button className="btn btn-ghost w-full" disabled={!ready} onClick={() => login({ loginMethods: ["google", "apple", "email"] })}>
        <Mail size={18} /> Google, Apple or email
      </button>
      {error && (
        <p className="mt-2 text-center text-sm text-danger">
          {error}{" "}
          <button className="underline" onClick={() => { setError(null); setStatus("idle"); logout(); }}>
            Reset
          </button>
        </p>
      )}
    </div>
  );
}

/** Email + password. New accounts get a Solana wallet created for them. */
function EmailForm({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button className="btn btn-ghost w-full" onClick={() => setOpen(true)}>
        <Mail size={18} /> Continue with email
      </button>
    );
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/auth/email/${mode}`, {
        method: "POST",
        json: mode === "signup" ? { email, password, handle: handle.trim() || undefined } : { email, password },
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="card pop-in space-y-2 p-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-soft p-1 text-sm font-semibold">
        <button type="button" className={`rounded-lg py-1.5 ${mode === "signup" ? "bg-elev shadow" : "text-muted"}`} onClick={() => setMode("signup")}>
          Sign up
        </button>
        <button type="button" className={`rounded-lg py-1.5 ${mode === "login" ? "bg-elev shadow" : "text-muted"}`} onClick={() => setMode("login")}>
          Sign in
        </button>
      </div>
      <input className="input" type="email" placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="input" type="password" placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
      {mode === "signup" && <input className="input" placeholder="Username (optional)" value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={24} />}
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={busy}>
        <KeyRound size={16} /> {mode === "signup" ? "Create account" : "Sign in"}
      </button>
      {mode === "signup" && <p className="text-center text-[11px] text-faint">We create a Solana wallet for you. Payouts land there.</p>}
    </form>
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
            setError(e instanceof Error ? e.message : "Test login failed");
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
