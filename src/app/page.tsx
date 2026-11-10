import { ArrowRight, Plus } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

/**
 * F0 placeholder: shows the Atelier Light kit so the scaffold can be checked.
 * F1 replaces this with a redirect to sign-in or My videos.
 */
export default function Home() {
  const swatches = [
    ["paper", "bg-paper"],
    ["surface", "bg-surface"],
    ["surface-warm", "bg-surface-warm"],
    ["hairline", "bg-hairline"],
    ["taupe", "bg-taupe"],
    ["sand-gold", "bg-sand-gold"],
    ["render-orange", "bg-render-orange"],
    ["espresso-deep", "bg-espresso-deep"],
    ["espresso", "bg-espresso"],
  ] as const;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-12 sm:px-8 sm:py-16">
      <header className="flex items-center justify-between">
        <Logo caption="Atelier Studio · V1" />
        <span className="eyebrow">Scaffold · F0</span>
      </header>

      <section className="flex flex-col gap-4">
        <h1 className="font-display text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">
          Explain
          <br />
          <span className="text-sand-gold">anything</span>
          <br />
          in 90 seconds
        </h1>
        <p className="max-w-xl text-taupe">
          ClipGuru turns an idea into a narrated explainer video and posts it to Instagram. This page is the app
          scaffold; sign-in and the dashboard arrive in the next features.
        </p>
      </section>

      <Card className="p-6 sm:p-8">
        <SectionHeader index="01" eyebrow="Design tokens" title="Atelier Light palette" />
        <div className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-9">
          {swatches.map(([name, cls]) => (
            <div key={name} className="flex flex-col gap-2">
              <div className={`h-14 rounded-lg border border-hairline ${cls}`} />
              <span className="font-mono text-[10px] text-taupe">{name}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 sm:p-8">
        <SectionHeader index="02" eyebrow="Components" title="Buttons, badges and fields" />
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button>
            <Plus className="size-4" /> New video
          </Button>
          <Button variant="secondary">Filter</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Delete</Button>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Badge>Ready</Badge>
          <Badge tone="progress">Rendering</Badge>
          <Badge tone="muted">Draft</Badge>
          <Badge tone="success">Active link</Badge>
          <Badge tone="dark">01:14</Badge>
        </div>
        <div className="mt-6 grid gap-4 sm:max-w-md">
          <Field label="Email" htmlFor="demo-email">
            <Input id="demo-email" type="email" placeholder="name@studio.com" />
          </Field>
          <Button size="lg" className="w-full">
            Sign in <ArrowRight className="size-4" />
          </Button>
        </div>
      </Card>
    </main>
  );
}
