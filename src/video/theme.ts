import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Fonts are bundled locally so renders never depend on a font CDN.
const fontFamily = "Poppins";
for (const weight of ["400", "500", "600", "700"]) {
  loadFont({ family: fontFamily, url: staticFile(`fonts/poppins-latin-${weight}-normal.woff2`), weight });
}

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const theme = {
  font: fontFamily,
  bg: "#F7F5F0", // off-white
  ink: "#1F2328", // charcoal
  muted: "#7C828C",
  line: "#E3DED4",
  accent: "#2F7DE1", // the one accent colour
  white: "#FFFFFF",
};

// Vertical layout zones (1080x1920, Instagram Reels safe area)
export const zones = {
  headingY: 250, // top of heading block
  visualTop: 470,
  visualBottom: 1300,
  captionCenterY: 1450, // lower third, clear of the Reels UI at the bottom
};
