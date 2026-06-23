import "server-only";
import { getPrisma } from "./prisma";
import { isDemoMode } from "./config";
import type { Prisma } from "@/app/generated/prisma/client";

/**
 * Write an AuditLog row for an important admin action. Always scoped by
 * businessId. Audit failures must never break the main action, so they are
 * swallowed. No-op in demo mode.
 */
export async function writeAuditLog(input: {
  businessId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  if (isDemoMode()) return;

  try {
    await getPrisma().auditLog.create({
      data: {
        businessId: input.businessId,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata,
      },
    });
  } catch {
    /* never let audit logging break the request */
  }
}
