FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
COPY client/package.json ./client/package.json
RUN true
COPY client ./client
RUN cd client && npm install && npm run build

FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY server/package.json ./server/package.json
RUN cd server && npm install --omit=dev
COPY server ./server
COPY --from=build /app/client/dist ./client/dist
EXPOSE 5173
CMD ["node", "server/index.js"]
