#!/bin/bash
# Copy default config.toml to working dir if not present (volume may override)
if [ ! -f /data/bastion/config.toml ]; then
    cp /etc/bastion/config.toml /data/bastion/config.toml
fi

# Start MCP server in background
export PATH="/usr/local/bin:$PATH"
BASTION_SIDECAR_URL="http://localhost:3000" /usr/local/bin/node /opt/bastion-mcp/dist/index.js &
MCP_PID=$!

# Start sidecar in foreground
exec bastion-sidecar
