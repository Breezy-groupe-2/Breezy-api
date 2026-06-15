const authServiceUrl = () => process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
const followServiceUrl = () => process.env.FOLLOW_SERVICE_URL || 'http://follow-service:3006';
const postServiceUrl = () => process.env.POST_SERVICE_URL || 'http://post-service:3002';

const serviceError = (message, status = 502) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const fetchJson = async (url, { authorization } = {}) => {
  const headers = authorization ? { Authorization: authorization } : {};
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw serviceError(`Upstream service request failed: ${response.status}`, response.status);
  }
  return response.json();
};

const getFeed = async (userId, { authorization, limit = 20 } = {}) => {
  await fetchJson(`${authServiceUrl()}/api/v1/users/me`, { authorization });

  const following = await fetchJson(`${followServiceUrl()}/api/v1/users/${userId}/following`);
  if (following.length === 0) {
    return [];
  }

  const postGroups = await Promise.all(
    following.map((user) => fetchJson(`${postServiceUrl()}/api/v1/posts/user/${user.id}`))
  );

  return postGroups
    .flat()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
};

module.exports = { getFeed };
