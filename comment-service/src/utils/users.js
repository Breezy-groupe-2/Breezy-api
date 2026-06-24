// Resolve author references into public user objects via the auth-service
// internal endpoint. Degrades gracefully to a placeholder on failure so a
// single bad lookup never breaks a whole comment thread.
const authServiceUrl = () => process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
const internalApiKey = () => process.env.INTERNAL_API_KEY;

const fetchJson = async (url) => {
  try {
    const headers = {};
    if (internalApiKey()) {
      headers['x-internal-api-key'] = internalApiKey();
    }
    const res = await fetch(url, { headers });
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

const toAuthor = (user) => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  avatarUrl: user.avatarUrl,
});

// Resolve author ids -> Map<id, author>.
// Single batched call to auth-service (no per-author HTTP fan-out).
const fetchAuthorsByIds = async (ids) => {
  const unique = [...new Set(ids.map((id) => id.toString()))];
  if (unique.length === 0) return new Map();
  const users = await fetchJson(
    `${authServiceUrl()}/internal/users?ids=${encodeURIComponent(unique.join(','))}`
  );
  const byId = new Map((Array.isArray(users) ? users : []).map((u) => [u.id, u]));
  return new Map(unique.map((id) => [id, toAuthor(byId.get(id) ?? fallbackUser(id))]));
};

const authorFor = (map, id) => map.get(id.toString()) ?? toAuthor(fallbackUser(id));

module.exports = { fetchAuthorsByIds, authorFor };
