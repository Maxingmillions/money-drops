import { failSignIn, findOrCreateUser, finishSignIn, readState, verifyIdToken } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/** Apple POSTs the result here (response_mode=form_post). */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const error = form.get("error");
    if (typeof error === "string") throw new Error(error === "user_cancelled_authorize" ? "Apple sign-in was cancelled" : `Apple error: ${error}`);
    const { nonce, next } = await readState(req, "apple", str(form.get("state")));
    const idToken = str(form.get("id_token"));
    if (!idToken) throw new Error("No ID token from Apple");
    const identity = await verifyIdToken("apple", idToken, nonce);
    // Apple sends the name only on the very first sign-in, as a JSON blob.
    let name: string | null = null;
    const userJson = str(form.get("user"));
    if (userJson) {
      try {
        const u = JSON.parse(userJson) as { name?: { firstName?: string; lastName?: string } };
        name = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(" ") || null;
      } catch {}
    }
    const user = await findOrCreateUser(identity, name);
    return finishSignIn(req, user, next);
  } catch (e) {
    console.warn("[auth/apple]", e);
    return failSignIn(req, e instanceof Error ? e.message : "Apple sign-in failed");
  }
}

export async function GET(req: Request) {
  return failSignIn(req, "Apple sign-in didn't complete. Try again.");
}

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : null);
