"use client";

import { Copy, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/menu";
import { Notice } from "@/components/ui/notice";
import { Pressable } from "@/components/ui/pressable";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { TextButton } from "@/components/ui/text-button";
import { Toast } from "@/components/ui/toast";
import { COLOR_TOKENS, RADIUS_TOKENS, SHADOW_TOKENS, THEMES, TOKENS_VERSION, type ShadowToken } from "@/design/tokens";
import { cn } from "@/lib/cn";

/** Written out in full so Tailwind generates each class. */
const SHADOW_CLASS: Record<ShadowToken, string> = {
  card: "shadow-card",
  raised: "shadow-raised",
  float: "shadow-float",
  pop: "shadow-pop",
  fab: "shadow-fab",
  hero: "shadow-hero",
};

const BADGES: Tone[] = ["neutral", "dark", "progress", "success", "muted", "danger"];

/** Every token and atom on one page. */
export function DesignGallery() {
  const [chip, setChip] = useState("Calm");
  const [tab, setTab] = useState("all");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [dialog, setDialog] = useState(false);
  const [toast, setToast] = useState(false);
  const [theme, setTheme] = useState<string>("");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Design" count={`Tokens v${TOKENS_VERSION}`} />

      <div role="group" aria-label="Preview theme" className="flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1">Preview in</span>
        <Chip selected={theme === ""} onClick={() => setTheme("")}>
          Current theme
        </Chip>
        {THEMES.map((t) => (
          <Chip key={t.id} selected={theme === t.id} onClick={() => setTheme(t.id)}>
            {t.label}
          </Chip>
        ))}
      </div>

      <div data-theme={theme || undefined} className="-m-4 flex flex-col gap-8 rounded-2xl bg-canvas p-4 text-ink">

      <Section title="Colours">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {COLOR_TOKENS.map((t) => (
            <div key={t} className="flex flex-col gap-1.5">
              <span className="h-12 rounded-lg border border-line" style={{ background: `var(--cg-${t})` }} />
              <span className="font-mono text-xs text-muted">{t}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Shadows and radii">
        <div className="flex flex-wrap gap-5">
          {SHADOW_TOKENS.map((s) => (
            <span key={s} className={cn("flex size-24 items-end rounded-xl bg-surface p-2 font-mono text-xs text-muted", SHADOW_CLASS[s])}>
              {s}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-5">
          {RADIUS_TOKENS.map((r) => (
            <span key={r} className="flex size-16 items-end border border-line bg-surface-sunken p-2 font-mono text-xs text-muted" style={{ borderRadius: `var(--cg-radius-${r})` }}>
              {r}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <Row>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Delete</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
        </Row>
        <Row>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </Row>
        <Row>
          <IconButton label="Add" icon={<Plus className="size-5" />} />
          <IconButton label="Remove" tone="muted" icon={<X className="size-4" />} />
          <IconButton label="Send" tone="primary" icon={<Send className="size-4" />} />
          <IconButton label="Edit" size="sm" icon={<Pencil className="size-4" />} />
          <TextButton>Muted link</TextButton>
          <TextButton tone="ink" underline="always">Ink link</TextButton>
          <TextButton tone="accent">Accent link</TextButton>
          <Pressable className="rounded-lg border border-line px-3 py-2 text-sm">Pressable</Pressable>
          <Spinner className="size-5" />
        </Row>
      </Section>

      <Section title="Choices">
        <Row>
          {["Calm", "Playful", "Bold"].map((t) => (
            <Chip key={t} selected={chip === t} onClick={() => setChip(t)}>
              {t}
            </Chip>
          ))}
          <Chip selected={false} disabled>
            Disabled
          </Chip>
        </Row>
        <div role="tablist" aria-label="Example tabs" className="flex gap-2">
          {["all", "drafts", "ready"].map((t) => (
            <Chip key={t} look="solid" role="tab" selected={tab === t} onClick={() => setTab(t)} className="h-10 px-4 capitalize">
              {t}
            </Chip>
          ))}
        </div>
        <Segmented
          label="When"
          options={[
            { value: "now", label: "Post now" },
            { value: "later", label: "Schedule" },
          ]}
          value={when}
          onChange={setWhen}
          className="max-w-sm"
        />
        <Row>
          {BADGES.map((b) => (
            <Badge key={b} tone={b}>
              {b}
            </Badge>
          ))}
        </Row>
      </Section>

      <Section title="Fields">
        <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
          <Field label="Large input" htmlFor="ds-lg">
            <Input id="ds-lg" placeholder="Type here" />
          </Field>
          <Field label="Medium input" htmlFor="ds-md" error="This is what an error looks like.">
            <Input id="ds-md" size="md" placeholder="Type here" aria-invalid />
          </Field>
          <Field label="Select" htmlFor="ds-select">
            <Select id="ds-select" defaultValue="b">
              <option value="a">Option A</option>
              <option value="b">Option B</option>
            </Select>
          </Field>
          <Field label="Textarea" htmlFor="ds-text">
            <Textarea id="ds-text" rows={3} placeholder="A few lines" />
          </Field>
        </div>
      </Section>

      <Section title="Feedback">
        <div className="grid max-w-3xl gap-3">
          <Notice>Neutral notice.</Notice>
          <Notice tone="accent">Accent notice.</Notice>
          <Notice tone="success">Success notice.</Notice>
          <Notice tone="danger" role="alert">
            Danger notice.
          </Notice>
        </div>
        <Row>
          <Button variant="secondary" onClick={() => setDialog(true)}>
            Open dialog
          </Button>
          <Button variant="secondary" onClick={() => setToast((t) => !t)}>
            {toast ? "Hide toast" : "Show toast"}
          </Button>
        </Row>
        <div className="relative h-52">
          <Menu className="static">
            <MenuItem icon={Pencil}>Rename</MenuItem>
            <MenuItem icon={Copy}>Duplicate</MenuItem>
            <MenuDivider />
            <MenuItem icon={Trash2} danger>
              Delete
            </MenuItem>
          </Menu>
        </div>
      </Section>

      <Section title="Surfaces">
        <EmptyState icon={<Plus className="size-5" />} title="Empty state" action={<Button>Action</Button>}>
          What shows when a list has nothing in it.
        </EmptyState>
      </Section>

      {dialog ? (
        <Dialog titleId="ds-dialog" onClose={() => setDialog(false)}>
          <h2 id="ds-dialog" className="text-lg font-semibold">
            Dialog
          </h2>
          <p className="text-muted">Escape or Cancel closes it.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setDialog(false)}>OK</Button>
          </div>
        </Dialog>
      ) : null}
      {toast ? (
        <Toast
          action={
            <TextButton tone="accent" onClick={() => setToast(false)} className="shrink-0 text-base">
              Undo
            </TextButton>
          }
        >
          Deleted “Example”
        </Toast>
      ) : null}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-6">
      <h2 className="eyebrow">{title}</h2>
      {children}
    </Card>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}
