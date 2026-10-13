import { failSignIn, findOrCreateUser, finishSignIn, providerConfig, readState, redirectUri, verifyIdToken } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/** Google sends the user back here with a code; we swap it for an ID token and sign them in. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  try {
    if (params.get("error")) throw new Error(params.get("error") === "access_denied" ? "Google sign-in was cancelled" : `Google error: ${params.get("error")}`);
    const { nonce, next } = await readState(req, "google", params.get("state"));
    const code = params.get("code");
    if (!code) throw new Error("No code from Google");
    const body = new URLSearchParams({
      code,
      client_id: providerConfig.google.clientId(),
      client_secret: providerConfig.google.clientSecret(),
      redirect_uri: redirectUri(req, "google"),
      grant_type: "authorization_code",
    });
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    const tokens = (await tokenRes.json()) as { id_token?: string; error_description?: string; error?: string };
    if (!tokenRes.ok || !tokens.id_token) throw new Error(tokens.error_description ?? tokens.error ?? "Google token exchange failed");
    const identity = await verifyIdToken("google", tokens.id_token, nonce);
    const user = await findOrCreateUser(identity);
    return finishSignIn(req, user, next);
  } catch (e) {
    console.warn("[auth/google]", e);
    return failSignIn(req, e instanceof Error ? e.message : "Google sign-in failed");
  }
}
