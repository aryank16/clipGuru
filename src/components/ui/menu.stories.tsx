import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { Menu, MenuDivider, MenuItem } from "./menu";

const meta = { title: "Atoms/Menu", component: Menu } satisfies Meta<typeof Menu>;
export default meta;

export const CardActions: StoryObj = {
  render: () => (
    <Menu className="static">
      <MenuItem icon={Pencil}>Rename</MenuItem>
      <MenuItem icon={Copy}>Duplicate</MenuItem>
      <MenuDivider />
      <MenuItem icon={Trash2} danger>Delete</MenuItem>
    </Menu>
  ),
};
