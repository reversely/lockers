import Link from "next/link";
import { signOut } from "@/app/auth/actions";

export function TopBar({ email }: { email: string | null }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="wordmark" href="/">
          Lockers
        </Link>
        <nav className="topbar-nav">
          <Link href="/profile">Profile</Link>
          <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>{email}</span>
          <form action={signOut}>
            <button className="btn btn-line" type="submit">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
