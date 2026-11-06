import { Brand } from "@/components/brand";

export default function Privacy() {
  return (
    <main className="policy-page">
      <Brand />
      <h1>Your writing stays yours.</h1>
      <p>Last updated November 6, 2026.</p>
      <h2>What we store</h2>
      <p>
        We store your articles, Note drafts, approvals, Buffer connection, and
        publishing receipts in Neon. Buffer sign-in is required; a private
        browser cookie opens your account workspace. Connecting Buffer lets you
        recover the same workspace from another browser by signing into the same
        Buffer account. Connected publication feeds are checked daily. We import
        publicly available posts only; we do not bypass paywalls.
      </p>
      <h2>AI writing</h2>
      <p>
        During onboarding, we read your latest published post and analyze its
        ideas and writing style before creating private suggestions. Onboarding
        never publishes Notes. When you import posts, your article is sent
        through Vercel AI Gateway to Google Gemini, with OpenAI as a fallback.
        Don’t upload writing you don’t have permission to process. Buffer
        credentials are never sent to a writing model. Provider processing is
        subject to their service policies; substuff does not train a model on
        your writing. A connected feed can request drafts for newly discovered
        posts while you are away. Daily limits and the writing-provider budget
        apply.
      </p>
      <h2>Buffer</h2>
      <p>
        We request account-read and post-read/write access. Tokens are encrypted
        at rest. By default, every Note needs your approval. If you explicitly
        enable Auto-publish in Settings, the selected number of AI-written Notes
        can publish immediately to your chosen channel without individual
        review. Existing imported posts are not automatically included. Turning
        the mode off stops future sends; an in-flight send may finish.
        Unconfirmed publishing requests are never resent automatically.
        Disconnect in Settings to remove substuff’s stored credentials; you can
        also revoke access in Buffer’s account settings. Removing the connection
        does not cancel posts already scheduled in Buffer.
      </p>
      <h2>Retention and deletion</h2>
      <p>
        Browser sessions last 30 days. Inactive workspaces expire and are
        removed by daily cleanup. Clear workspace in Settings to remove the
        stored article document and local backup. This does not delete a post
        already sent to Buffer. Publishing receipts are retained with the
        workspace for duplicate prevention and delivery status. Local browser
        backups remain until you clear them or clear browser storage. Clearing
        also removes resumable article copies from import jobs. Feed and
        publishing preferences stay unchanged. Signing out closes access on this
        browser; it does not disable feed checks or Auto-publish.
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
