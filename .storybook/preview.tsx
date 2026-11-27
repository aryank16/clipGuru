import type { Decorator, Preview } from "@storybook/nextjs-vite";
import { useEffect, type ReactNode } from "react";
import "../src/app/globals.css";
import { THEMES } from "../src/design/tokens";

/** Sets data-theme on <html>, exactly as the app does, so every story follows the toolbar's theme. */
function Themed({ theme, children }: { theme: string; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  return (
    <div data-theme={theme} className="min-h-dvh bg-canvas p-6 font-sans text-ink">
      {children}
    </div>
  );
}

const withTheme: Decorator = (Story, ctx) => (
  <Themed theme={ctx.globals.theme as string}>
    <Story />
  </Themed>
);

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "App theme",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        items: THEMES.map((t) => ({ value: t.id, title: t.label })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: THEMES[0].id },
  decorators: [withTheme],
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    a11y: { test: "todo" },
  },
};

export default preview;
