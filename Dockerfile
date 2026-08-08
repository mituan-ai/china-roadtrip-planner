FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
LABEL org.opencontainers.image.source="https://github.com/mituan-ai/china-roadtrip-planner"
LABEL org.opencontainers.image.description="中国自驾路线规划器"
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S -D -H -G app app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER app
EXPOSE 3000
CMD ["node", "dist/server/server/index.js"]
