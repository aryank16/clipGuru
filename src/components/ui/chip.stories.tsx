import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Chip } from "./chip";

const meta = {
  title: "Atoms/Chip",
  component: Chip,
  args: { children: "Calm and clear", selected: false, look: "soft" },
  argTypes: { look: { control: "inline-radio", options: ["soft", "solid"] } },
} satisfies Meta<typeof Chip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {};
export const On: Story = { args: { selected: true } };
export const SolidOn: Story = { args: { look: "solid", selected: true, children: "All" } };
export const Disabled: Story = { args: { disabled: true } };

/** Tone picker on the brief: one at a time, click again to clear. */
export const ToneGroup: Story = {
  render: function ToneGroup() {
    const [tone, setTone] = useState("Calm and clear");
    return (
      <div className="flex flex-wrap gap-2">
        {["Calm and clear", "Friendly and upbeat", "Serious and factual"].map((t) => (
          <Chip key={t} selected={tone === t} onClick={() => setTone(tone === t ? "" : t)}>
            {t}
          </Chip>
        ))}
      </div>
    );
  },
};

/** Library filters, with counts. */
export const FilterGroup: Story = {
  render: function FilterGroup() {
    const [f, setF] = useState("All");
    const counts: Record<string, number> = { All: 12, Drafts: 4, Rendering: 1, Ready: 3, Scheduled: 2, Posted: 2 };
    return (
      <div role="group" aria-label="Filter videos" className="flex flex-wrap gap-2">
        {Object.keys(counts).map((k) => (
          <Chip key={k} look="solid" selected={f === k} onClick={() => setF(k)} className="flex h-10 items-center gap-2 px-4">
            {k === "Rendering" ? <span className="size-1.5 rounded-full bg-progress" aria-hidden /> : null}
            {k}
            <span className={f === k ? "font-mono text-xs text-accent-on-ink" : "font-mono text-xs text-muted"}>{counts[k]}</span>
          </Chip>
        ))}
      </div>
    );
  },
};
