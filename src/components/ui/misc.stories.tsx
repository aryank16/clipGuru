import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Play, Search } from "lucide-react";
import { Button } from "./button";
import { Card, SectionHeader } from "./card";
import { EmptyState } from "./empty-state";
import { Pressable } from "./pressable";
import { Spinner } from "./spinner";

const meta = { title: "Atoms/Surfaces", component: Card } satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SettingsCard: Story = {
  render: () => (
    <Card className="flex max-w-3xl flex-col gap-5 p-6 sm:p-8">
      <SectionHeader index="03" eyebrow="Scheduling" title="Time zone" />
      <p className="text-muted">Scheduled Instagram posts go out at the time you pick in this zone.</p>
    </Card>
  ),
};

export const EmptyFirstVisit: Story = {
  render: () => (
    <EmptyState icon={<Play className="size-5" />} title="No videos yet" action={<Button size="lg">New video</Button>}>
      Start with an idea and ClipGuru writes, voices and animates it.
    </EmptyState>
  ),
};

export const EmptyNoMatches: Story = {
  render: () => (
    <EmptyState icon={<Search className="size-5" />} title="No matches">
      No videos with “volcano” in the title.
    </EmptyState>
  ),
};

export const SpinnerAndPressable: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner className="size-5" />
      <Pressable className="rounded-xl border border-line bg-surface p-4 text-left">
        <span className="block font-medium">Why is the sky blue?</span>
        <span className="text-sm text-muted">A whole card that is one button</span>
      </Pressable>
    </div>
  ),
};
