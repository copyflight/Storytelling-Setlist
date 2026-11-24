import React, { useEffect, useRef, useState } from "react";
import { BrandThemePreset, DjPersona } from "../data/setTemplates";
import { Track } from "../data/tracks";
import { BoothController, BoothSettings, mountBoothScene } from "../three/boothScene";
import { MarloweArt } from "./MarloweArt";

export interface HostFit {
  scale: number;
  x: number;
  y: number;
}

interface BoothStageProps {
  tracks: Track[];
  currentTrackIndex: number;
  playing: boolean;
  reducedMotion: boolean;
  persona: DjPersona;
  theme: BrandThemePreset;
  customHostImage: string | null;
  hostFit: HostFit;
  boothSettings: BoothSettings;
  crossfadeText: string | null;
  onOrbitChange: (orbit: number) => void;
}

export const BoothStage: React.FC<BoothStageProps> = ({
  tracks,
  currentTrackIndex,
  playing,
  reducedMotion,
  persona,
  theme,
  customHostImage,
  hostFit,
  boothSettings,
  crossfadeText,
  onOrbitChange,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const backCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frontCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<BoothController | null>(null);
  const prevTrackRef = useRef<number>(currentTrackIndex);
  const [webglActive, setWebglActive] = useState(false);

  // Mount Three.js scene once
  useEffect(() => {
    const stageEl = stageRef.current;
    const backEl = backCanvasRef.current;
    const frontEl = frontCanvasRef.current;
    if (!stageEl || !backEl || !frontEl) return;

    const ctrl = mountBoothScene(
      backEl,
      frontEl,
      stageEl,
      tracks,
      currentTrackIndex,
      playing,
      reducedMotion,
      boothSettings,
      () => setWebglActive(false)
    );

    if (ctrl) {
      controllerRef.current = ctrl;
      ctrl.setHostPortrait(customHostImage || persona.boothUrl, hostFit);
      ctrl.updateTheme({
        room: theme.room,
        plum: theme.surface,
        panel: theme.panel,
        accent: theme.accent,
        accentBright: theme.accentBright,
      });
      setWebglActive(true);
    } else {
      setWebglActive(false);
    }

    return () => {
      ctrl?.dispose();
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync tracks list changes
  useEffect(() => {
    controllerRef.current?.setTracks(tracks, currentTrackIndex);
  }, [tracks, currentTrackIndex]);

  // Sync track changes
  useEffect(() => {
    const animateDrop = prevTrackRef.current !== currentTrackIndex;
    prevTrackRef.current = currentTrackIndex;
    controllerRef.current?.setTrack(currentTrackIndex, animateDrop);
  }, [currentTrackIndex]);

  // Sync playback state
  useEffect(() => {
    controllerRef.current?.setPlaying(playing);
  }, [playing]);

  // Sync reduced motion preference
  useEffect(() => {
    controllerRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  // Sync DJ persona portrait & fit into 3D scene
  useEffect(() => {
    controllerRef.current?.setHostPortrait(customHostImage || persona.boothUrl, hostFit);
  }, [customHostImage, persona.boothUrl, hostFit]);

  // Sync brand theme colors into 3D scene
  useEffect(() => {
    controllerRef.current?.updateTheme({
      room: theme.room,
      plum: theme.surface,
      panel: theme.panel,
      accent: theme.accent,
      accentBright: theme.accentBright,
    });
  }, [theme]);

  // Sync lighting & camera sliders
  useEffect(() => {
    controllerRef.current?.updateSettings(boothSettings);
  }, [boothSettings]);

  // Pointer orbit dragging
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({
    active: false,
    x: 0,
    y: 0,
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, input, label")) return;
    dragRef.current = { active: true, x: e.clientX, y: e.clientY };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture errors
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current.x = e.clientX;
    dragRef.current.y = e.clientY;
    if (Math.abs(dx) >= Math.abs(dy) && controllerRef.current) {
      const next = controllerRef.current.handlePointerDrag(dx, dy);
      onOrbitChange(next.orbit);
    }
  };

  const endDrag = () => {
    dragRef.current.active = false;
  };

  const track = tracks[currentTrackIndex] || tracks[0];

  return (
    <div
      ref={stageRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
      className="relative rounded-2xl overflow-hidden bg-plum-room border border-gold/25 h-[clamp(380px,48vw,580px)] touch-pan-y cursor-grab active:cursor-grabbing shadow-2xl"
    >
      {/* Fallback 2D vinyl deck + DJ Persona when WebGL is unavailable */}
      {!webglActive && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-end pb-8 bg-[radial-gradient(640px_360px_at_50%_26%,rgba(229,187,113,0.16),transparent_66%)] bg-plum-room">
          <div
            className={`absolute left-1/2 bottom-[28%] w-[min(60%,420px)] pointer-events-none origin-bottom ${
              playing && !reducedMotion ? "animate-marlowe-groove" : ""
            }`}
            style={{
              transform: `translateX(calc(-50% + ${hostFit.x}px)) translateY(${-hostFit.y}px) scale(${hostFit.scale})`,
            }}
          >
            <MarloweArt customImageSrc={customHostImage} persona={persona} variant="booth" />
          </div>
          <div
            className={`relative z-10 w-[clamp(190px,24vw,270px)] aspect-square rounded-full border-4 border-plum-panel shadow-2xl flex items-center justify-center ${
              playing && !reducedMotion ? "animate-vinyl-spin" : ""
            }`}
            style={{
              background:
                "repeating-radial-gradient(circle at 50% 50%, #17121C 0 3px, #241b2d 3px 5px)",
            }}
          >
            <div className="w-[34%] aspect-square rounded-full bg-gold text-ink flex items-center justify-center font-mono font-bold text-2xl border-4 border-plum-deep">
              {String(currentTrackIndex + 1).padStart(2, "0")}
            </div>
          </div>
          <div className="relative z-10 w-[clamp(180px,22vw,240px)] h-2.5 bg-plum-panel rounded-md mt-5">
            <span
              className="absolute -top-2 w-5 h-6 bg-gold-bright rounded transition-all duration-300"
              style={{ left: currentTrackIndex % 2 === 0 ? "12%" : "72%" }}
            />
          </div>
        </div>
      )}

      {/* Layer 1: Atmospheric 3D Studio Backdrop */}
      <canvas
        ref={backCanvasRef}
        aria-hidden="true"
        className={`absolute inset-0 w-full h-full pointer-events-none z-[1] ${
          webglActive ? "block" : "hidden"
        }`}
      />

      {/* Layer 2: Precision 3D Turntables, Mixer, Standing Console & Host */}
      <canvas
        ref={frontCanvasRef}
        role="img"
        aria-label={`3D DJ booth: ${persona.name} standing behind two direct-drive turntables and a mixer. Track ${currentTrackIndex + 1}, ${track?.title || ""}, is loaded.`}
        className={`absolute inset-0 w-full h-full pointer-events-none z-[3] ${
          webglActive ? "block" : "hidden"
        }`}
      />

      {/* Top architectural corner labels (solid dark scrims, zero backdrop-blur) */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <span
          className={`font-mono text-xs font-bold tracking-[0.2em] px-3 py-1.5 rounded border transition-colors ${
            playing
              ? "bg-gold-bright text-ink border-gold-bright shadow-[0_0_24px_rgba(229,187,113,0.45)]"
              : "bg-plum-room/90 text-gold border-gold/40"
          }`}
        >
          {playing ? "ON AIR · PLAYING" : "ON AIR · STANDBY"}
        </span>
        <span className="font-mono text-xs tracking-[0.12em] text-gold bg-plum-room/90 border border-gold/25 px-3 py-1.5 rounded">
          Drag to orbit
        </span>
      </div>

      {/* Active Deck BPM & Title Overlay (positioned over Deck A or Deck B while playing) */}
      {playing && !crossfadeText && track && (
        <div
          aria-label={`Playing on ${currentTrackIndex % 2 === 0 ? "Deck A" : "Deck B"}: ${track.title} at ${track.bpm} BPM`}
          className={`absolute bottom-4 z-10 max-w-[min(340px,calc(100%-2rem))] pointer-events-none transition-all duration-300 ${
            currentTrackIndex % 2 === 0 ? "left-4" : "right-4"
          }`}
        >
          <div className="bg-plum-room/92 border border-gold/45 rounded-xl px-4 py-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between gap-4 font-mono text-xs tracking-[0.14em] uppercase tabular-nums mb-1">
              <span className="text-live font-bold">
                {currentTrackIndex % 2 === 0 ? "Deck A" : "Deck B"} ·{" "}
                {String(currentTrackIndex + 1).padStart(2, "0")}
              </span>
              <span className="text-gold-bright font-bold">{track.bpm} BPM</span>
            </div>
            <p className="font-display font-bold text-sm sm:text-base text-cream leading-snug truncate">
              {track.title}
            </p>
          </div>
        </div>
      )}

      {/* Host Crossfade Transition Caption */}
      <div
        aria-hidden={!crossfadeText}
        className={`absolute inset-x-0 bottom-0 z-10 px-6 py-5 bg-gradient-to-t from-plum-room via-plum-room/90 to-transparent transition-opacity duration-300 pointer-events-none ${
          crossfadeText ? "opacity-100" : "opacity-0"
        }`}
      >
        {crossfadeText && (
          <>
            <span className="block font-mono text-xs tracking-[0.2em] text-gold-bright mb-1 uppercase">
              {persona.name} · CROSSFADE
            </span>
            <p className="font-display italic text-lg sm:text-xl text-cream leading-snug">
              {crossfadeText}
            </p>
          </>
        )}
      </div>
    </div>
  );
};
