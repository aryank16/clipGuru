import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

// Each call runs one step of a job; setting up the render machine is the slowest (1 to 3 minutes).
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({ client: inngest, functions });
