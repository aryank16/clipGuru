import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TextButton } from "./text-button";

const meta = {
  title: "Atoms/TextButton",
  component: TextButton,
  args: { children: "Undo the last change", tone: "muted", underline: "hover" },
  argTypes: {
    tone: { control: "inline-radio", options: ["muted", "ink", "accent-on-ink"] },
    underline: { control: "inline-radio", options: ["hover", "always"] },
  },
} satisfies Meta<typeof TextButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Muted: Story = {};
export const Ink: Story = { args: { tone: "ink", underline: "always", children: "Use this device's time zone" } };
/** On a strong fill, as in the delete toast. */
export const AccentOnInk: Story = {
  args: { tone: "accent-on-ink", children: "Undo" },
  decorators: [(Story) => <div className="w-fit rounded-xl bg-ink-strong px-5 py-3.5"><Story /></div>],
};
export const Disabled: Story = { args: { disabled: true } };
