import type { Metadata } from "next";
import { StartVideo } from "@/components/videos/start-video";

export const metadata: Metadata = { title: "New video" };

/** Starts a new video and opens it. */
export default function NewVideoPage() {
  return <StartVideo />;
}
