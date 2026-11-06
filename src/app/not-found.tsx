import Link from "next/link";
export default function NotFound() {
  return (
    <main className="welcome">
      <div className="welcome-copy">
        <h1>Post not found.</h1>
        <p>It may have been cleared from your workspace.</p>
        <Link className="button primary" href="/">
          Open workspace
        </Link>
      </div>
    </main>
  );
}
