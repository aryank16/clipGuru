import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge, type Tone } from "./badge";

const TONES: Tone[] = ["neutral", "dark", "progress", "success", "muted", "danger"];

const meta = {
  title: "Atoms/Badge",
  component: Badge,
  args: { children: "Ready", tone: "neutral" },
  argTypes: { tone: { control: "inline-radio", options: TONES } },
} satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};
export const AllTones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge tone="muted">Draft</Badge>
      <Badge tone="progress">Rendering</Badge>
      <Badge tone="neutral">Ready</Badge>
      <Badge tone="danger">Needs attention</Badge>
      <Badge tone="success">Posted</Badge>
      <Badge tone="dark">01:14</Badge>
    </div>
  ),
};
