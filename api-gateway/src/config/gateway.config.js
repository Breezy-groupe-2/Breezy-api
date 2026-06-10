// API Gateway configuration
module.exports = {
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  postServiceUrl: process.env.POST_SERVICE_URL || 'http://post-service:3002',
  commentServiceUrl: process.env.COMMENT_SERVICE_URL || 'http://comment-service:3003',
  feedServiceUrl: process.env.FEED_SERVICE_URL || 'http://feed-service:3004',
};
