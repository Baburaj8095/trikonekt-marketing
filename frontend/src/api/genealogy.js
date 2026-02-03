import API from "./api";

/**
 * Fetch the authenticated user's 5-matrix genealogy tree.
 * Server enforces that subtree root (when provided) lies within caller's downline.
 *
 * Params:
 *  - root_user_id?: number (optional subtree root; if omitted, use self as root)
 *  - max_depth?: number (default 6, capped server-side to 20)
 *  - pool?: "FIVE_150" | "THREE_150" | "THREE_50" (default FIVE_150)
 */
export async function getMyGenealogyTree5({ root_user_id = null, max_depth = 6, pool = "FIVE_150" } = {}) {
  const params = { max_depth };
  if (root_user_id != null) params.root_user_id = root_user_id;
  if (pool) params.pool = String(pool).toUpperCase();
  const res = await API.get("/accounts/my/genealogy/tree5/", {
    params,
    cacheTTL: 5000,
    dedupe: "cancelPrevious",
  });
  return res?.data || res;
}

/**
 * Convenience wrapper to fetch a subtree for a given user id.
 */
export async function getMyGenealogySubtree(root_user_id, opts = {}) {
  const { max_depth = 6, pool = "FIVE_150" } = opts || {};
  return getMyGenealogyTree5({ root_user_id, max_depth, pool });
}

export default {
  getMyGenealogyTree5,
  getMyGenealogySubtree,
};
