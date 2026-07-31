import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { updateUserProfile } from "./actions";

export const metadata: Metadata = { title: "Users" };

type ProfileRow = {
  id: string;
  name: string | null;
  id_number: string | null;
  email: string | null;
  phone: string | null;
  preferred_contact: "email" | "phone" | null;
  comments: string | null;
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; saved?: string; error?: string }>;
}) {
  const { edit, saved, error } = await searchParams;
  const supabase = await createClient();

  const [{ data: profileData }, { data: leaseData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,name,id_number,email,phone,preferred_contact,comments")
      .order("name", { ascending: true, nullsFirst: false }),
    supabase.from("admin_leases").select("user_id,locker_id").is("ended_at", null),
  ]);
  const profiles = (profileData as ProfileRow[]) ?? [];
  const leases = leaseData ?? [];

  let lockerLabels: Record<string, string> = {};
  if (leases.length > 0) {
    const { data: lockers } = await supabase
      .from("lockers")
      .select("id,label")
      .in("id", leases.map((l) => l.locker_id));
    const byId = Object.fromEntries((lockers ?? []).map((l) => [l.id, l.label]));
    lockerLabels = Object.fromEntries(leases.map((l) => [l.user_id, byId[l.locker_id]]));
  }

  const editing = profiles.find((p) => p.id === edit) ?? null;

  return (
    <section className="surface" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <span className="eyebrow">Users</span>
        <h2 className="surface-title" style={{ marginTop: 8 }}>
          Every account
        </h2>
      </div>
      {error ? <p className="error-line">{error}</p> : null}
      {saved ? <p className="notice-line">Saved.</p> : null}

      {editing ? (
        <form
          action={updateUserProfile}
          className="surface"
          style={{ boxShadow: "none", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 12 }}
        >
          <span className="eyebrow">Editing {editing.email}</span>
          <input type="hidden" name="user_id" value={editing.id} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label className="field-label" htmlFor="name">Name</label>
              <input className="input" id="name" name="name" defaultValue={editing.name ?? ""} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="id_number">ID number</label>
              <input className="input" id="id_number" name="id_number" defaultValue={editing.id_number ?? ""} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="phone">Phone</label>
              <input className="input" id="phone" name="phone" defaultValue={editing.phone ?? ""} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="preferred_contact">Preferred contact</label>
              <select className="input" id="preferred_contact" name="preferred_contact" defaultValue={editing.preferred_contact ?? ""}>
                <option value="">none</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="comments">Comments</label>
            <textarea className="input" id="comments" name="comments" defaultValue={editing.comments ?? ""} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ink" type="submit">Save</button>
            <Link className="btn btn-line" href="/admin/users">Cancel</Link>
          </div>
        </form>
      ) : null}

      {profiles.length === 0 ? (
        <p style={{ fontSize: 14 }}>No accounts exist yet.</p>
      ) : (
        <div className="wall-scroll">
          <table className="worktable">
            <thead>
              <tr>
                <th>Name</th>
                <th>ID number</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Preferred contact</th>
                <th>Comments</th>
                <th>Locker</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((row) => (
                <tr key={row.id}>
                  <td className="worktable-title">
                    <Link href={`/admin/users?edit=${row.id}`} style={{ color: "inherit" }}>
                      {row.name ?? "no name yet"}
                    </Link>
                  </td>
                  <td>{row.id_number ?? ""}</td>
                  <td>{row.email ?? ""}</td>
                  <td>{row.phone ?? ""}</td>
                  <td>{row.preferred_contact ? <span className="tag">{row.preferred_contact}</span> : null}</td>
                  <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{row.comments ?? ""}</td>
                  <td>{lockerLabels[row.id] ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
