import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TextButton } from "./text-button";
import { Toast } from "./toast";

const meta = { title: "Atoms/Toast", component: Toast, parameters: { layout: "fullscreen" } } satisfies Meta<typeof Toast>;
export default meta;

export const UndoDelete: StoryObj = {
  render: () => (
    <div className="h-64">
      <Toast action={<TextButton tone="accent-on-ink" className="shrink-0 text-base">Undo</TextButton>}>
        Deleted “How compound interest snowballs”
      </Toast>
    </div>
  ),
};
