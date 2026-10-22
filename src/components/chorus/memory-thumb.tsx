import { FileText, Image as ImageIcon, Mic, Play, Video } from "lucide-react";
import { useSceneImage } from "@/lib/sample-media";
import { cn } from "@/lib/utils";
import type { Artwork, Memory, MemoryKind } from "@/features/prototype/types";

// Synthetic placeholder art. Real builds show protected, decrypted previews
// only to members with a current review or release grant.

export const kindMeta: Record<
  MemoryKind,
  { label: string; icon: typeof ImageIcon }
> = {
  photo: { label: "Photo", icon: ImageIcon },
  voice: { label: "Voice note", icon: Mic },
  video: { label: "Video", icon: Video },
  text: { label: "Story", icon: FileText },
};

export function ArtworkFill({
  art,
  className,
  showScene = true,
}: {
  art: Artwork;
  className?: string;
  showScene?: boolean;
}) {
  const photo = useSceneImage(art.scene);
  if (photo) {
    return (
      <div
        role="img"
        aria-label={art.scene}
        className={cn("relative overflow-hidden bg-muted", className)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={`Placeholder image: ${art.scene}`}
      className={cn("relative overflow-hidden", className)}
      style={{ background: `linear-gradient(135deg, ${art.from}, ${art.to})` }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-30 mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 70%, rgba(255,255,255,.6), transparent 40%), radial-gradient(circle at 75% 25%, rgba(0,0,0,.35), transparent 45%)",
        }}
      />
      {showScene && (
        <span className="absolute bottom-1.5 left-2 text-[10px] font-medium tracking-wide text-white/85 drop-shadow">
          {art.scene}
        </span>
      )}
    </div>
  );
}

function Waveform({ seed }: { seed: string }) {
  const bars = Array.from({ length: 28 }, (_, i) => {
    const c = seed.charCodeAt(i % seed.length) ?? 60;
    return 20 + ((c * (i + 3)) % 70);
  });
  return (
    <div aria-hidden="true" className="flex h-10 items-center gap-[3px]">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-primary/60"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

export function MemoryThumb({
  memory,
  className,
}: {
  memory: Memory;
  className?: string;
}) {
  const Icon = kindMeta[memory.kind].icon;
  if (memory.kind === "text")
    return (
      <div
        className={cn(
          "relative flex flex-col justify-between overflow-hidden bg-[#fbf6ea] p-3",
          className,
        )}
      >
        <p className="line-clamp-4 font-serif text-[13px] leading-snug text-[#4a3d30] italic">
          “{memory.story}”
        </p>
        <Icon className="size-4 text-[#9a8466]" aria-hidden="true" />
      </div>
    );
  if (memory.kind === "voice")
    return (
      <div
        className={cn(
          "relative flex flex-col justify-center gap-2 overflow-hidden bg-secondary px-4",
          className,
        )}
      >
        <Waveform seed={memory.id + memory.title} />
        <span className="inline-flex items-center gap-1.5 text-xs text-secondary-foreground">
          <Mic className="size-3.5" aria-hidden="true" />
          {memory.media?.durationSec
            ? `${memory.media.durationSec}s voice note`
            : "Voice note"}
        </span>
      </div>
    );
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {memory.art ? (
        <ArtworkFill art={memory.art} className="absolute inset-0" />
      ) : (
        <div className="absolute inset-0 bg-muted" />
      )}
      {memory.kind === "video" && (
        <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
          <Play className="size-3" aria-hidden="true" />
          {memory.media?.durationSec
            ? `0:${String(memory.media.durationSec).padStart(2, "0")}`
            : "Video"}
        </span>
      )}
    </div>
  );
}
