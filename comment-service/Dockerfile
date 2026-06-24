FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3003

COPY package*.json ./
RUN npm install --legacy-peer-deps && npm cache clean --force

COPY . .

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 3003

CMD ["node", "src/server.js"]
