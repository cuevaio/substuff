import Link from "next/link";

export default function Privacy() {
  return (
    <main className="policy-page">
      <Link href="/" className="brand">
        substuff
      </Link>
      <h1>Your writing stays yours.</h1>
      <p>Last updated November 6, 2026.</p>
      <h2>What we store</h2>
      <p>
        We store your articles, Note drafts, approvals, Buffer connection, and
        publishing receipts in Neon. A private browser cookie opens your
        workspace. Connecting Buffer lets you recover the same workspace from
        another browser by signing into the same Buffer account.
      </p>
      <h2>AI writing</h2>
      <p>
        When you choose Create Notes, your article is sent through Vercel AI
        Gateway to Google Gemini, with OpenAI as a fallback. Don’t upload
        writing you don’t have permission to process. Buffer credentials are
        never sent to a writing model. Provider processing is subject to their
        service policies; substuff does not train a model on your writing.
      </p>
      <h2>Buffer</h2>
      <p>
        We request account-read and post-read/write access. Tokens are encrypted
        at rest. Nothing is published without your explicit approval. Disconnect
        in Preferences to remove substuff’s stored credentials; you can also
        revoke access in Buffer’s account settings. Removing the connection does
        not cancel posts already scheduled in Buffer.
      </p>
      <h2>Retention and deletion</h2>
      <p>
        Guest workspace access lasts 30 days. Inactive workspaces expire and are
        removed by daily cleanup. Clear workspace in Preferences to remove the
        stored article document and local backup. This does not delete a post
        already sent to Buffer. Publishing receipts are retained with the
        workspace for duplicate prevention and delivery status. Local browser
        backups remain until you clear them or clear browser storage.
      </p>
      <h2>Security and hosting</h2>
      <p>
        Hosting runs on Vercel. We use hashed daily IP buckets to limit abuse
        and do not store raw IP addresses in the quota database. Standard
        hosting security logs may include request metadata. This early release
        does not use advertising trackers or sell personal data.
      </p>
      <h2>Contact</h2>
      <p>
        For access or deletion requests, email{" "}
        <a href="mailto:hi@cueva.io">hi@cueva.io</a>.
      </p>
    </main>
  );
}
