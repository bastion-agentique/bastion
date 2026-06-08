# Build stage — Rust sidecar
FROM rust:1.87-slim-bookworm AS rust-builder

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
COPY apps/web/public/ apps/web/public/

RUN cargo build --release -p bastion-sidecar && \
    cp target/release/bastion-sidecar /bastion-sidecar

# Build stage — Node.js MCP server
FROM node:20-slim AS mcp-builder

WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/mcp-server/ packages/mcp-server/

RUN corepack enable && corepack prepare pnpm@9 --activate && \
    pnpm install --frozen-lockfile && \
    pnpm --filter @bastion/mcp-server build

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=rust-builder /bastion-sidecar /usr/local/bin/bastion-sidecar
COPY --from=mcp-builder /app/packages/mcp-server/dist /opt/bastion-mcp/dist
COPY --from=mcp-builder /app/packages/mcp-server/package.json /opt/bastion-mcp/package.json
COPY config.toml /etc/bastion/config.toml
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV HELIUS_API_KEY=""
ENV SOLANA_RPC_URL="https://api.devnet.solana.com"
ENV BASTION_AGENT_STORE_PATH="/data/bastion/agent_store"

EXPOSE 3000 3001

VOLUME ["/data/bastion/audit_logs", "/data/bastion/keys"]

WORKDIR /data/bastion
CMD ["/entrypoint.sh"]
