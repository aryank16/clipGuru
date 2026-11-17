import { registerRoot } from "remotion";
import { Root } from "./Root";

// Entry for the server-side bundle (npm run bundle:video). The browser preview uses the Player directly.
registerRoot(Root);
