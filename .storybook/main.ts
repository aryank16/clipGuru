import tailwindcss from "@tailwindcss/vite";
import type { StorybookConfig } from "@storybook/nextjs-vite";

/**
 * Storybook: every shared component on its own, in every theme, with sample data.
 * Run `npm run storybook` locally; `npm run build-storybook` makes the static site we publish.
 */
const config: StorybookConfig = {
  framework: "@storybook/nextjs-vite",
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-a11y"],
  core: { disableTelemetry: true },
  async viteFinal(cfg) {
    cfg.plugins = [...(cfg.plugins ?? []), tailwindcss()];
    return cfg;
  },
};

export default config;
