import { Suspense } from "react";
import { SignIn } from "@/components/SignIn";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  // Which social providers are configured on this server (public info, no secrets).
  const social = {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    apple: Boolean(process.env.APPLE_CLIENT_ID),
  };
  return (
    <Suspense>
      <SignIn social={social} />
    </Suspense>
  );
}
