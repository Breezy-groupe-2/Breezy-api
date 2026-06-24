FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy package configurations
COPY comment-service/package*.json ./comment-service/
COPY feed-service/package*.json ./feed-service/
COPY follow-service/package*.json ./follow-service/

# Install dependencies for each service
RUN cd comment-service && npm install --legacy-peer-deps --ignore-scripts && npm cache clean --force
RUN cd feed-service && npm install --legacy-peer-deps --ignore-scripts && npm cache clean --force
RUN cd follow-service && npm install --legacy-peer-deps --ignore-scripts && npm cache clean --force

# Copy shared modules
COPY shared ./shared

# Copy service source code
COPY comment-service ./comment-service
COPY feed-service ./feed-service
COPY follow-service ./follow-service

# Copy the start script
COPY scripts/start-comment-feed-follow.sh ./start.sh
RUN sed -i 's/\r$//' ./start.sh && chmod +x ./start.sh

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 3003 3004 3006

CMD ["./start.sh"]
