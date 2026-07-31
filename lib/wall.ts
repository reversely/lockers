// Shared shapes and queries for the wall. Every query names its columns: the column grants on
// settings and leases refuse a select * from a signed-in user, so a * anywhere in client code
// fails with 403 and renders an empty wall.

import type { SupabaseClient } from "@supabase/supabase-js";

export type WallRow = {
  locker_id: string;
  label: string;
  row: number;
  col: number;
  is_active: boolean;
  state: "inactive" | "available" | "reserved" | "occupied";
  reserved_by: string | null;
  reserved_until: string | null;
  lease_id: string | null;
  occupant_id: string | null;
  occupant_name: string | null;
  start_date: string | null;
  end_date: string | null;
};

export type OpenRequest = { id: string; status: "pending" | "approved" } | null;

const WALL_COLUMNS =
  "locker_id,label,row,col,is_active,state,reserved_by,reserved_until,lease_id,occupant_id,occupant_name,start_date,end_date";

export async function fetchWall(supabase: SupabaseClient): Promise<WallRow[]> {
  const { data } = await supabase
    .from("locker_wall")
    .select(WALL_COLUMNS)
    .order("row")
    .order("col");
  return (data as WallRow[]) ?? [];
}

export async function fetchOpenRequest(supabase: SupabaseClient, userId: string): Promise<OpenRequest> {
  const { data } = await supabase
    .from("requests")
    .select("id,status")
    .eq("user_id", userId)
    .in("status", ["pending", "approved"])
    .maybeSingle();
  return (data as OpenRequest) ?? null;
}

export function formatDate(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
