#!/bin/bash
# Copy default config.toml to working dir if not present (volume may override)
if [ ! -f /data/bastion/config.toml ]; then
    cp /etc/bastion/config.toml /data/bastion/config.toml
fi

# Start MCP server in background
export PATH="/usr/local/bin:$PATH"
echo "[entrypoint] Starting MCP server on port 3001..."
BASTION_SIDECAR_URL="http://localhost:3000" /usr/local/bin/node /opt/bastion-mcp/dist/http.js > /tmp/mcp.log 2>&1 &
MCP_PID=$!
echo "[entrypoint] MCP PID: $MCP_PID"
sleep 2
cat /tmp/mcp.log

# Start sidecar in foreground
echo "[entrypoint] Starting sidecar..."
exec bastion-sidecar
