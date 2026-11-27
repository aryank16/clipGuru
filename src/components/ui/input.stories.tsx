import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Field, Input, Select, Textarea } from "./input";

const meta = {
  title: "Atoms/Fields",
  component: Input,
  args: { placeholder: "you@example.com", size: "lg" },
  argTypes: { size: { control: "inline-radio", options: ["md", "lg"] } },
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
} satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Large: Story = {};
export const Medium: Story = { args: { size: "md", placeholder: "Video title" } };
export const Disabled: Story = { args: { disabled: true, value: "Locked once the storyboard exists" } };

export const WithLabelAndError: Story = {
  render: () => (
    <Field label="Name" htmlFor="sb-name" error="Enter your name.">
      <Input id="sb-name" aria-invalid />
    </Field>
  ),
};

export const TextareaField: Story = {
  render: () => (
    <Field label="Caption" htmlFor="sb-caption">
      <Textarea id="sb-caption" rows={4} placeholder="Write a caption for Instagram" />
    </Field>
  ),
};

export const SelectField: Story = {
  render: () => (
    <Field label="Time zone" htmlFor="sb-tz">
      <Select id="sb-tz" defaultValue="berlin">
        <option value="london">London (GMT+0)</option>
        <option value="berlin">Berlin (GMT+1)</option>
        <option value="kolkata">Kolkata (GMT+5:30)</option>
      </Select>
    </Field>
  ),
};

/** Bare fields sit inside their own box, as on the brief panel. */
export const Bare: Story = {
  render: () => (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-canvas/40 px-4 py-3">
      <label htmlFor="sb-topic" className="eyebrow">Topic</label>
      <Input id="sb-topic" bare placeholder="What is the video about?" />
    </div>
  ),
};
