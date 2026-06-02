import { useEffect, useRef } from 'react';

interface AgentState {
  id: string;
  name: string;
  x: number;
  y: number;
  status: 'idle' | 'walking' | 'typing' | 'reading' | 'waiting';
  intent?: string;
  reputation: number;
}

interface Props {
  agents: AgentState[];
  width?: number;
  height?: number;
}

const STATUS_COLORS: Record<string, string> = {
  idle: '#22c55e',
  walking: '#3b82f6',
  typing: '#f59e0b',
  reading: '#a855f7',
  waiting: '#ef4444',
};

const TILE = 32;
const COLS = 24;
const ROWS = 16;

function drawAgent(ctx: CanvasRenderingContext2D, agent: AgentState, frame: number) {
  const cx = agent.x * TILE + TILE / 2;
  const cy = agent.y * TILE + TILE / 2;
  const s = TILE * 0.35;
  const bob = agent.status === 'idle' ? Math.sin(frame * 0.05 + agent.x) * 2 : 0;
  const walkOff = agent.status === 'walking' ? Math.sin(frame * 0.2 + agent.x) * 3 : 0;
  const col = STATUS_COLORS[agent.status];

  const px = cx - s;
  const py = cy - s + bob + walkOff;

  // Body
  ctx.fillStyle = col;
  ctx.fillRect(px + 2, py + s * 0.3, s * 2 - 4, s * 1.2);

  // Head
  ctx.fillStyle = col;
  ctx.globalAlpha = agent.status === 'reading' ? 0.5 + Math.sin(frame * 0.1) * 0.3 : 1;
  ctx.fillRect(px + s * 0.25, py, s * 1.5, s * 0.5);
  ctx.globalAlpha = 1;

  // Eyes
  const eyeY = py + s * 0.15;
  ctx.fillStyle = '#000';
  ctx.fillRect(px + s * 0.5, eyeY, 2, 2);
  ctx.fillRect(px + s * 1.2, eyeY, 2, 2);

  // Typing hands animation
  if (agent.status === 'typing') {
    const hOff = Math.sin(frame * 0.4) * 2;
    ctx.fillStyle = col;
    ctx.fillRect(px - 2 + hOff, py + s * 0.6, 4, 2);
    ctx.fillRect(px + s * 2 - 2 - hOff, py + s * 0.6, 4, 2);
  }

  // Waiting flash
  if (agent.status === 'waiting') {
    ctx.globalAlpha = 0.4 + Math.sin(frame * 0.15) * 0.3;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - s - 4, cy - s - 4 + bob, s * 2 + 8, s * 2 + 8);
    ctx.globalAlpha = 1;
  }

  // Name
  ctx.fillStyle = '#71717a';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(agent.name.slice(0, 8), cx, cy + s + 12);

  // Reputation bar
  const barW = s * 2;
  const barH = 2;
  const barY = cy + s + 15;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(cx - barW / 2, barY, barW, barH);
  ctx.fillStyle = col;
  ctx.fillRect(cx - barW / 2, barY, barW * Math.min(agent.reputation / 100, 1), barH);

  // Speech bubble
  if (agent.intent && (agent.status === 'typing' || agent.status === 'waiting')) {
    const text = agent.intent.slice(0, 20);
    ctx.font = '8px monospace';
    const tw = ctx.measureText(text).width;
    const bx = cx - tw / 2 - 6;
    const by = cy - s - 22;
    ctx.fillStyle = '#1a1a1a';
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    roundRect(ctx, bx, by, tw + 12, 14, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText(text, cx, by + 10);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export default function AgentFloor({ agents, width = 960, height = 640 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;
    const render = () => {
      frameRef.current++;
      const w = canvas.width;
      const h = canvas.height;

      // Clear
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.02)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * TILE, 0);
        ctx.lineTo(x * TILE, h);
        ctx.stroke();
      }
      for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * TILE);
        ctx.lineTo(w, y * TILE);
        ctx.stroke();
      }

      // "Desks" - target programs
      ctx.fillStyle = 'rgba(255,255,255,0.015)';
      for (let x = 0; x < COLS; x += 4) {
        for (let y = 0; y < ROWS; y += 3) {
          ctx.fillRect(x * TILE + 2, y * TILE + 2, TILE * 3 - 4, TILE * 2 - 4);
        }
      }

      // Draw agents
      for (const agent of agentsRef.current) {
        drawAgent(ctx, agent, frameRef.current);
      }

      // Legend
      ctx.fillStyle = '#71717a';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      let lx = 8;
      for (const [k, v] of Object.entries(STATUS_COLORS)) {
        ctx.fillStyle = v;
        ctx.fillRect(lx, h - 16, 6, 6);
        ctx.fillStyle = '#52525b';
        ctx.fillText(k, lx + 10, h - 10);
        lx += 70;
      }
      ctx.fillStyle = '#3f3f46';
      ctx.textAlign = 'right';
      ctx.fillText(`agents: ${agentsRef.current.length}`, w - 8, h - 10);

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full rounded-2xl"
      style={{ background: '#000', border: '1px solid rgba(255,255,255,0.06)', cursor: 'crosshair' }}
    />
  );
}
