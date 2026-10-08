ARG NODE_IMAGE
FROM ${NODE_IMAGE}
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY dist ./dist
USER node
CMD ["node", "dist/gateway/sidecar.js"]
