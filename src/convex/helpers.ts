import { getAuthUserId } from "@convex-dev/auth/server";
import { QueryCtx, MutationCtx } from "./_generated/server";

/**
 * Find the current user by the Convex auth system's getAuthUserId,
 * which works for both email and anonymous auth.
 */
export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await ctx.db.get(userId);
}

/**
 * Require the current user, throwing if unauthenticated or not found.
 */
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
) {
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user;
}
