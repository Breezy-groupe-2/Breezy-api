// Helpers to resolve author references into public user objects by calling the
// auth-service internal endpoints. Failures degrade gracefully to a placeholder
// so a single unreachable lookup never breaks a whole feed render.
const authServiceUrl = () => process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
const commentServiceUrl = () =>
  process.env.COMMENT_SERVICE_URL || 'http://comment-feed-follow-service:3003';
const internalApiKey = () => process.env.INTERNAL_API_KEY;

const internalHeaders = () => {
  const headers = {};
  if (internalApiKey()) {
    headers['x-internal-api-key'] = internalApiKey();
  }
  return headers;
};

const fetchJson = async (url) => {
  try {
    const res = await fetch(url, { headers: internalHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

const fallbackUser = (id) => ({
  id: id?.toString?.() ?? String(id),
  username: 'unknown',
  displayName: 'Utilisateur inconnu',
  avatarUrl: '',
});

// Resolve author ids -> Map<id, {id, username, displayName, avatarUrl}>.
const fetchUsersByIds = async (ids) => {
  const unique = [...new Set(ids.map((id) => id.toString()))];
  if (unique.length === 0) return new Map();
  // Single batched call to auth-service (no per-author HTTP fan-out).
  const users = await fetchJson(
    `${authServiceUrl()}/internal/users?ids=${encodeURIComponent(unique.join(','))}`
  );
  const byId = new Map((Array.isArray(users) ? users : []).map((u) => [u.id, u]));
  // Unresolved ids degrade to a placeholder so one missing user never breaks a render.
  return new Map(unique.map((id) => [id, byId.get(id) ?? fallbackUser(id)]));
};

const fetchUserIdByUsername = async (username) => {
  const user = await fetchJson(
    `${authServiceUrl()}/internal/users/by-username/${encodeURIComponent(username)}`
  );
  return user?.id ?? null;
};

// Batched comment counts for a set of post ids -> Map<postId, count>.
// Degrades to an empty map (counts default to 0) if comment-service is down.
const fetchCommentCounts = async (postIds) => {
  if (postIds.length === 0) return new Map();
  const ids = postIds.map((id) => id.toString()).join(',');
  const counts = await fetchJson(
    `${commentServiceUrl()}/internal/comment-counts?postIds=${encodeURIComponent(ids)}`
  );
  return new Map(Object.entries(counts ?? {}));
};

module.exports = {
  fetchUsersByIds,
  fetchUserIdByUsername,
  fetchCommentCounts,
  fallbackUser,
};
