import type { Metadata } from "next";
import Link from "next/link";
import { signUp } from "@/app/auth/actions";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="auth-main">
      <div className="surface auth-card">
        <div>
          <span className="eyebrow">Lockers</span>
          <h2 className="surface-title" style={{ marginTop: 8 }}>
            Sign up
          </h2>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
        <form action={signUp} className="auth-card" style={{ padding: 0, boxShadow: "none" }}>
          <div className="field">
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input className="input" id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
            />
            <span className="notice-line">At least 6 characters.</span>
          </div>
          <button className="btn btn-ink" type="submit">
            Sign up
          </button>
        </form>
        <p style={{ fontSize: 14 }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
