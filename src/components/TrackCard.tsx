import React from "react";
import { ArrowUpRight } from "lucide-react";
import { Track } from "../data/tracks";

interface TrackCardProps {
  track: Track;
  index: number;
}

export const TrackCard: React.FC<TrackCardProps> = ({ track, index }) => {
  const num = String(index + 1).padStart(2, "0");
  const energyPct = Math.round(((track.bpm - 60) / 120) * 100);

  return (
    <article
      key={index}
      aria-label="Current track card"
      className="bg-plum-surface border border-gold/25 rounded-2xl p-6 sm:p-8 lg:p-10 shadow-xl"
    >
      {/* Marlowe's spoken intro */}
      <p className="font-display italic text-lg sm:text-xl leading-relaxed text-cream/95 pb-6 mb-6 border-b border-gold/20">
        “{track.intro}”
      </p>

      {/* Quiet unboxed metadata line */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-xs sm:text-sm tracking-[0.14em] uppercase text-gold mb-3 tabular-nums">
        <span>Track {num}</span>
        <span aria-hidden="true">·</span>
        <span>{track.slot}</span>
        <span aria-hidden="true">·</span>
        <span className={track.tag === "HIT" ? "text-gold-bright font-bold" : "text-cream/85"}>
          {track.tag}
        </span>
        {track.b2b && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-gold-bright font-bold">Back-to-Back</span>
          </>
        )}
      </div>

      {/* Primary Track Title */}
      <h3 className="font-display font-black text-3xl sm:text-4xl leading-[1.08] text-cream text-balance mb-2">
        {track.title}
      </h3>
      <p className="italic text-lg text-cream/85 mb-6">{track.real}</p>

      {/* Clean Attribution Grid */}
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-y border-gold/15 mb-6 text-base">
        <div>
          <dt className="font-mono text-xs uppercase tracking-[0.12em] text-gold mb-0.5">Author</dt>
          <dd className="text-cream font-medium">{track.author}</dd>
        </div>
        <div>
          <dt className="font-mono text-xs uppercase tracking-[0.12em] text-gold mb-0.5">
            Publication
          </dt>
          <dd className="text-cream font-medium">{track.pub}</dd>
        </div>
        <div>
          <dt className="font-mono text-xs uppercase tracking-[0.12em] text-gold mb-0.5">
            Published
          </dt>
          <dd className="text-cream font-medium">
            {track.date}
            {track.verify && (
              <span className="ml-2 font-mono text-xs border border-dashed border-warn text-warn px-1.5 py-0.5 rounded">
                [VERIFY]
              </span>
            )}
          </dd>
        </div>
      </dl>

      {/* Energy & BPM Meter */}
      <div className="mb-7">
        <div className="flex items-center justify-between font-mono text-sm tracking-[0.12em] text-gold mb-2 tabular-nums">
          <span>ENERGY {track.energy} / 10</span>
          <span>{track.bpm} BPM</span>
        </div>
        <div className="h-3 bg-plum-room rounded-full overflow-hidden border border-gold/20">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              track.slot === "PEAK"
                ? "bg-gradient-to-r from-gold via-warn to-gold-bright shadow-[0_0_14px_rgba(232,163,61,0.75)]"
                : "bg-gradient-to-r from-gold to-gold-bright"
            }`}
            style={{ width: `${energyPct}%` }}
          />
        </div>
      </div>

      {/* Featured Pull Quote */}
      <blockquote className="mb-7">
        <p className="font-display font-semibold text-2xl sm:text-3xl leading-[1.3] text-cream mb-2">
          <span className="text-gold-bright">“</span>
          {track.hook}
          <span className="text-gold-bright">”</span>
        </p>
        <footer className="text-base text-gold">— {track.hookby}</footer>
      </blockquote>

      {/* Back-to-Back Note (if applicable) */}
      {track.b2bnote && (
        <div className="bg-plum-deep border border-gold/40 rounded-xl px-5 py-4 mb-6 text-base text-cream/95">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-gold-bright block mb-1">
            {track.b2bnote.label}
          </span>
          <p>{track.b2bnote.text}</p>
        </div>
      )}

      {/* Why it's in the set */}
      <p className="text-lg text-cream/95 leading-relaxed mb-7">
        <strong className="text-gold font-bold">Why it’s in the set:</strong> {track.why}
      </p>

      {/* Source Link */}
      <a
        href={track.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 font-bold text-lg text-gold-bright hover:text-cream underline underline-offset-4 decoration-2 transition-colors"
      >
        <span>Read the original</span>
        <ArrowUpRight className="w-5 h-5" aria-hidden="true" />
      </a>
    </article>
  );
};
