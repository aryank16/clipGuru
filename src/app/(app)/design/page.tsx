import type { Metadata } from "next";
import { DesignGallery } from "@/components/design/gallery";

/** Hidden page (not in the nav) that shows every token and atom, for checking themes. Signed-in only, via the app layout. */
export const metadata: Metadata = { title: "Design", robots: { index: false } };

export default function DesignPage() {
  return <DesignGallery />;
}
