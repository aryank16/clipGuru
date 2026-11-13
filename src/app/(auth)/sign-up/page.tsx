import type { Metadata } from "next";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { googleEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <>
      <RedirectIfSignedIn />
      <SignUpForm googleEnabled={googleEnabled()} />
    </>
  );
}
