FROM node:22.13.1-alpine AS build

RUN corepack enable
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @agentflow/api... build

FROM node:22.13.1-alpine AS runtime

RUN corepack enable
WORKDIR /workspace
COPY --from=build /workspace /workspace
ENV NODE_ENV=production
EXPOSE 4000
CMD ["pnpm", "--filter", "@agentflow/api", "start"]
