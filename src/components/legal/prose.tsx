import { env } from "@/lib/env";

/** Title block for a legal page. */
export function LegalHeader({ title, updated }: { title: string; updated: string }) {
  return (
    <header className="mb-8 flex flex-col gap-3 border-b border-hairline pb-6">
      <span className="eyebrow">ClipGuru</span>
      <h1 className="font-display text-3xl font-black uppercase leading-[0.95] tracking-tight sm:text-4xl">{title}</h1>
      <p className="text-sm text-taupe">Last updated {updated}</p>
    </header>
  );
}

/** Body text styles for legal pages. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 leading-relaxed text-espresso [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_a]:underline [&_a]:underline-offset-4 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
      {children}
    </div>
  );
}

/** Who runs ClipGuru: the OPERATOR_NAME env var (a person or business, with country). */
export function Operator() {
  return <span>{env().OPERATOR_NAME ?? "the ClipGuru team"}</span>;
}

/** How to reach us: the CONTACT_EMAIL address when set. */
export function Contact() {
  const email = env().CONTACT_EMAIL;
  return email ? (
    <a href={`mailto:${email}`}>{email}</a>
  ) : (
    <span>the ClipGuru team (use the contact details you were given when you were invited)</span>
  );
}
