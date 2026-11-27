import { Logo } from "@/components/brand/logo";
import { LegalLinks } from "@/components/legal/legal-links";

/** Two-column auth layout: brand headline on the left, the form on the right. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden flex-col gap-16 overflow-hidden border-r border-line bg-gradient-to-br from-surface to-canvas px-12 py-14 lg:flex xl:px-20">
        <Logo />
        <div className="flex flex-col gap-12">
          <h1 className="font-display text-7xl font-black uppercase leading-[0.92] tracking-tight xl:text-8xl">
            Explain
            <br />
            <span className="text-accent">anything</span>
            <br />
            in 90
            <br />
            seconds
          </h1>
          <PhonePreview />
        </div>
      </aside>

      <main className="flex flex-col px-4 py-8 sm:px-8 lg:justify-center lg:px-16 xl:px-24">
        <div className="mb-10 lg:hidden">
          <Logo />
          <p className="mt-6 font-display text-3xl font-black uppercase leading-none tracking-tight">
            Explain <span className="text-accent">anything</span> in 90 seconds
          </p>
        </div>
        <div className="w-full max-w-md lg:mx-auto">{children}</div>
        <LegalLinks className="mt-10 w-full max-w-md justify-center lg:mx-auto" />
      </main>
    </div>
  );
}

/** The small 9:16 card with a growth curve, as on the sign-in screen. */
function PhonePreview() {
  return (
    <div className="flex aspect-[9/16] w-44 flex-col justify-between rounded-2xl border border-line bg-surface-sunken p-4 shadow-hero">
      <div className="flex items-center justify-between">
        <span className="size-2.5 rounded-full bg-accent" />
        <svg viewBox="0 0 10 10" className="size-3 text-muted" aria-hidden>
          <path d="M2 1.5 L8.5 5 L2 8.5 Z" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>
      <svg viewBox="0 0 120 120" className="w-full" aria-hidden>
        <line x1="6" y1="104" x2="114" y2="104" stroke="var(--color-line)" strokeDasharray="2 4" />
        <path d="M8 102 C 50 102, 60 90, 72 72" fill="none" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M72 72 C 86 50, 96 24, 108 8" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="72" cy="72" r="5" fill="var(--color-accent)" stroke="var(--color-ink)" strokeWidth="2" />
      </svg>
      <div className="h-1 rounded-full bg-line">
        <div className="h-1 w-2/3 rounded-full bg-ink" />
      </div>
    </div>
  );
}
