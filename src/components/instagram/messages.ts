import type { ConnectError } from "@/lib/instagram/types";

/** What to tell the person when connecting didn't work, and what to do about it. */
export const CONNECT_ERROR_TEXT: Record<ConnectError, { title: string; text: string; steps?: string[] }> = {
  PERSONAL_ACCOUNT: {
    title: "No professional account was shared",
    text: "ClipGuru can only post to an Instagram Business or Creator account, and the account has to be ticked when Meta asks which ones to share.",
    steps: [
      "In Instagram, open Settings → Account type and tools",
      "Switch to a professional account (Business or Creator). It's free",
      "Come back, press Try again, and tick your account",
    ],
  },
  PERMISSION_DENIED: {
    title: "Posting wasn't allowed",
    text: "ClipGuru needs permission to publish to your account. Try again and allow everything it asks for.",
  },
  NOT_A_TESTER: {
    title: "This account isn't invited yet",
    text: "While ClipGuru is in testing, only invited Instagram accounts can connect. Ask the team for an invite, accept it in Instagram, then try again.",
  },
  ACCOUNT_IN_USE: {
    title: "Already connected elsewhere",
    text: "That Instagram account is connected to another ClipGuru account. Disconnect it there first, then try again.",
  },
  CANCELLED: {
    title: "Connecting was cancelled",
    text: "The Instagram login closed before it finished. Try again when you're ready.",
  },
  UNKNOWN: {
    title: "Couldn’t connect Instagram",
    text: "Something went wrong while connecting. Try again in a minute.",
  },
};
