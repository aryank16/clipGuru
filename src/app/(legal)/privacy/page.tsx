import type { Metadata } from "next";
import Link from "next/link";
import { Contact, LegalHeader, Prose } from "@/components/legal/prose";

export const metadata: Metadata = { title: "Privacy Policy · ClipGuru" };

export default function PrivacyPage() {
  return (
    <article>
      <LegalHeader title="Privacy Policy" updated="22 November 2026" />
      <Prose>
        <p>
          ClipGuru turns an idea into a short explainer video and, if you ask it to, posts that video to your Instagram
          account. This page explains what we collect, why, who helps us run the service, and how to delete your data.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Your account:</strong> your name, email address and a scrambled (hashed) password. If you sign in with
            Google, we receive your name, email address and profile picture from Google.
          </li>
          <li>
            <strong>What you make:</strong> your video ideas, the chat with ClipGuru, storyboards, voiceovers, finished
            videos, captions and hashtags, and the times you schedule posts for.
          </li>
          <li>
            <strong>Your Instagram connection (only if you connect it):</strong> your Instagram account id, username and
            profile picture, and an access token from Meta that lets ClipGuru publish Reels for you. The token is stored
            encrypted and is never shown in the browser.
          </li>
          <li>
            <strong>Settings and technical data:</strong> your chosen voice and time zone, a session cookie that keeps you
            signed in, and server logs (such as the page requested, the time and your IP address) that help us fix errors.
          </li>
        </ul>

        <h2>How we use it</h2>
        <ul>
          <li>To run your account and keep it secure.</li>
          <li>To write scripts, record voiceovers and make your videos.</li>
          <li>
            To publish a video to your Instagram account, only when you press Post now or schedule a post, with the caption
            you approved. We don&apos;t read your messages, followers or other posts.
          </li>
          <li>To find and fix problems.</li>
        </ul>
        <p>We don&apos;t sell your data or show ads.</p>

        <h2>Services that help us</h2>
        <p>We share only what each service needs to do its job:</p>
        <ul>
          <li>Vercel: hosts the app and makes the videos.</li>
          <li>MongoDB Atlas: stores your account and projects.</li>
          <li>Cloudflare R2: stores voiceovers, videos and cover images.</li>
          <li>
            Google Gemini: writes and revises scripts from your ideas and chat messages. We use Gemini&apos;s free tier, under
            which Google may use these prompts to improve its services, so don&apos;t put private information in your ideas.
          </li>
          <li>ElevenLabs: turns the script into the voiceover.</li>
          <li>Inngest: runs background jobs such as making videos and posting at the scheduled time.</li>
          <li>Meta (Instagram): receives the video and caption when you post.</li>
          <li>Google: signs you in, if you choose Continue with Google.</li>
        </ul>

        <h2>How long we keep it</h2>
        <ul>
          <li>Your account and videos stay until you delete them.</li>
          <li>A deleted video can be restored for 30 days and is then removed for good, with its files.</li>
          <li>Deleting your account removes your account, videos, files and Instagram connection straight away.</li>
          <li>Server logs are kept for a short time by our hosting provider.</li>
        </ul>

        <h2>Your choices</h2>
        <ul>
          <li>Disconnect Instagram at any time in Settings. We then delete the stored access token.</li>
          <li>Delete a video, or your whole account, in the app.</li>
          <li>
            Ask us for a copy of your data, or to correct or delete it, by writing to <Contact />.
          </li>
        </ul>
        <p>
          See <Link href="/data-deletion">how to delete your data</Link> for step-by-step instructions.
        </p>

        <h2>Cookies</h2>
        <p>We use only the cookies needed to keep you signed in and to complete the Instagram connection safely.</p>

        <h2>Changes and contact</h2>
        <p>
          If we change this policy we&apos;ll update the date at the top. Questions: <Contact />.
        </p>
      </Prose>
    </article>
  );
}
