#!/bin/sh
echo "Starting Auth service..."

cd /app/auth-service && PORT=3001 MONGODB_URI=$AUTH_SERVICE_MONGODB_URI node src/server.js
