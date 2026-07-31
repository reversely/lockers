import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Verifies an email link that carries a token_hash, the form Supabase templates use when a
// project can customize them. The free-tier default template goes through /auth/callback
// instead; this route also serves password-recovery links later.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}/profile`);
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("The confirmation link is invalid or has expired.")}`,
  );
}
