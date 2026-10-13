"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useIdentityToken, useLogin, usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { Mail, Sparkles, FlaskConical, KeyRound, Map as MapIcon, Target } from "lucide-react";
import { WalletSplitButton } from "./WalletSplitButton";
import { SolCoin } from "./SolCoin";
import { DropsTokenCard } from "./DropsToken";
import { PRIVY_APP_ID } from "./Providers";
import { api, ClientError } from "@/lib/client";
import { WALLET_APPS, isMobile, useSolanaWallets, type SolanaWallet } from "@/hooks/useSolanaWallets";

const DEV_LOGIN_UI = process.env.NODE_ENV !== "production";
const subscribeNever = () => () => {};

function useFinishSignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/home";
  return useCallback(() => router.replace(next), [router, next]);
}

export type SocialConfig = { google: boolean; apple: boolean };

export function SignIn({ social }: { social?: SocialConfig }) {
  const finish = useFinishSignIn();
  const params = useSearchParams();
  const next = params.get("next") || "/home";
  const oauthError = params.get("error");
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
          {(social?.google || social?.apple) && <SocialButtons social={social} next={next} />}
          {oauthError && <p className="text-center text-sm text-danger">{oauthError}</p>}
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

/** Native Sign-In With Solana: pick a wallet, then an account if it has several. */
function WalletButtons({ onDone }: { onDone: () => void }) {
  const { wallets, connect, signIn } = useSolanaWallets();
  // Server renders the desktop copy; the client swaps to the phone copy after hydration.
  const mobile = useSyncExternalStore(subscribeNever, isMobile, () => false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<{ wallet: SolanaWallet; accounts: string[] } | null>(null);

  const pick = async (w: SolanaWallet) => {
    setBusy(w.id);
    setError(null);
    try {
      const accounts = await connect(w);
      if (accounts.length === 0) throw new Error("No account returned by the wallet");
      if (accounts.length === 1) {
        await signIn(w, accounts[0]);
        onDone();
      } else {
        setChoice({ wallet: w, accounts });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(null);
    }
  };

  const signInWith = async (address: string) => {
    if (!choice) return;
    setBusy(address);
    setError(null);
    try {
      await signIn(choice.wallet, address);
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
    return (
      <div className="space-y-2">
        <WalletSplitButton
          options={WALLET_APPS.map((w) => ({ id: w.name, name: w.name, color: w.color }))}
          defaultId="Phantom"
          label={(w) => (mobile ? `Open in ${w.name}` : `Get ${w.name}`)}
          onPick={(o) => {
            const app = WALLET_APPS.find((w) => w.name === o.id)!;
            if (mobile) window.location.assign(app.browse(window.location.href));
            else window.open(app.install, "_blank", "noopener");
          }}
        />
        <p className="text-center text-[11px] text-faint">
          {mobile ? "Opens Drops inside the wallet app's browser so you can sign in." : "No wallet extension detected. Install one, then reload."} Any Solana wallet works.
        </p>
      </div>
    );
  }

  if (choice) {
    return (
      <div className="card pop-in p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Which {choice.wallet.name} account?</span>
          <button className="text-xs text-muted" onClick={() => setChoice(null)}>
            Back
          </button>
        </div>
        <div className="mt-2 space-y-1.5">
          {choice.accounts.map((a) => (
            <button key={a} className="btn btn-secondary w-full justify-between !py-2.5 font-mono text-xs" disabled={busy !== null} onClick={() => signInWith(a)}>
              <span>{a.slice(0, 6)}…{a.slice(-6)}</span>
              <span className="text-faint">{busy === a ? "Signing…" : "Use"}</span>
            </button>
          ))}
        </div>
        {error && <p className="mt-2 text-center text-sm text-danger">{error}</p>}
      </div>
    );
  }

  const preferred = wallets.find((w) => /phantom/i.test(w.name)) ?? wallets[0];
  return (
    <div className="space-y-2">
      <WalletSplitButton
        options={wallets.map((w) => ({ id: w.id, name: w.name, icon: w.icon }))}
        defaultId={preferred.id}
        busy={busy !== null}
        onPick={(o) => {
          const w = wallets.find((x) => x.id === o.id);
          if (w) pick(w);
        }}
      />
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

/** Google / Apple via plain OpenID Connect redirects (see src/lib/oauth.ts). */
function SocialButtons({ social, next }: { social: SocialConfig; next: string }) {
  const q = `?next=${encodeURIComponent(next)}`;
  const both = social.google && social.apple;
  return (
    <div className={both ? "grid grid-cols-2 gap-2" : "space-y-2"}>
      {social.google && (
        <a href={`/api/auth/google/start${q}`} className="btn btn-ghost w-full" role="button">
          <GoogleMark /> {both ? "Google" : "Continue with Google"}
        </a>
      )}
      {social.apple && (
        <a href={`/api/auth/apple/start${q}`} className="btn btn-ghost w-full" role="button">
          <AppleMark /> {both ? "Apple" : "Continue with Apple"}
        </a>
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z" />
      <path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.7 24c0-1.6.3-3.1.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.4 12.7c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.8 1.3 10.3.9 1.3 1.9 2.7 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.2zM13.9 5.1c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z" />
    </svg>
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
