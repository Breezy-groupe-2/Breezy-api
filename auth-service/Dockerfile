FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm install --legacy-peer-deps --ignore-scripts && npm cache clean --force

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
