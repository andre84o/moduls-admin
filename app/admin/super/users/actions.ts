"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import type { MemberRole } from "@/app/generated/prisma/enums";

export type AddMemberState = { error?: string; success?: string } | undefined;

const VALID_ROLES: MemberRole[] = ["OWNER", "ADMIN", "STAFF"];

export async function addMember(
  _prev: AddMemberState,
  formData: FormData,
): Promise<AddMemberState> {
  await requireSuperAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const businessId = String(formData.get("businessId") ?? "").trim();
  const role = String(formData.get("role") ?? "") as MemberRole;

  if (!email || !businessId || !role) {
    return { error: "Alla fält är obligatoriska." };
  }
  if (!VALID_ROLES.includes(role)) {
    return { error: "Ogiltig roll." };
  }

  const prisma = getPrisma();

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  });
  if (!business) return { error: "Företaget hittades inte." };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const { data: inviteData, error: inviteError } =
    await supabaseAdmin().auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/auth/callback`,
    });

  const errStatus = (inviteError as { status?: number } | null)?.status;
  const errMsg = inviteError?.message || "";

  const emailFailed = errStatus === 500;
  const alreadyExists =
    errStatus === 422 ||
    errMsg.toLowerCase().includes("already") ||
    (inviteError as { code?: string } | null)?.code === "email_exists";

  if (inviteError && !emailFailed && !alreadyExists) {
    console.error("[addMember] inviteUserByEmail:", inviteError);
    return { error: `Kunde inte bjuda in användaren (${errStatus ?? "okänt fel"}).` };
  }

  const supabaseId = inviteData?.user?.id;

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { supabaseId: supabaseId ?? `pending-${email}`, email },
    });
  } else if (supabaseId && user.supabaseId.startsWith("pending-")) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { supabaseId },
    });
  }

  const existing = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId: user.id } },
  });

  if (existing) {
    await prisma.businessMember.update({
      where: { id: existing.id },
      data: { role },
    });
  } else {
    await prisma.businessMember.create({
      data: { businessId, userId: user.id, role },
    });
  }

  revalidatePath("/admin/super/users");

  if (emailFailed) {
    return {
      success: `${email} lades till som ${role} men inbjudningsmail kunde inte skickas. Konfigurera SMTP i Supabase Dashboard.`,
    };
  }

  return { success: `Inbjudan skickad till ${email}.` };
}

export async function removeMember(memberId: string): Promise<void> {
  await requireSuperAdmin();
  await getPrisma().businessMember.delete({ where: { id: memberId } });
  revalidatePath("/admin/super/users");
}

export async function updateMemberRole(
  memberId: string,
  role: MemberRole,
): Promise<void> {
  await requireSuperAdmin();
  if (!VALID_ROLES.includes(role)) return;
  await getPrisma().businessMember.update({
    where: { id: memberId },
    data: { role },
  });
  revalidatePath("/admin/super/users");
}
