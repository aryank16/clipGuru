import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Segmented } from "./segmented";

const meta = { title: "Atoms/Segmented", component: Segmented } satisfies Meta<typeof Segmented>;
export default meta;

/** Post now or Schedule. Arrow keys move the choice. */
export const PostOrSchedule: StoryObj = {
  render: function PostOrSchedule() {
    const [v, setV] = useState<"now" | "later">("now");
    return (
      <Segmented
        label="When to post"
        options={[
          { value: "now", label: "Post now" },
          { value: "later", label: "Schedule" },
        ]}
        value={v}
        onChange={setV}
        className="max-w-sm"
      />
    );
  },
};
