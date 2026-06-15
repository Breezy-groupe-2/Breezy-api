FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3006

COPY package*.json ./
RUN npm install --legacy-peer-deps && npm cache clean --force

COPY . .

EXPOSE 3006

CMD ["node", "src/server.js"]
