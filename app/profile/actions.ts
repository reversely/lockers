"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  const preferred = String(formData.get("preferred_contact") ?? "");
  const { error } = await supabase
    .from("profiles")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      id_number: String(formData.get("id_number") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      preferred_contact: preferred === "email" || preferred === "phone" ? preferred : null,
      comments: String(formData.get("comments") ?? "").trim() || null,
    })
    .eq("id", data.claims.sub);

  if (error) redirect(`/profile?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/");
  redirect("/profile?saved=1");
}
