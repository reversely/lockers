import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/top-bar";
import { Dashboard } from "@/components/dashboard";
import { fetchOpenRequest, fetchWall } from "@/lib/wall";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  const userId = data.claims.sub;

  const [profileResult, settingsResult, wall, request] = await Promise.all([
    supabase
      .from("profiles")
      .select("name,id_number,email,phone,preferred_contact")
      .eq("id", userId)
      .single(),
    // Column-named on purpose: the grant on settings covers etransfer_instructions only.
    supabase.from("settings").select("etransfer_instructions").single(),
    fetchWall(supabase),
    fetchOpenRequest(supabase, userId),
  ]);

  const profile = profileResult.data;
  const profileComplete = Boolean(
    profile?.name && profile?.id_number && profile?.phone && profile?.preferred_contact,
  );

  return (
    <>
      <TopBar email={profile?.email ?? null} />
      <main className="app-main">
        <Dashboard
          userId={userId}
          profileComplete={profileComplete}
          instructions={settingsResult.data?.etransfer_instructions ?? ""}
          initialWall={wall}
          initialRequest={request}
        />
      </main>
    </>
  );
}
