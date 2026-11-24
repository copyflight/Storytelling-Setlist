import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Pause, Play, Share2 } from "lucide-react";
import { BoothStage, HostFit } from "./components/BoothStage";
import { MarloweArt } from "./components/MarloweArt";
import { SetBuilderModal } from "./components/SetBuilderModal";
import { StudioDock } from "./components/StudioDock";
import { TrackCard } from "./components/TrackCard";
import { TrackCrate } from "./components/TrackCrate";
import {
  COPYFLIGHT_DEFAULT_SET,
  DjPersonaId,
  INDUSTRY_BLUEPRINT_STARTER,
  SetTemplate,
  cloneSetTemplate,
  getBrandTheme,
  getPersonaById,
} from "./data/setTemplates";
import { AudioState, audioEngine } from "./lib/audioEngine";
import { LS } from "./lib/storage";
import { BoothSettings } from "./three/boothScene";

const DEFAULT_BOOTH_SETTINGS: BoothSettings = {
  glow: 1.0,
  haze: 0.044,
  spin: 1.0,
  pulse: true,
  orbit: 0,
  zoom: 8.4,
};

const DEFAULT_HOST_FIT: HostFit = {
  scale: 1,
  x: 0,
  y: 0,
};

function loadInitialSets(): SetTemplate[] {
  try {
    const raw = LS.get("setTemplates");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as SetTemplate[];
      }
    }
  } catch {
    // Ignore storage parse error
  }
  return [
    cloneSetTemplate(COPYFLIGHT_DEFAULT_SET, {
      id: COPYFLIGHT_DEFAULT_SET.id,
      name: COPYFLIGHT_DEFAULT_SET.name,
      industry: COPYFLIGHT_DEFAULT_SET.industry,
    }),
    cloneSetTemplate(INDUSTRY_BLUEPRINT_STARTER, {
      id: INDUSTRY_BLUEPRINT_STARTER.id,
      name: INDUSTRY_BLUEPRINT_STARTER.name,
      industry: INDUSTRY_BLUEPRINT_STARTER.industry,
    }),
  ];
}

export default function App() {
  const [sets, setSets] = useState<SetTemplate[]>(loadInitialSets);
  const [activeSetId, setActiveSetId] = useState<string>(
    () => LS.get("activeSetId") || COPYFLIGHT_DEFAULT_SET.id
  );
  const [builderOpen, setBuilderOpen] = useState(false);

  const activeSet = useMemo(
    () => sets.find((s) => s.id === activeSetId) || sets[0] || COPYFLIGHT_DEFAULT_SET,
    [sets, activeSetId]
  );
  const activePersona = useMemo(
    () => getPersonaById(activeSet.personaId),
    [activeSet.personaId]
  );
  const activeTheme = useMemo(
    () =>
      getBrandTheme(
        activeSet.brand.themePresetId,
        activeSet.brand.customAccentHex,
        activeSet.brand.customBgHex
      ),
    [
      activeSet.brand.themePresetId,
      activeSet.brand.customAccentHex,
      activeSet.brand.customBgHex,
    ]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  const [audioState, setAudioState] = useState<AudioState>(() => audioEngine.getState());
  const [customHostImage, setCustomHostImage] = useState<string | null>(() =>
    LS.get("marloweImg")
  );
  const [hostFit, setHostFit] = useState<HostFit>(() => {
    try {
      const parsed = JSON.parse(LS.get("hostFit") || "null");
      if (parsed && typeof parsed.scale === "number") return parsed as HostFit;
    } catch {
      // Ignore parse error
    }
    return DEFAULT_HOST_FIT;
  });

  const [boothSettings, setBoothSettings] = useState<BoothSettings>(DEFAULT_BOOTH_SETTINGS);
  const [crossfadeText, setCrossfadeText] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const crossfadeTimerRef = useRef<number | null>(null);
  const shareTimerRef = useRef<number | null>(null);

  const safeIndex = Math.max(0, Math.min(currentIndex, Math.max(0, activeSet.tracks.length - 1)));
  const currentTrack = activeSet.tracks[safeIndex] || activeSet.tracks[0];

  // Persist sets & active set ID
  useEffect(() => {
    LS.set("setTemplates", JSON.stringify(sets));
  }, [sets]);

  useEffect(() => {
    LS.set("activeSetId", activeSet.id);
  }, [activeSet.id]);

  // Apply active brand theme CSS variables & page title
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement.style;
    root.setProperty("--color-plum-room", activeTheme.room);
    root.setProperty("--color-plum-deep", activeTheme.deep);
    root.setProperty("--color-plum-surface", activeTheme.surface);
    root.setProperty("--color-plum-panel", activeTheme.panel);
    root.setProperty("--color-plum-elevated", activeTheme.elevated);
    root.setProperty("--color-gold", activeTheme.accent);
    root.setProperty("--color-gold-bright", activeTheme.accentBright);
    root.setProperty("--color-ink", activeTheme.ink);
    root.setProperty("--color-cream", activeTheme.cream);

    document.title = `${activeSet.brand.setTitleLead} ${activeSet.brand.setTitleAccent} · ${activeSet.brand.companyName}`;
  }, [activeTheme, activeSet.brand]);

  // Initialize audio engine & reduced-motion listener
  useEffect(() => {
    audioEngine.init();
    const unsubscribe = audioEngine.subscribe(setAudioState);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMqChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", onMqChange);

    return () => {
      unsubscribe();
      mq.removeEventListener?.("change", onMqChange);
      if (crossfadeTimerRef.current !== null) {
        window.clearTimeout(crossfadeTimerRef.current);
      }
      if (shareTimerRef.current !== null) {
        window.clearTimeout(shareTimerRef.current);
      }
    };
  }, []);

  // Clamp index if track list shrinks
  useEffect(() => {
    if (currentIndex >= activeSet.tracks.length && activeSet.tracks.length > 0) {
      setCurrentIndex(activeSet.tracks.length - 1);
    }
  }, [currentIndex, activeSet.tracks.length]);

  // Sync BPM, slot groove & playback state to audio engine
  useEffect(() => {
    if (!currentTrack) return;
    audioEngine.setTrackProfile(currentTrack.bpm, currentTrack.slot);
  }, [currentTrack]);

  useEffect(() => {
    audioEngine.setPlayback(playing, soundOn);
  }, [playing, soundOn]);

  const showCrossfade = useCallback((text: string) => {
    setCrossfadeText(text);
    if (crossfadeTimerRef.current !== null) {
      window.clearTimeout(crossfadeTimerRef.current);
    }
    crossfadeTimerRef.current = window.setTimeout(() => {
      setCrossfadeText(null);
    }, 3400);
  }, []);

  const selectTrack = useCallback(
    (nextIndex: number, showTransition: boolean, autoPlay = true) => {
      const track = activeSet.tracks[nextIndex];
      if (!track) return;
      setCurrentIndex(nextIndex);
      if (showTransition && track.transition) {
        showCrossfade(track.transition);
      } else {
        setCrossfadeText(null);
      }
      if (autoPlay) setPlaying(true);
    },
    [activeSet.tracks, showCrossfade]
  );

  const goNext = useCallback(() => {
    if (activeSet.tracks.length === 0) return;
    const nextIdx = (safeIndex + 1) % activeSet.tracks.length;
    selectTrack(nextIdx, true, true);
  }, [safeIndex, activeSet.tracks.length, selectTrack]);

  const goPrev = useCallback(() => {
    if (activeSet.tracks.length === 0) return;
    const prevIdx = (safeIndex - 1 + activeSet.tracks.length) % activeSet.tracks.length;
    selectTrack(prevIdx, false, true);
  }, [safeIndex, activeSet.tracks.length, selectTrack]);

  // Keyboard navigation (← / →)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (builderOpen) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.matches("input, textarea, select") ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [builderOpen, goNext, goPrev]);

  const handleDropNeedle = () => {
    const boothEl = document.getElementById("booth");
    boothEl?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
    selectTrack(0, false, true);
    setSoundOn(true);
  };

  const handleHostFitChange = (next: HostFit) => {
    setHostFit(next);
    LS.set("hostFit", JSON.stringify(next));
  };

  const handleUploadHostImage = (dataUrl: string) => {
    setCustomHostImage(dataUrl);
    LS.set("marloweImg", dataUrl);
  };

  const handleResetHost = () => {
    setCustomHostImage(null);
    setHostFit(DEFAULT_HOST_FIT);
    LS.del("marloweImg");
    LS.del("hostFit");
  };

  const handleRandomizeBooth = () => {
    setBoothSettings((prev) => ({
      ...prev,
      glow: Number((0.65 + Math.random() * 1.15).toFixed(2)),
      haze: Number((Math.random() * 0.075).toFixed(3)),
      spin: Number((0.55 + Math.random() * 1.35).toFixed(2)),
      orbit: Number(((Math.random() * 76 - 38) / 100).toFixed(2)),
    }));
  };

  const handleUpdateActiveSet = useCallback(
    (updater: (prev: SetTemplate) => SetTemplate) => {
      setSets((prevSets) =>
        prevSets.map((s) => (s.id === activeSet.id ? updater(s) : s))
      );
    },
    [activeSet.id]
  );

  const handleSelectPersona = useCallback(
    (personaId: DjPersonaId) => {
      const nextPersona = getPersonaById(personaId);
      const prevPersona = getPersonaById(activeSet.personaId);
      setCustomHostImage(null);
      LS.del("marloweImg");
      handleUpdateActiveSet((prev) => ({
        ...prev,
        personaId,
        hostWelcome:
          prev.hostWelcome.trim() === prevPersona.defaultWelcome.trim()
            ? nextPersona.defaultWelcome
            : prev.hostWelcome,
        hostSignOff:
          prev.hostSignOff.trim() === prevPersona.defaultSignOff.trim()
            ? nextPersona.defaultSignOff
            : prev.hostSignOff,
        updatedAt: new Date().toISOString(),
      }));
    },
    [activeSet.personaId, handleUpdateActiveSet]
  );

  const handleSelectSet = (setId: string) => {
    setActiveSetId(setId);
    setCurrentIndex(0);
    setCrossfadeText(null);
  };

  const handleDuplicateSet = (newName: string, newIndustry: string) => {
    const cloned = cloneSetTemplate(activeSet, {
      name: newName,
      industry: newIndustry,
    });
    setSets((prev) => [...prev, cloned]);
    setActiveSetId(cloned.id);
    setCurrentIndex(0);
    setCrossfadeText(null);
  };

  const handleCreateStarterSet = () => {
    const starter = cloneSetTemplate(INDUSTRY_BLUEPRINT_STARTER, {
      name: `Industry Set · ${new Date().toLocaleDateString()}`,
    });
    setSets((prev) => [...prev, starter]);
    setActiveSetId(starter.id);
    setCurrentIndex(0);
    setCrossfadeText(null);
  };

  const handleDeleteSet = (setId: string) => {
    if (sets.length <= 1) return;
    const remaining = sets.filter((s) => s.id !== setId);
    setSets(remaining);
    if (activeSetId === setId && remaining[0]) {
      setActiveSetId(remaining[0].id);
      setCurrentIndex(0);
    }
  };

  const handleImportSet = (imported: SetTemplate) => {
    setSets((prev) => [...prev, imported]);
    setActiveSetId(imported.id);
    setCurrentIndex(0);
    setCrossfadeText(null);
  };

  const handleResetDefaultSet = () => {
    const freshDefault = cloneSetTemplate(COPYFLIGHT_DEFAULT_SET, {
      id: COPYFLIGHT_DEFAULT_SET.id,
      name: COPYFLIGHT_DEFAULT_SET.name,
      industry: COPYFLIGHT_DEFAULT_SET.industry,
    });
    setSets((prev) => {
      const exists = prev.some((s) => s.id === COPYFLIGHT_DEFAULT_SET.id);
      return exists
        ? prev.map((s) => (s.id === COPYFLIGHT_DEFAULT_SET.id ? freshDefault : s))
        : [freshDefault, ...prev];
    });
    setActiveSetId(COPYFLIGHT_DEFAULT_SET.id);
    setCurrentIndex(0);
    setCrossfadeText(null);
  };

  const handleShareSet = async () => {
    const shareUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}`
        : activeSet.brand.ctaUrl;
    const fullTitle = `${activeSet.brand.setTitleLead} ${activeSet.brand.setTitleAccent}`.trim();
    const defaultPromo = [
      `${fullTitle} — ${activeSet.brand.curatorLine} (${activeSet.brand.companyName}) and spun by ${activePersona.name}.`,
      "",
      `${activeSet.tracks.length} standout tracks on ${activeSet.industry}: ${activeSet.linerNotes.summary.slice(0, 180)}${activeSet.linerNotes.summary.length > 180 ? "…" : ""}`,
    ].join("\n");

    const promoBody = activeSet.linerNotes.promoBlurb.trim() || defaultPromo;
    const promoText = `${promoBody}\n\nDrop the needle: ${shareUrl}`;

    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(promoText);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied && typeof document !== "undefined") {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = promoText;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        copied = document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      setShareCopied(true);
      if (shareTimerRef.current !== null) {
        window.clearTimeout(shareTimerRef.current);
      }
      shareTimerRef.current = window.setTimeout(() => {
        setShareCopied(false);
      }, 2600);
    }
  };

  const posText = `${String(safeIndex + 1).padStart(2, "0")} / ${String(
    activeSet.tracks.length
  ).padStart(2, "0")}`;

  const isCopyflightBrand = activeSet.brand.companyName.trim().toUpperCase() === "COPYFLIGHT";

  // Split curationNote cleanly around [VERIFY] if present
  const curationParts = activeSet.linerNotes.curationNote.split("[VERIFY]");

  return (
    <div className="min-h-screen flex flex-col bg-plum-deep text-cream">
      {/* Top Bar: Clean 3-zone contract */}
      <header className="sticky top-0 z-40 border-b border-gold/15 bg-plum-deep/95 backdrop-blur-md">
        <div className="max-w-[1380px] mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="inline-flex items-center gap-3 font-mono font-bold text-lg tracking-[0.26em] text-cream no-underline whitespace-nowrap shrink-0"
          >
            {activeSet.brand.logoUrl ? (
              <img
                src={activeSet.brand.logoUrl}
                alt={`${activeSet.brand.companyName} logo`}
                className="max-h-7 w-auto object-contain shrink-0"
              />
            ) : isCopyflightBrand ? (
              <svg width="28" height="28" viewBox="0 0 34 34" aria-hidden="true">
                <path d="M2 14 L32 4 L18 30 L13 19 Z" fill={activeTheme.cream} />
                <path d="M13 19 L32 4 L15 22 Z" fill={activeTheme.accent} />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 34 34" aria-hidden="true">
                <circle cx="17" cy="17" r="14" fill="none" stroke={activeTheme.accentBright} strokeWidth="2.4" />
                <circle cx="17" cy="17" r="5" fill={activeTheme.cream} />
              </svg>
            )}
            <span>{activeSet.brand.companyName}</span>
          </a>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-cream/85"
          >
            <a
              href="#booth"
              className="hover:text-gold-bright transition-colors whitespace-nowrap shrink-0"
            >
              The Booth
            </a>
            <a
              href="#crate"
              className="hover:text-gold-bright transition-colors whitespace-nowrap shrink-0"
            >
              The Crate
            </a>
            <a
              href="#liner-notes"
              className="hover:text-gold-bright transition-colors whitespace-nowrap shrink-0"
            >
              Liner Notes
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <a
              href={activeSet.brand.ctaUrl || "https://www.copyflight.com/dig/"}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg text-sm font-bold bg-gold-bright text-ink hover:brightness-105 transition-all whitespace-nowrap shrink-0 no-underline"
            >
              {activeSet.brand.ctaLabel}
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        id="top"
        className="relative overflow-hidden border-b border-gold/15"
        style={{
          backgroundImage: `radial-gradient(900px 480px at 80% 18%, color-mix(in srgb, ${activeTheme.accentBright} 15%, transparent), transparent 62%), radial-gradient(760px 460px at 12% 86%, rgba(155,127,196,0.12), transparent 62%), linear-gradient(160deg, ${activeTheme.deep} 0%, ${activeTheme.surface} 55%, ${activeTheme.deep} 100%)`,
        }}
      >
        <div className="max-w-[1120px] mx-auto px-5 sm:px-8 py-14 sm:py-20 lg:py-24 relative">
          <p className="font-mono text-sm tracking-[0.2em] uppercase text-gold mb-4">
            {activeSet.brand.kicker}
          </p>
          <h1 className="font-display font-black text-4xl sm:text-6xl lg:text-7xl leading-[1.03] max-w-[14ch] text-balance text-cream">
            {activeSet.brand.setTitleLead}{" "}
            <em className="italic text-gold-bright">{activeSet.brand.setTitleAccent}</em>
          </h1>
          <p className="text-xl sm:text-2xl font-bold text-gold mt-5">
            {activeSet.brand.curatorLine}
          </p>

          {/* Host Welcome Card */}
          <div className="mt-9 max-w-[740px] flex flex-col sm:flex-row items-start gap-5 bg-plum-surface border border-gold/25 rounded-2xl p-6 shadow-lg">
            <span className="w-[78px] h-[78px] rounded-full bg-plum-deep border-2 border-gold overflow-hidden shrink-0">
              <MarloweArt customImageSrc={customHostImage} persona={activePersona} variant="avatar" />
            </span>
            <div>
              <span className="block font-mono text-xs tracking-[0.18em] uppercase text-gold mb-1.5">
                {activePersona.name} · On the Decks
              </span>
              <p className="font-display italic text-xl sm:text-2xl leading-snug text-cream">
                “{activeSet.hostWelcome}”
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDropNeedle}
            className="mt-9 inline-flex items-center gap-2 bg-gold-bright text-ink font-bold text-lg sm:text-xl px-8 py-4 rounded-xl shadow-[0_10px_34px_rgba(229,187,113,0.28)] hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(229,187,113,0.4)] transition-all cursor-pointer"
          >
            <span>Drop the needle</span>
            <span aria-hidden="true">▸</span>
          </button>
        </div>
      </section>

      {/* Main DJ Booth & Crate Section */}
      <main id="booth" className="max-w-[1380px] w-full mx-auto px-5 sm:px-8 py-12 sm:py-16">
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-6">
          <h2 className="font-display font-black text-3xl sm:text-5xl text-cream">The Booth</h2>
          <span className="font-mono text-sm tracking-[0.16em] text-gold tabular-nums">
            TRACK {posText} · {currentTrack?.bpm ?? 120} BPM
          </span>
        </div>

        <StudioDock
          sets={sets}
          activeSetId={activeSet.id}
          onSelectSet={handleSelectSet}
          trackCount={activeSet.tracks.length}
          activePersona={activePersona}
          onSelectPersona={handleSelectPersona}
          onOpenBuilder={() => setBuilderOpen(true)}
          soundOn={soundOn}
          onToggleSound={() => setSoundOn((s) => !s)}
          audioState={audioState}
          onLoadMusic={(file) => audioEngine.loadFile(file)}
          onClearMusic={() => audioEngine.clearFile()}
          onVolumeChange={(v) => audioEngine.setVolume(v)}
          hostFit={hostFit}
          onHostFitChange={handleHostFitChange}
          onUploadHostImage={handleUploadHostImage}
          onResetHost={handleResetHost}
          boothSettings={boothSettings}
          onBoothSettingsChange={setBoothSettings}
          onRandomizeBooth={handleRandomizeBooth}
          onResetBooth={() => setBoothSettings(DEFAULT_BOOTH_SETTINGS)}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.85fr)_minmax(310px,1fr)] gap-7 items-start">
          {/* Left Column: 3D Stage + Transport + Active Track Card */}
          <div className="min-w-0">
            <BoothStage
              tracks={activeSet.tracks}
              currentTrackIndex={safeIndex}
              playing={playing}
              reducedMotion={reducedMotion}
              persona={activePersona}
              theme={activeTheme}
              customHostImage={customHostImage}
              hostFit={hostFit}
              boothSettings={boothSettings}
              crossfadeText={crossfadeText}
              onOrbitChange={(orbit) =>
                setBoothSettings((prev) => ({ ...prev, orbit }))
              }
            />

            {/* Transport Controls */}
            <div className="flex flex-wrap items-center gap-3 my-5">
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous track"
                className="inline-flex items-center gap-1.5 bg-plum-surface text-cream border border-gold/45 hover:border-gold rounded-xl px-5 py-3 font-bold min-h-[48px] transition-colors whitespace-nowrap"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>

              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                aria-pressed={playing}
                aria-label={playing ? "Pause the set" : "Play the set"}
                className="inline-flex items-center justify-center gap-2 bg-gold-bright text-ink border border-gold-bright hover:brightness-105 rounded-xl px-6 py-3 font-bold min-w-[132px] min-h-[48px] transition-all whitespace-nowrap"
              >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{playing ? "Pause" : "Play"}</span>
              </button>

              <button
                type="button"
                onClick={goNext}
                aria-label="Next track"
                className="inline-flex items-center gap-1.5 bg-plum-surface text-cream border border-gold/45 hover:border-gold rounded-xl px-5 py-3 font-bold min-h-[48px] transition-colors whitespace-nowrap"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <span className="ml-auto font-mono text-base tracking-[0.14em] text-gold tabular-nums">
                {posText}
              </span>
            </div>

            {currentTrack && <TrackCard track={currentTrack} index={safeIndex} />}
          </div>

          {/* Right Column: The Crate */}
          <div id="crate" className="lg:sticky lg:top-24">
            <TrackCrate
              tracks={activeSet.tracks}
              currentIndex={safeIndex}
              onSelect={(idx) => selectTrack(idx, idx > safeIndex, true)}
            />
          </div>
        </div>
      </main>

      {/* Liner Notes */}
      <section id="liner-notes" className="max-w-[880px] mx-auto px-5 sm:px-8 py-14 sm:py-20">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
          <h2 className="font-display font-black text-3xl sm:text-5xl text-cream">
            Liner Notes
          </h2>
          <button
            type="button"
            onClick={handleShareSet}
            aria-label={
              shareCopied
                ? "Promotional message copied to clipboard"
                : "Share this storytelling set"
            }
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold border transition-all whitespace-nowrap cursor-pointer ${
              shareCopied
                ? "bg-live/15 border-live text-live"
                : "bg-plum-surface border-gold/45 text-gold-bright hover:border-gold-bright hover:bg-plum-elevated"
            }`}
          >
            {shareCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            <span>{shareCopied ? "Copied to clipboard" : "Share"}</span>
          </button>
        </div>

        <p className="text-lg sm:text-xl leading-relaxed text-cream/95 mb-6">
          {activeSet.linerNotes.summary}
        </p>

        <div className="bg-plum-surface border border-gold/25 rounded-2xl p-6 mb-7 text-base sm:text-lg text-cream/90">
          <strong className="text-gold font-bold">How this set was picked:</strong>{" "}
          {curationParts.map((part, idx) => (
            <React.Fragment key={idx}>
              {part}
              {idx < curationParts.length - 1 && (
                <span className="font-mono text-xs border border-dashed border-warn text-warn px-1.5 py-0.5 rounded">
                  [VERIFY]
                </span>
              )}
            </React.Fragment>
          ))}{" "}
          {activeSet.linerNotes.curationSignOff}
        </div>

        <div className="bg-plum-panel border border-gold/30 rounded-2xl p-6 sm:p-7">
          <span className="block font-mono text-xs tracking-[0.18em] uppercase text-gold mb-2">
            {activePersona.name} · Signing Off
          </span>
          <p className="font-display italic text-xl sm:text-2xl text-cream leading-snug">
            “{activeSet.hostSignOff}”
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section
        className="max-w-[880px] w-[calc(100%-2.5rem)] mx-auto mb-16 rounded-3xl border border-gold/50 px-6 py-12 sm:p-14 text-center shadow-2xl"
        style={{
          backgroundImage: `linear-gradient(150deg, ${activeTheme.surface} 0%, ${activeTheme.elevated} 100%)`,
        }}
      >
        <h2 className="font-display font-black text-3xl sm:text-4xl text-cream text-balance mb-4">
          {activeSet.brand.finalCtaHeading}
        </h2>
        <p className="text-lg sm:text-xl text-cream/90 max-w-[580px] mx-auto mb-8">
          {activeSet.brand.finalCtaBody}
        </p>
        <a
          href={activeSet.brand.ctaUrl || "https://www.copyflight.com/dig/"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-gold-bright text-ink font-bold text-lg px-8 py-4 rounded-xl shadow-[0_10px_30px_rgba(229,187,113,0.3)] hover:-translate-y-0.5 transition-all no-underline"
        >
          <span>{activeSet.brand.ctaLabel}</span>
          <span aria-hidden="true">▸</span>
        </a>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-gold/15 py-8 px-5 sm:px-8 text-center text-base text-cream/85">
        <p>
          {activeSet.brand.setTitleLead} {activeSet.brand.setTitleAccent} ·{" "}
          {activeSet.brand.curatorLine} ·{" "}
          <a
            href={activeSet.brand.companyWebsiteUrl || "https://copyflight.com"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold-bright hover:text-cream underline underline-offset-4"
          >
            {activeSet.brand.companyWebsiteUrl.replace(/^https?:\/\//, "")}
          </a>
        </p>
        <p className="mt-3 text-sm text-cream/75">
          Music by{" "}
          <a
            href="https://pixabay.com/users/atlasaudio-54514918/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=625676"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold-bright font-bold hover:underline"
          >
            AtlasAudio
          </a>{" "}
          from{" "}
          <a
            href="https://pixabay.com/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=625676"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold-bright font-bold hover:underline"
          >
            Pixabay
          </a>
        </p>
      </footer>

      {/* Set Builder & Brand Studio Modal */}
      <SetBuilderModal
        isOpen={builderOpen}
        onClose={() => setBuilderOpen(false)}
        sets={sets}
        activeSet={activeSet}
        currentTrackIndex={safeIndex}
        onSelectTrackIndex={(idx) => selectTrack(idx, false, false)}
        onUpdateActiveSet={handleUpdateActiveSet}
        onSelectSet={handleSelectSet}
        onDuplicateSet={handleDuplicateSet}
        onCreateStarterSet={handleCreateStarterSet}
        onDeleteSet={handleDeleteSet}
        onImportSet={handleImportSet}
        onResetDefaultSet={handleResetDefaultSet}
      />

      {/* Screen reader live announcement */}
      <div className="sr-only" aria-live="polite">
        {currentTrack
          ? `Now ${playing ? "playing" : "cued"}: track ${safeIndex + 1}, ${currentTrack.title}, by ${currentTrack.author}. ${currentTrack.bpm} BPM.`
          : "No tracks loaded."}
      </div>
    </div>
  );
}
