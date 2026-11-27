import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ArrowUp, MoreHorizontal, Plus, X } from "lucide-react";
import { IconButton } from "./icon-button";

const meta = {
  title: "Atoms/IconButton",
  component: IconButton,
  args: { label: "More actions", icon: <MoreHorizontal className="size-5" />, size: "lg", tone: "default" },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    tone: { control: "inline-radio", options: ["default", "muted", "primary"] },
    icon: { control: false },
  },
} satisfies Meta<typeof IconButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Muted: Story = { args: { tone: "muted", label: "Remove", icon: <X className="size-4" /> } };
export const Primary: Story = { args: { tone: "primary", label: "Send", icon: <ArrowUp className="size-4" /> } };
export const Disabled: Story = { args: { disabled: true, label: "Add", icon: <Plus className="size-5" /> } };
