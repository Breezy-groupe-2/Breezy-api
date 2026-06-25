FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002

COPY package*.json ./
RUN npm install --legacy-peer-deps && npm cache clean --force

COPY . .

EXPOSE 3002

CMD ["node", "src/server.js"]
