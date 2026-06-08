# Bastion Robot Fleet Firewall

> Physical agent firewall for autonomous robots and IoT fleets on Solana.

## Overview

Every robot in a fleet registers with Bastion, receiving a W3C DID (`did:bastion:solana:{pda}`) and a per-robot security policy. All actuator commands (move, charge, dock) pass through the firewall for simulation and policy checks before physical execution. Every action is audit-logged on-chain for accountability.

## Architecture

```
Robot Fleet
├── Drone Alpha    → DID: alice... → policy: geofence, speed 5m/s, battery 20% floor
├── Rover Beta     → DID: bob...   → policy: open 6am-10pm, 500J/hr energy budget
└── AGV Gamma      → DID: charlie.. → policy: warehouse-only, max payload 50kg
        │
        ▼
Bastion Sidecar (port 3000)
  ├── Agent Registry (TrackedAgent with device_type, firmware, location)
  ├── Policy Engine (Geofence, SpeedLimit, EnergyBudget, OperatingHours)
  ├── Robot Telemetry (POST /robots/:did/telemetry)
  └── MCP Server (bastion_register_robot, bastion_robot_telemetry)
```

## Robot Identity

Each robot agent extends `TrackedAgent` with physical device fields:

| Field | Type | Description |
|-------|------|-------------|
| `device_type` | `Option<String>` | Physical device type: "drone", "rover", "industrial_arm", "agv", "marine", "custom" |
| `firmware_version` | `Option<String>` | Current firmware version (e.g. "v1.4.2", commit sha) |
| `last_known_location` | `Option<(f64, f64)>` | Last GPS coordinates [latitude, longitude] |

## Physical Action Types

Extends the `TxType` enum with robot-specific actions:

| Type | Description | Example |
|------|-------------|---------|
| `Actuate` | Direct actuator control | Open valve, move motor, trigger relay |
| `SensorRead` | Read sensor data | Temperature, IMU, GPS, battery, camera |
| `Navigate` | Physical navigation | Move to [lat,lon], return to base, dock |
| `Charge` | Robot charging | Initiate charge, report energy level |
| `FirmwareUpdate` | Push signed firmware bundle | Update robot firmware to new version |

## Robot-Specific Policy Rules

| Rule | Description | Example |
|------|-------------|---------|
| `Geofence` | Restrict operation to a geographic bounding box | `lat: -6.2 to -6.1, lon: 106.8 to 106.9` |
| `SpeedLimit` | Maximum speed in meters/second | `5.0 m/s` for warehouse robots |
| `EnergyBudget` | Maximum energy (Joules) per 24h window | `1,000,000 J/day` |
| `OperatingHours` | Restrict operations to UTC hours | `6:00-22:00 UTC` |

## Telemetry Ingestion

Robots submit telemetry via `POST /robots/:did/telemetry`:

```bash
curl -X POST https://bastion-agentique.fly.dev//robots/did:bastion:solana:robot-pda/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "location": [-6.2, 106.8],
    "battery_level": 85,
    "firmware_version": "v1.4.2"
  }'
```

Telemetry creates a `SecurityEvent` with `source: "robot-telemetry"` and `classification: "physical"`, ingested into the audit trail.

## MCP Tools

| Tool | Description |
|------|-------------|
| `bastion_register_robot` | Register a physical robot as a Bastion agent with DID + device metadata |
| `bastion_robot_telemetry` | Submit telemetry (battery, GPS, firmware) for a registered robot |

## Fleet Delegation

Robots in a fleet can be organized hierarchically:

```
Fleet Operator (parent agent, stakes SOL)
  ├── Drone Squadron A (child, depth 1)
  │   ├── Drone A1 (child, depth 2, 50% stake weight)
  │   └── Drone A2 (child, depth 2)
  └── Rover Group B (child, depth 1)
```

Each child inherits a capability subset and budget cap from the parent.

## Capability Bitmask

New bits for physical agents:

| Bit | Value | Capability |
|-----|-------|-----------|
| 7 | `1 << 7` | `ACTUATE` — physical actuator control |
| 8 | `1 << 8` | `NAVIGATE` — autonomous movement |
| 9 | `1 << 9` | `CHARGE` — initiate charging |
| 10 | `1 << 10` | `DOCK` — dock/undock operations |
