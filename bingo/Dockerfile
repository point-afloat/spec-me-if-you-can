FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY --from=build /app/dist ./dist
COPY public ./public
USER node
EXPOSE 3000
# COOKIE_SECRET is required at runtime and is deliberately not baked into the image.
CMD ["node", "dist/server.js"]
