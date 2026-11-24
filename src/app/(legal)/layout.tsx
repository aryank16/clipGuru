import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LegalLinks } from "@/components/legal/legal-links";

/** Public pages (privacy, terms, data deletion): readable without signing in. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-hairline px-4 py-4 sm:px-8">
        <Link href="/" className="inline-block py-1">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-8 sm:py-14">{children}</main>
      <footer className="mx-auto max-w-2xl border-t border-hairline px-4 py-6 sm:px-8">
        <LegalLinks />
      </footer>
    </div>
  );
}
