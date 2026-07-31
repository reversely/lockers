import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { fetchAdminWall } from "@/lib/admin-wall";
import { AdminWall } from "@/components/admin-wall";

export const metadata: Metadata = { title: "Wall" };

export default async function AdminWallPage() {
  const supabase = await createClient();
  const [initial, settingsResult] = await Promise.all([
    fetchAdminWall(supabase),
    supabase.from("admin_settings").select("default_lease_days").single(),
  ]);

  return (
    <AdminWall initial={initial} defaultLeaseDays={settingsResult.data?.default_lease_days ?? 120} />
  );
}
