"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateSettings(formData: FormData) {
  const reservationMinutes = Number(formData.get("reservation_minutes"));
  const defaultLeaseDays = Number(formData.get("default_lease_days"));
  if (!Number.isInteger(reservationMinutes) || reservationMinutes <= 0) {
    redirect(`/admin/settings?error=${encodeURIComponent("Reservation minutes needs a positive whole number.")}`);
  }
  if (!Number.isInteger(defaultLeaseDays) || defaultLeaseDays <= 0) {
    redirect(`/admin/settings?error=${encodeURIComponent("Default lease days needs a positive whole number.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      etransfer_instructions: String(formData.get("etransfer_instructions") ?? "").trim(),
      reservation_minutes: reservationMinutes,
      default_lease_days: defaultLeaseDays,
      approval_email_subject: String(formData.get("approval_email_subject") ?? "").trim(),
      approval_email_body: String(formData.get("approval_email_body") ?? "").trim(),
    })
    .eq("id", true);

  if (error) redirect(`/admin/settings?error=${encodeURIComponent(error.message)}`);
  redirect("/admin/settings?saved=1");
}
