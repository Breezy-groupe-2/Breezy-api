#!/bin/sh
echo "Starting Auth and Profile services..."

cd /app/auth-service && PORT=3001 MONGODB_URI=$AUTH_SERVICE_MONGODB_URI node src/server.js &
cd /app/profile-service && PORT=3007 MONGODB_URI=$PROFILE_SERVICE_MONGODB_URI AUTH_SERVICE_URL=$AUTH_SERVICE_URL node src/server.js &

wait -n
