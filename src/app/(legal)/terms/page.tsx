import type { Metadata } from "next";
import Link from "next/link";
import { Contact, LegalHeader, Prose } from "@/components/legal/prose";

export const metadata: Metadata = { title: "Terms of Service · ClipGuru" };

export default function TermsPage() {
  return (
    <article>
      <LegalHeader title="Terms of Service" updated="22 November 2026" />
      <Prose>
        <p>By using ClipGuru you agree to these terms. If you don&apos;t agree, please don&apos;t use the service.</p>

        <h2>The service</h2>
        <p>
          ClipGuru helps you turn an idea into a short explainer video and post it to Instagram. It is in an early version
          for invited testers, so features may change, and the service may sometimes be unavailable.
        </p>

        <h2>Your account</h2>
        <ul>
          <li>Keep your sign-in details safe. You are responsible for what happens in your account.</li>
          <li>Give accurate details, and use only Instagram accounts you are allowed to manage.</li>
        </ul>

        <h2>Your content</h2>
        <ul>
          <li>You own your ideas and the videos you make. We use them only to run the service for you.</li>
          <li>
            Scripts and voiceovers are written by AI. Check them before you post: AI can make mistakes, and you are
            responsible for what you publish.
          </li>
          <li>
            Don&apos;t use ClipGuru to make content that is illegal, misleading, hateful, or that breaks someone else&apos;s
            rights or Instagram&apos;s rules.
          </li>
        </ul>

        <h2>Posting to Instagram</h2>
        <p>
          ClipGuru posts only when you press Post now or schedule a post. Instagram decides whether to accept a post, and
          its own terms apply to everything published there.
        </p>

        <h2>Ending</h2>
        <p>
          You can delete your account at any time in Settings. We may suspend accounts that break these terms. See the{" "}
          <Link href="/privacy">Privacy Policy</Link> for what happens to your data.
        </p>

        <h2>Liability</h2>
        <p>
          The service is provided as it is, without guarantees. As far as the law allows, we aren&apos;t liable for indirect
          losses, lost posts or lost content.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms: <Contact />.
        </p>
      </Prose>
    </article>
  );
}
