import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Notice } from "./notice";

const meta = {
  title: "Atoms/Notice",
  component: Notice,
  args: { tone: "neutral", children: "Instagram is connected. You can post now." },
  argTypes: { tone: { control: "inline-radio", options: ["neutral", "accent", "success", "danger"] } },
} satisfies Meta<typeof Notice>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};
export const Accent: Story = { args: { tone: "accent", children: "Test voice: this preview uses a placeholder voice." } };
export const Success: Story = { args: { tone: "success", children: "Posted to Instagram." } };
export const Danger: Story = { args: { tone: "danger", role: "alert", children: "Couldn't load your videos. Check your connection and try again." } };
