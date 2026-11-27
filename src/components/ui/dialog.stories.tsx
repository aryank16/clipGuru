import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Input } from "./input";

const meta = { title: "Atoms/Dialog", component: Dialog, parameters: { layout: "fullscreen" } } satisfies Meta<typeof Dialog>;
export default meta;

/** Escape, Cancel or a click outside closes it; Tab stays inside; focus goes back to the opener. */
export const Rename: StoryObj = {
  render: function Rename() {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button variant="secondary" onClick={() => setOpen(true)}>Rename video</Button>
        {open ? (
          <Dialog titleId="sb-rename" onClose={() => setOpen(false)} onSubmit={(e) => { e.preventDefault(); setOpen(false); }}>
            <h2 id="sb-rename" className="text-lg font-semibold">Rename video</h2>
            <Input size="md" aria-label="Title" defaultValue="How compound interest snowballs" autoFocus />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </Dialog>
        ) : null}
      </>
    );
  },
};

export const Delete: StoryObj = {
  render: function Delete() {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button variant="danger" onClick={() => setOpen(true)}>Delete account</Button>
        {open ? (
          <Dialog titleId="sb-delete" onClose={() => setOpen(false)}>
            <h2 id="sb-delete" className="text-lg font-semibold">Delete your account?</h2>
            <p className="text-muted">This deletes your account and all your videos for good. This can&apos;t be undone.</p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => setOpen(false)}>Delete account</Button>
            </div>
          </Dialog>
        ) : null}
      </>
    );
  },
};
