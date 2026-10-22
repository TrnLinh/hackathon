"use client";

import { Mic } from "lucide-react";
import { MemoryThumb } from "@/components/chorus/memory-thumb";
import { useSampleFor } from "@/lib/sample-media";
import { cn } from "@/lib/utils";
import type { Memory } from "@/features/prototype/types";

/**
 * Large preview of a memory. Plays the real file from public/sample-db when the
 * demo has one, and falls back to the synthetic thumbnail otherwise.
 * The parent sets the size (for example `aspect-[4/3]`).
 */
export function MediaPreview({
  memory,
  className,
}: {
  memory: Memory;
  className?: string;
}) {
  const sample = useSampleFor(memory.id);

  if (memory.kind === "video" && sample?.video) {
    return (
      <video
        key={sample.video}
        src={sample.video}
        poster={sample.poster ?? sample.image}
        controls
        playsInline
        preload="metadata"
        aria-label={memory.title}
        className={cn("w-full bg-black object-cover", className)}
      />
    );
  }

  if (memory.kind === "voice" && sample?.audio) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-4 bg-secondary p-6",
          className,
        )}
      >
        <span className="grid size-16 place-items-center rounded-full bg-lime text-lime-ink shadow-soft">
          <Mic className="size-7" aria-hidden="true" />
        </span>
        <audio
          key={sample.audio}
          src={sample.audio}
          controls
          preload="metadata"
          aria-label={memory.title}
          className="w-full max-w-sm"
        />
      </div>
    );
  }

  if (memory.kind === "photo" && (sample?.image || sample?.poster)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={sample.image ?? sample.poster}
        alt={memory.title}
        className={cn("w-full object-cover", className)}
      />
    );
  }

  return <MemoryThumb memory={memory} className={className} />;
}
