import { NextResponse } from "next/server";
import { appleEnabled, issueState, providerConfig, redirectUri, safeNext, setStateCookie } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/** Sends the browser to Apple's sign-in page. */
export async function GET(req: Request) {
  if (!appleEnabled()) return NextResponse.json({ error: "Apple sign-in isn't configured" }, { status: 404 });
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  const { nonce, state, token } = await issueState("apple", next);
  const url = new URL("https://appleid.apple.com/auth/authorize");
  url.searchParams.set("client_id", providerConfig.apple.clientId());
  url.searchParams.set("redirect_uri", redirectUri(req, "apple"));
  // Hybrid flow: Apple posts the ID token straight back, so no client-secret JWT is needed.
  url.searchParams.set("response_type", "code id_token");
  url.searchParams.set("response_mode", "form_post");
  url.searchParams.set("scope", "name email");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  const res = NextResponse.redirect(url, 303);
  setStateCookie(res, token, "apple");
  return res;
}
