import { redirect } from "next/navigation";

/** The app starts at My videos; the proxy sends signed-out visitors to sign-in. */
export default function Home() {
  redirect("/videos");
}
