import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Every route except static assets, so each request refreshes its session.
  matcher: ["/((?!_next/static|_next/image|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
