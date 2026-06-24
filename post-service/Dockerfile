FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002

COPY shared ./shared
COPY post-service/package*.json ./
RUN npm install --legacy-peer-deps && npm cache clean --force

COPY post-service ./post-service

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 3002

CMD ["node", "src/server.js"]
