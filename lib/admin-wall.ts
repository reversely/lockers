// Data shapes and queries for the admin wall. The admin session is still the authenticated
// role, so lease comments come through admin_leases (owner rights behind an is_admin gate)
// rather than the base table, whose column grant withholds comments from authenticated.

import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminLocker = {
  id: string;
  label: string;
  row: number;
  col: number;
  is_active: boolean;
  comments: string | null;
};

export type AdminLease = {
  id: string;
  locker_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  comments: string | null;
};

export type AdminReservation = {
  id: string;
  locker_id: string;
  user_id: string;
  expires_at: string;
};

export type Person = {
  id: string;
  name: string | null;
  id_number: string | null;
  email: string | null;
  phone: string | null;
};

export type AdminWallData = {
  lockers: AdminLocker[];
  leases: AdminLease[];
  reservations: AdminReservation[];
  people: Record<string, Person>;
};

export async function fetchAdminWall(supabase: SupabaseClient): Promise<AdminWallData> {
  const [lockerResult, leaseResult, reservationResult] = await Promise.all([
    supabase.from("lockers").select("id,label,row,col,is_active,comments").order("row").order("col"),
    supabase.from("admin_leases").select("id,locker_id,user_id,start_date,end_date,comments").is("ended_at", null),
    supabase.from("reservations").select("id,locker_id,user_id,expires_at"),
  ]);

  const lockers = (lockerResult.data as AdminLocker[]) ?? [];
  const leases = (leaseResult.data as AdminLease[]) ?? [];
  const now = Date.now();
  const reservations = ((reservationResult.data as AdminReservation[]) ?? []).filter(
    (r) => new Date(r.expires_at).getTime() > now,
  );

  const personIds = [...new Set([...leases.map((l) => l.user_id), ...reservations.map((r) => r.user_id)])];
  let people: Record<string, Person> = {};
  if (personIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id,name,id_number,email,phone")
      .in("id", personIds);
    people = Object.fromEntries(((data as Person[]) ?? []).map((p) => [p.id, p]));
  }

  return { lockers, leases, reservations, people };
}

export async function searchPeople(supabase: SupabaseClient, term: string): Promise<Person[]> {
  const like = `%${term}%`;
  const { data } = await supabase
    .from("profiles")
    .select("id,name,id_number,email,phone")
    .or(`name.ilike.${like},id_number.ilike.${like}`)
    .limit(8);
  return (data as Person[]) ?? [];
}
