const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
const POST_SERVICE_URL = process.env.POST_SERVICE_URL || 'http://post-service:3002';

const getFeed = async (userId, authHeader, { limit = 20 } = {}) => {
  const followRes = await fetch(`${AUTH_SERVICE_URL}/api/v1/auth/${userId}/following`);
  if (!followRes.ok) {
    const err = new Error('Failed to retrieve following list');
    err.status = followRes.status;
    throw err;
  }
  const following = await followRes.json();

  if (!following.length) return [];

  const authorIds = following.map((u) => u.id).join(',');
  const postsRes = await fetch(
    `${POST_SERVICE_URL}/api/v1/posts/feed?authorIds=${authorIds}&limit=${limit}`,
    { headers: { Authorization: authHeader } },
  );
  if (!postsRes.ok) {
    const err = new Error('Failed to retrieve posts');
    err.status = postsRes.status;
    throw err;
  }
  return postsRes.json();
};

module.exports = { getFeed };
