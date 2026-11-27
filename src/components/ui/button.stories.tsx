import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "./button";

const meta = {
  title: "Atoms/Button",
  component: Button,
  args: { children: "New video", variant: "primary", size: "md", loading: false, disabled: false },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary", "ghost", "danger"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: "secondary", children: "Cancel" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Skip for now" } };
export const Danger: Story = { args: { variant: "danger", children: "Delete account" } };
export const Loading: Story = { args: { loading: true, children: "Saving" } };
export const Disabled: Story = { args: { disabled: true } };
export const WithIcons: Story = {
  args: { size: "lg", children: <>Write storyboard <ArrowRight className="size-4" /></> },
};
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(["sm", "md", "lg"] as const).map((size) => (
        <div key={size} className="flex flex-wrap items-center gap-3">
          <Button size={size}>
            <Plus className="size-4" /> Primary
          </Button>
          <Button size={size} variant="secondary">Secondary</Button>
          <Button size={size} variant="ghost">Ghost</Button>
          <Button size={size} variant="danger">Delete</Button>
          <Button size={size} loading>Saving</Button>
          <Button size={size} disabled>Disabled</Button>
        </div>
      ))}
    </div>
  ),
};
