FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy source code first
COPY auth-service ./auth-service
COPY profile-service ./profile-service
COPY shared ./shared

# Install dependencies for each service
RUN cd auth-service && npm install --legacy-peer-deps --ignore-scripts && npm cache clean --force
RUN cd profile-service && npm install --legacy-peer-deps --ignore-scripts && npm cache clean --force
RUN cd shared && npm install --legacy-peer-deps --ignore-scripts && npm cache clean --force

# Copy the start script
COPY scripts/start-auth-profile.sh ./start.sh
RUN sed -i 's/\r$//' ./start.sh && chmod +x ./start.sh

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 3001 3007

CMD ["./start.sh"]
