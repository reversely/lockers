import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/top-bar";
import { updateProfile } from "./actions";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name,id_number,email,phone,preferred_contact,comments")
    .eq("id", data.claims.sub)
    .single();

  return (
    <>
      <TopBar email={profile?.email ?? null} />
      <main className="app-main" style={{ maxWidth: 640 }}>
        <div className="surface" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <span className="eyebrow">Profile</span>
            <h2 className="surface-title" style={{ marginTop: 8 }}>
              Contact details
            </h2>
            <p style={{ fontSize: 14, marginTop: 4 }}>
              A locker request needs a name, an ID number, a phone number, and a preferred contact.
            </p>
          </div>
          {saved ? <p className="notice-line">Saved.</p> : null}
          {error ? <p className="error-line">{error}</p> : null}
          <form action={updateProfile} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="field">
              <label className="field-label" htmlFor="name">
                Name
              </label>
              <input className="input" id="name" name="name" defaultValue={profile?.name ?? ""} required />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="id_number">
                ID number
              </label>
              <input
                className="input"
                id="id_number"
                name="id_number"
                defaultValue={profile?.id_number ?? ""}
                required
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="email">
                Email
              </label>
              <input className="input" id="email" value={profile?.email ?? ""} disabled />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="phone">
                Phone
              </label>
              <input
                className="input"
                id="phone"
                name="phone"
                type="tel"
                defaultValue={profile?.phone ?? ""}
                required
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="preferred_contact">
                Preferred contact
              </label>
              <select
                className="input"
                id="preferred_contact"
                name="preferred_contact"
                defaultValue={profile?.preferred_contact ?? ""}
                required
              >
                <option value="" disabled>
                  Choose one
                </option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="comments">
                Comments
              </label>
              <textarea
                className="input"
                id="comments"
                name="comments"
                defaultValue={profile?.comments ?? ""}
              />
            </div>
            <div>
              <button className="btn btn-ink" type="submit">
                Save
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
