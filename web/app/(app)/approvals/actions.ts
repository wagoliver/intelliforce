"use server";

import { approvals } from "@/lib/api/approvals";

export async function decideApprovalAction(
  id: string,
  decision: "approve" | "reject",
  reason: string
) {
  if (decision === "approve") {
    await approvals.approve(id, reason);
  } else {
    await approvals.reject(id, reason);
  }
}
