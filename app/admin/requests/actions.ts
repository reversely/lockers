"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend";

async function sendApprovalEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ sent: boolean; reason?: string }> {
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("email").eq("id", userId).single(),
    supabase.from("admin_settings").select("approval_email_subject,approval_email_body").single(),
  ]);
  if (!profile?.email) return { sent: false, reason: "the requester has no email on file" };
  return sendEmail({
    to: profile.email,
    subject: settings?.approval_email_subject || "Your locker request is approved",
    body:
      settings?.approval_email_body ||
      "Your locker request is approved. Sign in to pick your locker.",
  });
}

// The approval commits before the send, so a send failure leaves the request approved and the
// queue offers a retry.
export async function approveRequest(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");

  const { data: request, error } = await supabase
    .from("requests")
    .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: claims.claims.sub })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("user_id")
    .single();
  if (error || !request) {
    redirect(`/admin/requests?error=${encodeURIComponent(error?.message ?? "request not found or not pending")}`);
  }

  const result = await sendApprovalEmail(supabase, request.user_id);
  if (!result.sent) {
    redirect(
      `/admin/requests?approved=${requestId}&sendfail=${encodeURIComponent(result.reason ?? "unknown")}`,
    );
  }
  redirect(`/admin/requests?approved=${requestId}&sent=1`);
}

export async function retrySend(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "");
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("requests")
    .select("user_id,status")
    .eq("id", requestId)
    .single();
  if (!request || request.status !== "approved") {
    redirect(`/admin/requests?error=${encodeURIComponent("that request is not approved")}`);
  }

  const result = await sendApprovalEmail(supabase, request.user_id);
  if (!result.sent) {
    redirect(
      `/admin/requests?approved=${requestId}&sendfail=${encodeURIComponent(result.reason ?? "unknown")}`,
    );
  }
  redirect(`/admin/requests?approved=${requestId}&sent=1`);
}
