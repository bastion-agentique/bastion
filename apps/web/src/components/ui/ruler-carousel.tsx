"use client";

export interface CarouselItem {
  id: number;
  title: string;
}

export function RulerCarousel({ originalItems }: { originalItems: CarouselItem[]; autoScrollInterval?: number }) {
  // Repeat 4× so the seamless loop never shows a gap at any viewport width
  const repeated = [...originalItems, ...originalItems, ...originalItems, ...originalItems];

  return (
    <>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .marquee-track {
          animation: marquee 20s linear infinite;
          will-change: transform;
        }
      `}</style>
      <div className="w-full overflow-hidden">
        <div className="marquee-track flex items-center" style={{ width: "max-content" }}>
          {repeated.map((item, i) => (
            <div key={`${item.id}-${i}`} className="flex items-center shrink-0 px-8">
              <span className="font-serif text-2xl text-zinc-300 whitespace-nowrap tracking-tight" style={{ fontWeight: 400 }}>
                {item.title}
              </span>
              <span className="ml-8 text-zinc-700 text-lg select-none">·</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
