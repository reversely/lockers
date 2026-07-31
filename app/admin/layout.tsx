import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/top-bar";

// Row level security refuses admin data to everyone else regardless; this redirect is
// navigation for a signed-in non-admin who typed the URL.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email,role")
    .eq("id", data.claims.sub)
    .single();
  if (profile?.role !== "admin") redirect("/");

  return (
    <>
      <TopBar email={profile.email} />
      <nav className="topbar" style={{ height: 44 }}>
        <div className="topbar-inner" style={{ justifyContent: "flex-start", gap: 24 }}>
          <Link href="/admin/requests">Requests</Link>
          <Link href="/admin/wall">Wall</Link>
          <Link href="/admin/users">Users</Link>
          <Link href="/admin/settings">Settings</Link>
        </div>
      </nav>
      <main className="app-main">{children}</main>
    </>
  );
}
