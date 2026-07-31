"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateUserProfile(formData: FormData) {
  const userId = String(formData.get("user_id") ?? "");
  const preferred = String(formData.get("preferred_contact") ?? "");
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      name: String(formData.get("name") ?? "").trim() || null,
      id_number: String(formData.get("id_number") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      preferred_contact: preferred === "email" || preferred === "phone" ? preferred : null,
      comments: String(formData.get("comments") ?? "").trim() || null,
    })
    .eq("id", userId);

  if (error) redirect(`/admin/users?error=${encodeURIComponent(error.message)}`);
  redirect(`/admin/users?saved=${userId}`);
}
