import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The confirmation email links through Supabase's verify endpoint, which redirects here
// with a one-time code. Exchanging it signs the user in and writes the session cookies.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/profile`);
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("The confirmation link is invalid or has expired.")}`,
  );
}
