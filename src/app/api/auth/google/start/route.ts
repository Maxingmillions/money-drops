import { NextResponse } from "next/server";
import { googleEnabled, issueState, providerConfig, redirectUri, safeNext, setStateCookie } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/** Sends the browser to Google's consent screen. */
export async function GET(req: Request) {
  if (!googleEnabled()) return NextResponse.json({ error: "Google sign-in isn't configured" }, { status: 404 });
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  const { nonce, state, token } = await issueState("google", next);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", providerConfig.google.clientId());
  url.searchParams.set("redirect_uri", redirectUri(req, "google"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("prompt", "select_account");
  const res = NextResponse.redirect(url, 303);
  setStateCookie(res, token, "google");
  return res;
}
