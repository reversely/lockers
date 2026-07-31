import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/wall";
import { approveRequest, retrySend } from "./actions";

export const metadata: Metadata = { title: "Requests" };

type PendingRow = {
  id: string;
  created_at: string;
  requester: {
    name: string | null;
    id_number: string | null;
    email: string | null;
    phone: string | null;
    preferred_contact: "email" | "phone" | null;
  } | null;
};

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ approved?: string; sent?: string; sendfail?: string; error?: string }>;
}) {
  const { approved, sent, sendfail, error } = await searchParams;
  const supabase = await createClient();

  // Two foreign keys point at profiles (user_id, approved_by), so the embed names its constraint.
  const { data: pending } = await supabase
    .from("requests")
    .select("id,created_at,requester:profiles!requests_user_id_fkey(name,id_number,email,phone,preferred_contact)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .overrideTypes<PendingRow[]>();

  return (
    <section className="surface" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <span className="eyebrow">Requests</span>
        <h2 className="surface-title" style={{ marginTop: 8 }}>
          Pending requests
        </h2>
      </div>

      {error ? <p className="error-line">{error}</p> : null}
      {approved && sent ? <p className="notice-line">Approved. The email went out.</p> : null}
      {approved && sendfail ? (
        <div
          style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
        >
          <p className="error-line">Approved, and the email did not send: {sendfail}.</p>
          <form action={retrySend}>
            <input type="hidden" name="request_id" value={approved} />
            <button className="btn btn-line" type="submit">
              Retry send
            </button>
          </form>
        </div>
      ) : null}

      {!pending || pending.length === 0 ? (
        <p style={{ fontSize: 14 }}>No pending requests.</p>
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
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((row) => (
                <tr key={row.id}>
                  <td className="worktable-title">{row.requester?.name ?? "no name yet"}</td>
                  <td>{row.requester?.id_number ?? ""}</td>
                  <td>{row.requester?.email ?? ""}</td>
                  <td>{row.requester?.phone ?? ""}</td>
                  <td>
                    {row.requester?.preferred_contact ? (
                      <span className="tag">{row.requester.preferred_contact}</span>
                    ) : null}
                  </td>
                  <td>{formatDate(row.created_at)}</td>
                  <td style={{ textAlign: "right" }}>
                    <form action={approveRequest}>
                      <input type="hidden" name="request_id" value={row.id} />
                      <button className="btn btn-ink" type="submit">
                        Approve
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
