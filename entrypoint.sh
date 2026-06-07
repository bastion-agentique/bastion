#!/bin/sh
# Copy default config.toml to working dir if not present (volume may override)
if [ ! -f /data/bastion/config.toml ]; then
    cp /etc/bastion/config.toml /data/bastion/config.toml
fi
exec bastion-sidecar
