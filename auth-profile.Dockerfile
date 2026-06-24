FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy package configurations
COPY auth-service/package*.json ./auth-service/
COPY profile-service/package*.json ./profile-service/

# Install dependencies for each service
RUN cd auth-service && npm install --legacy-peer-deps --ignore-scripts && npm cache clean --force
RUN cd profile-service && npm install --legacy-peer-deps --ignore-scripts && npm cache clean --force

# Copy service source code
COPY auth-service ./auth-service
COPY profile-service ./profile-service

# Copy the start script
COPY scripts/start-auth-profile.sh ./start.sh
RUN sed -i 's/\r$//' ./start.sh && chmod +x ./start.sh

EXPOSE 3001 3007

CMD ["./start.sh"]
