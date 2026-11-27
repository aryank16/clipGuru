import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { Project, ProjectStatus } from "@/lib/projects/types";
import { VideoCard } from "./video-card";

const now = new Date().toISOString();
const project = (status: ProjectStatus, title: string, extra: Partial<Project> = {}): Project => ({
  id: `sb-${status}`,
  title,
  status,
  step: "idea",
  brief: null,
  voiceId: "george",
  currentVersion: 1,
  thumbnailUrl: null,
  durationSec: null,
  rev: 1,
  createdAt: now,
  updatedAt: now,
  ...extra,
});

const noop = () => {};

const meta = {
  title: "Screens/Video card",
  component: VideoCard,
  args: { project: project("idea", "How compound interest snowballs"), onRename: noop, onDuplicate: noop, onDelete: noop },
  // One card at its real width in the library grid.
  decorators: [(Story, ctx) => (ctx.name === "Grid" ? <Story /> : <div className="w-56"><Story /></div>)],
} satisfies Meta<typeof VideoCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Draft: Story = {};
export const Rendering: Story = { args: { project: project("generating", "Quantum computing in 60 seconds") } };
export const Ready: Story = { args: { project: project("ready", "Why inflation happens", { durationSec: 74 }) } };
export const NeedsAttention: Story = { args: { project: project("attention", "The 80/20 rule decoded") } };
export const Scheduled: Story = { args: { project: project("scheduled", "Why planes fly curved routes", { durationSec: 58 }) } };
export const Posted: Story = { args: { project: project("posted", "The Fermi paradox", { durationSec: 81 }) } };

export const Grid: Story = {
  render: () => (
    <div className="grid max-w-5xl grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
      {(["idea", "generating", "ready", "attention", "scheduled", "posted"] as const).map((s, i) => (
        <VideoCard key={s} project={project(s, ["Draft idea", "Rendering now", "Ready to post", "Render failed", "Goes out tomorrow", "Already posted"][i], { durationSec: s === "ready" || s === "posted" ? 66 : null })} onRename={noop} onDuplicate={noop} onDelete={noop} />
      ))}
    </div>
  ),
};
