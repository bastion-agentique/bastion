"use client";

import { useRef, useEffect } from "react";

export interface CarouselItem {
  id: number;
  title: string;
}

export function RulerCarousel({ originalItems }: { originalItems: CarouselItem[]; autoScrollInterval?: number }) {
  const trackRef = useRef<HTMLDivElement>(null);

  // Duplicate items for seamless loop
  const items = [...originalItems, ...originalItems];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let animId: number;
    let x = 0;
    const speed = 0.6;
    const halfWidth = track.scrollWidth / 2;

    function tick() {
      x -= speed;
      if (Math.abs(x) >= halfWidth) x = 0;
      track!.style.transform = `translateX(${x}px)`;
      animId = requestAnimationFrame(tick);
    }

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="w-full overflow-hidden">
      <div ref={trackRef} className="flex items-center gap-16 will-change-transform" style={{ width: "max-content" }}>
        {items.map((item, i) => (
          <div key={`${item.id}-${i}`} className="flex items-center gap-16 shrink-0">
            <span className="font-serif text-2xl text-zinc-300 whitespace-nowrap tracking-tight" style={{ fontWeight: 400 }}>
              {item.title}
            </span>
            <span className="text-zinc-700 text-lg select-none">·</span>
          </div>
        ))}
      </div>
    </div>
  );
}
