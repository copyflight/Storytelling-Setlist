import React from "react";
import { Track } from "../data/tracks";

interface TrackCrateProps {
  tracks: Track[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export const TrackCrate: React.FC<TrackCrateProps> = ({ tracks, currentIndex, onSelect }) => {
  return (
    <aside
      aria-label="Tracklist"
      className="bg-plum-surface border border-gold/25 rounded-2xl p-5 sm:p-6 shadow-xl"
    >
      <div className="pb-4 mb-4 border-b border-gold/15">
        <h3 className="font-display font-black text-2xl text-cream">The Crate</h3>
        <p className="text-sm text-gold mt-1">Select a record, or use ← → arrow keys.</p>
      </div>

      <ol className="grid gap-2.5">
        {tracks.map((t, i) => {
          const isCurrent = i === currentIndex;
          const num = String(i + 1).padStart(2, "0");
          const authorShort = t.author.split("·")[0].trim();

          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={isCurrent ? "true" : "false"}
                aria-label={`Play track ${i + 1}: ${t.title}, by ${t.author}. ${t.tag}${
                  t.b2b ? ", back-to-back pair" : ""
                }. ${t.bpm} BPM.`}
                className={`w-full flex items-center gap-3.5 text-left rounded-xl px-4 py-3.5 min-h-[60px] border transition-all duration-150 ${
                  isCurrent
                    ? "bg-plum-elevated border-gold-bright shadow-[0_0_20px_rgba(229,187,113,0.18)]"
                    : "bg-plum-deep border-gold/15 hover:border-gold/55 hover:bg-plum-panel"
                }`}
              >
                <span className="font-mono font-bold text-base text-gold-bright tabular-nums shrink-0 w-7">
                  {num}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-base text-cream leading-snug truncate">
                    {t.title}
                  </span>
                  <span className="block text-sm text-gold/90 leading-snug truncate mt-0.5 tabular-nums">
                    {authorShort} · {t.bpm} BPM
                  </span>
                </span>
                <span
                  className={`font-mono text-xs font-bold tracking-[0.1em] shrink-0 whitespace-nowrap ${
                    t.b2b || t.tag === "HIT" ? "text-gold-bright" : "text-cream/75"
                  }`}
                >
                  {t.b2b ? "B2B" : t.tag}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
};
