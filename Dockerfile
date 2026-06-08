# Build stage
FROM rust:1.87-slim-bookworm AS builder

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
COPY apps/web/public/ apps/web/public/

RUN cargo build --release -p bastion-sidecar && \
    cp target/release/bastion-sidecar /bastion-sidecar

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /bastion-sidecar /usr/local/bin/bastion-sidecar
COPY config.toml /etc/bastion/config.toml
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV HELIUS_API_KEY=""
ENV SOLANA_RPC_URL="https://api.devnet.solana.com"
ENV BASTION_AGENT_STORE_PATH="/data/bastion/agent_store"

EXPOSE 3000

VOLUME ["/data/bastion/audit_logs", "/data/bastion/keys"]

WORKDIR /data/bastion
CMD ["/entrypoint.sh"]
