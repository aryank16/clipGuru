import type { Metadata } from "next";
import Link from "next/link";
import { Contact, LegalHeader, Prose } from "@/components/legal/prose";

export const metadata: Metadata = { title: "Delete your data" };

export default function DataDeletionPage() {
  return (
    <article>
      <LegalHeader title="Delete your data" updated="22 November 2026" />
      <Prose>
        <p>You can remove your data from ClipGuru at any time, in whichever of these ways suits you.</p>

        <h2>Delete your whole account</h2>
        <ul>
          <li>
            Sign in, open <Link href="/settings">Settings</Link>, and choose <strong>Delete account</strong> at the bottom.
          </li>
          <li>
            This removes your account, all your videos and their files, scheduled posts, and your Instagram connection
            straight away. It can&apos;t be undone.
          </li>
        </ul>

        <h2>Disconnect Instagram only</h2>
        <ul>
          <li>
            In <Link href="/settings">Settings</Link>, choose <strong>Disconnect</strong> under Instagram. We delete the
            stored access token, and any scheduled posts are put on hold.
          </li>
          <li>
            You can also remove ClipGuru from Meta&apos;s side: in your Facebook settings, open Business integrations; in
            your Instagram settings, open Apps and websites. Find ClipGuru and remove it. Meta moves these menus from
            time to time; searching the settings for &ldquo;integrations&rdquo; or &ldquo;apps and websites&rdquo; finds them.
          </li>
        </ul>

        <h2>Delete single videos</h2>
        <p>
          In My videos, open a video&apos;s menu and choose Delete. You can restore it for 30 days; after that it is removed for
          good, with its files.
        </p>

        <h2>Ask us to do it</h2>
        <p>
          If you can&apos;t sign in, write to <Contact /> from the email address on your account. We&apos;ll delete your data
          within 30 days and confirm when it&apos;s done.
        </p>
      </Prose>
    </article>
  );
}
