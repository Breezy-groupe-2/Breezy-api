FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3007

COPY package*.json ./
RUN npm install --legacy-peer-deps && npm cache clean --force

COPY . .

EXPOSE 3007

CMD ["node", "src/server.js"]
