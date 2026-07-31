import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { updateSettings } from "./actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("admin_settings")
    .select("etransfer_instructions,reservation_minutes,default_lease_days,approval_email_subject,approval_email_body")
    .single();

  return (
    <section className="surface" style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <span className="eyebrow">Settings</span>
        <h2 className="surface-title" style={{ marginTop: 8 }}>
          Requests and leases
        </h2>
      </div>
      {saved ? <p className="notice-line">Saved.</p> : null}
      {error ? <p className="error-line">{error}</p> : null}

      <form action={updateSettings} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="field">
          <label className="field-label" htmlFor="etransfer_instructions">
            E-transfer instructions, shown to a user with a pending request
          </label>
          <textarea
            className="input"
            id="etransfer_instructions"
            name="etransfer_instructions"
            rows={5}
            defaultValue={settings?.etransfer_instructions ?? ""}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field">
            <label className="field-label" htmlFor="reservation_minutes">Reservation minutes</label>
            <input
              className="input"
              id="reservation_minutes"
              name="reservation_minutes"
              type="number"
              min={1}
              step={1}
              defaultValue={settings?.reservation_minutes ?? 15}
              required
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="default_lease_days">Default lease days</label>
            <input
              className="input"
              id="default_lease_days"
              name="default_lease_days"
              type="number"
              min={1}
              step={1}
              defaultValue={settings?.default_lease_days ?? 120}
              required
            />
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="approval_email_subject">Approval email subject</label>
          <input
            className="input"
            id="approval_email_subject"
            name="approval_email_subject"
            defaultValue={settings?.approval_email_subject ?? ""}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="approval_email_body">Approval email body</label>
          <textarea
            className="input"
            id="approval_email_body"
            name="approval_email_body"
            rows={6}
            defaultValue={settings?.approval_email_body ?? ""}
          />
        </div>
        <div>
          <button className="btn btn-ink" type="submit">Save</button>
        </div>
      </form>
    </section>
  );
}
