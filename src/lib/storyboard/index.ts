import "server-only";
import { projectsRepo } from "../projects/repo";
import { storyboardRepo } from "./repo";
import { storyboardService } from "./service";
import { geminiWriter } from "./writer";

/** The storyboard service wired to the configured database and Gemini (or the fake model). */
export function storyboards() {
  return storyboardService({ projects: projectsRepo(), storyboards: storyboardRepo(), writer: geminiWriter });
}
