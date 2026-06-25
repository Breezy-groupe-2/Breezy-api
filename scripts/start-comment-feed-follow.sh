#!/bin/sh
echo "Starting Comment, Feed, and Follow services..."

cd /app/comment-service && PORT=3003 MONGODB_URI=$COMMENT_SERVICE_MONGODB_URI AUTH_SERVICE_URL=$AUTH_SERVICE_URL node src/index.js &
cd /app/feed-service && PORT=3004 MONGODB_URI=$FEED_SERVICE_MONGODB_URI AUTH_SERVICE_URL=$AUTH_SERVICE_URL FOLLOW_SERVICE_URL=$FOLLOW_SERVICE_URL POST_SERVICE_URL=$POST_SERVICE_URL node src/server.js &
cd /app/follow-service && PORT=3006 MONGODB_URI=$FOLLOW_SERVICE_MONGODB_URI AUTH_SERVICE_URL=$AUTH_SERVICE_URL node src/server.js &

wait -n
