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

const getFeed = async (userId, { limit = 20 } = {}) => {
  const followingResponse = await fetchJson(`${followServiceUrl()}/api/v1/users/${userId}/following`);
  const following = Array.isArray(followingResponse) ? followingResponse : followingResponse.data || [];
  if (following.length === 0) {
    return [];
  }

  const authorIds = following.map((user) => user.id).join(',');
  const postsResponse = await fetchJson(`${postServiceUrl()}/api/v1/posts?authorIds=${authorIds}&limit=${limit}`);
  const posts = Array.isArray(postsResponse) ? postsResponse : postsResponse.data || [];

  return posts
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
};

module.exports = { getFeed };
