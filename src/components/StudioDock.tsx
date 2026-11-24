import React, { useState } from "react";
import { ChevronDown, ChevronUp, Disc3, LayoutTemplate, SlidersHorizontal, UserCheck, Volume2, VolumeX } from "lucide-react";
import { DJ_PERSONAS, DjPersona, DjPersonaId, SetTemplate } from "../data/setTemplates";
import { AudioState } from "../lib/audioEngine";
import { BoothSettings } from "../three/boothScene";
import { HostFit } from "./BoothStage";

interface StudioDockProps {
  sets: SetTemplate[];
  activeSetId: string;
  onSelectSet: (setId: string) => void;
  trackCount: number;
  activePersona: DjPersona;
  onSelectPersona: (id: DjPersonaId) => void;
  onOpenBuilder: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
  audioState: AudioState;
  onLoadMusic: (file: File) => void;
  onClearMusic: () => void;
  onVolumeChange: (vol: number) => void;
  hostFit: HostFit;
  onHostFitChange: (next: HostFit) => void;
  onUploadHostImage: (dataUrl: string) => void;
  onResetHost: () => void;
  boothSettings: BoothSettings;
  onBoothSettingsChange: (next: BoothSettings) => void;
  onRandomizeBooth: () => void;
  onResetBooth: () => void;
}

type DockTab = "audio" | "persona" | "booth";

export const StudioDock: React.FC<StudioDockProps> = ({
  sets,
  activeSetId,
  onSelectSet,
  trackCount,
  activePersona,
  onSelectPersona,
  onOpenBuilder,
  soundOn,
  onToggleSound,
  audioState,
  onLoadMusic,
  onClearMusic,
  onVolumeChange,
  hostFit,
  onHostFitChange,
  onUploadHostImage,
  onResetHost,
  boothSettings,
  onBoothSettingsChange,
  onRandomizeBooth,
  onResetBooth,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<DockTab>("audio");

  const handleMusicInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onLoadMusic(file);
    e.target.value = "";
  };

  const handleHostInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onUploadHostImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <section
      aria-label="Studio controls"
      className="bg-plum-surface border border-gold/25 rounded-2xl overflow-hidden mb-6 shadow-lg"
    >
      {/* Always-visible compact audio & drawer toggle bar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
        <button
          type="button"
          onClick={onToggleSound}
          aria-pressed={soundOn}
          aria-label={soundOn ? "Mute all sound" : "Unmute sound"}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-bold text-sm whitespace-nowrap shrink-0 border transition-colors min-h-[42px] ${
            soundOn
              ? "bg-live text-ink border-live"
              : "bg-plum-deep text-cream border-gold/50 hover:border-gold"
          }`}
        >
          {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          <span>{soundOn ? "Sound: ON" : "Sound: OFF"}</span>
        </button>

        <label className="relative inline-flex items-center justify-center rounded-lg px-4 py-2 font-bold text-sm bg-gold-bright text-ink border border-gold-bright hover:brightness-105 cursor-pointer whitespace-nowrap shrink-0 min-h-[42px]">
          <span>Load music</span>
          <input
            type="file"
            accept="audio/*"
            onChange={handleMusicInput}
            aria-label="Load an audio file from your device to play under the set"
            className="sr-only"
          />
        </label>

        <div className="flex items-center gap-2.5 flex-1 min-w-[160px] max-w-[260px]">
          <label
            htmlFor="volSlider"
            className="font-mono text-xs tracking-[0.1em] uppercase text-gold whitespace-nowrap"
          >
            Volume
          </label>
          <input
            id="volSlider"
            type="range"
            min={0}
            max={100}
            value={audioState.volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="studio-slider flex-1 min-w-[80px]"
          />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          {sets.length > 1 && (
            <select
              aria-label="Switch active set template"
              value={activeSetId}
              onChange={(e) => onSelectSet(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm font-bold text-cream bg-plum-deep border border-gold/35 hover:border-gold focus:border-gold-bright focus:outline-none min-h-[42px] max-w-[230px] truncate cursor-pointer"
            >
              {sets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={onOpenBuilder}
            className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-bold text-cream border border-gold/45 hover:border-gold-bright bg-plum-elevated whitespace-nowrap shrink-0 min-h-[42px] cursor-pointer transition-colors"
          >
            <LayoutTemplate className="w-4 h-4 text-gold-bright" />
            <span>Customize &amp; Templates</span>
          </button>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-bold text-gold border border-gold/30 hover:border-gold bg-plum-deep whitespace-nowrap shrink-0 min-h-[42px] cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>{expanded ? "Hide studio controls" : "Studio controls"}</span>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Subtle status readout */}
      <div className="px-4 pb-3 sm:px-5 text-sm text-cream/85 border-b border-gold/10">
        {audioState.hasCustomTrack ? (
          <span>
            Now on the platter: <strong className="text-gold-bright">{audioState.trackName}</strong> — loops under all {trackCount} tracks.{" "}
            {soundOn ? "Sound is on." : "Press Sound: OFF to listen."}
          </span>
        ) : (
          <span>
            Built-in studio groove: <strong className="text-gold-bright">{audioState.grooveLabel}</strong>{" "}
            — shifts automatically by track energy (funk, upbeat pop &amp; slow soul), or load any audio file to override.
          </span>
        )}
      </div>

      {/* Collapsible tabbed studio settings */}
      {expanded && (
        <div className="p-4 sm:p-5 bg-plum-deep/70">
          <div
            role="tablist"
            aria-label="Studio settings tabs"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-plum-room border border-gold/20 mb-5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "audio"}
              onClick={() => setActiveTab("audio")}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                activeTab === "audio"
                  ? "bg-plum-elevated text-gold-bright"
                  : "text-cream/75 hover:text-cream"
              }`}
            >
              <Disc3 className="w-4 h-4" />
              <span>Track &amp; Audio</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "persona"}
              onClick={() => setActiveTab("persona")}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                activeTab === "persona"
                  ? "bg-plum-elevated text-gold-bright"
                  : "text-cream/75 hover:text-cream"
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>DJ Persona ({activePersona.name})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "booth"}
              onClick={() => setActiveTab("booth")}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                activeTab === "booth"
                  ? "bg-plum-elevated text-gold-bright"
                  : "text-cream/75 hover:text-cream"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>3D Light &amp; Camera</span>
            </button>
          </div>

          {activeTab === "audio" && (
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-sm text-cream/85 flex-1 min-w-[220px]">
                Uploaded audio saves directly in your browser’s IndexedDB so it stays queued across refreshes.
              </p>
              <button
                type="button"
                onClick={onClearMusic}
                disabled={!audioState.hasCustomTrack}
                className="px-4 py-2 rounded-lg text-sm font-bold border border-gold/40 text-cream hover:border-gold disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap min-h-[42px]"
              >
                Remove uploaded track
              </button>
            </div>
          )}

          {activeTab === "persona" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {DJ_PERSONAS.map((persona) => {
                  const selected = persona.id === activePersona.id;
                  return (
                    <button
                      key={persona.id}
                      type="button"
                      onClick={() => onSelectPersona(persona.id)}
                      aria-pressed={selected}
                      className={`flex items-center gap-3.5 text-left p-3 rounded-xl border transition-all cursor-pointer ${
                        selected
                          ? "bg-plum-elevated border-gold-bright shadow-[0_0_16px_rgba(229,187,113,0.16)]"
                          : "bg-plum-surface border-gold/20 hover:border-gold/55"
                      }`}
                    >
                      <img
                        src={persona.avatarUrl}
                        alt={persona.name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-full object-cover object-[50%_18%] border border-gold/45 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block font-bold text-sm text-cream">{persona.name}</span>
                        <span className="block text-xs text-gold truncate">{persona.role}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <label className="relative inline-flex items-center justify-center rounded-lg px-4 py-2 font-bold text-sm bg-gold-bright text-ink cursor-pointer whitespace-nowrap min-h-[44px]">
                  <span>Upload custom image</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleHostInput}
                    aria-label="Load a custom DJ portrait image"
                    className="sr-only"
                  />
                </label>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-xs text-gold">
                    <label htmlFor="hScale">Size</label>
                    <span className="tabular-nums text-cream">{Math.round(hostFit.scale * 100)}%</span>
                  </div>
                  <input
                    id="hScale"
                    type="range"
                    min={50}
                    max={190}
                    value={Math.round(hostFit.scale * 100)}
                    onChange={(e) =>
                      onHostFitChange({ ...hostFit, scale: Number(e.target.value) / 100 })
                    }
                    className="studio-slider"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-xs text-gold">
                    <label htmlFor="hY">Height</label>
                    <span className="tabular-nums text-cream">{hostFit.y}</span>
                  </div>
                  <input
                    id="hY"
                    type="range"
                    min={-30}
                    max={40}
                    value={hostFit.y}
                    onChange={(e) => onHostFitChange({ ...hostFit, y: Number(e.target.value) })}
                    className="studio-slider"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-xs text-gold">
                    <label htmlFor="hX">Shift</label>
                    <span className="tabular-nums text-cream">{hostFit.x}</span>
                  </div>
                  <input
                    id="hX"
                    type="range"
                    min={-40}
                    max={40}
                    value={hostFit.x}
                    onChange={(e) => onHostFitChange({ ...hostFit, x: Number(e.target.value) })}
                    className="studio-slider"
                  />
                </div>

                <button
                  type="button"
                  onClick={onResetHost}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-plum-elevated border border-gold/40 text-cream hover:border-gold whitespace-nowrap min-h-[44px]"
                >
                  Default art
                </button>
              </div>
            </div>
          )}

          {activeTab === "booth" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-xs text-gold">
                  <label htmlFor="ctlOrbit">Orbit</label>
                  <span className="tabular-nums text-cream">
                    {Math.round(boothSettings.orbit * 57.3)}°
                  </span>
                </div>
                <input
                  id="ctlOrbit"
                  type="range"
                  min={-38}
                  max={38}
                  value={Math.round(boothSettings.orbit * 100)}
                  onChange={(e) =>
                    onBoothSettingsChange({
                      ...boothSettings,
                      orbit: Number(e.target.value) / 100,
                    })
                  }
                  className="studio-slider"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-xs text-gold">
                  <label htmlFor="ctlZoom">Zoom</label>
                  <span className="tabular-nums text-cream">{boothSettings.zoom.toFixed(1)}</span>
                </div>
                <input
                  id="ctlZoom"
                  type="range"
                  min={62}
                  max={105}
                  value={Math.round(boothSettings.zoom * 10)}
                  onChange={(e) =>
                    onBoothSettingsChange({
                      ...boothSettings,
                      zoom: Number(e.target.value) / 10,
                    })
                  }
                  className="studio-slider"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-xs text-gold">
                  <label htmlFor="ctlGlow">Glow</label>
                  <span className="tabular-nums text-cream">{boothSettings.glow.toFixed(1)}×</span>
                </div>
                <input
                  id="ctlGlow"
                  type="range"
                  min={40}
                  max={190}
                  value={Math.round(boothSettings.glow * 100)}
                  onChange={(e) =>
                    onBoothSettingsChange({
                      ...boothSettings,
                      glow: Number(e.target.value) / 100,
                    })
                  }
                  className="studio-slider"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-xs text-gold">
                  <label htmlFor="ctlHaze">Haze</label>
                  <span className="tabular-nums text-cream">{boothSettings.haze.toFixed(3)}</span>
                </div>
                <input
                  id="ctlHaze"
                  type="range"
                  min={0}
                  max={90}
                  value={Math.round(boothSettings.haze * 1000)}
                  onChange={(e) =>
                    onBoothSettingsChange({
                      ...boothSettings,
                      haze: Number(e.target.value) / 1000,
                    })
                  }
                  className="studio-slider"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-xs text-gold">
                  <label htmlFor="ctlSpin">Spin</label>
                  <span className="tabular-nums text-cream">{boothSettings.spin.toFixed(1)}×</span>
                </div>
                <input
                  id="ctlSpin"
                  type="range"
                  min={0}
                  max={200}
                  value={Math.round(boothSettings.spin * 100)}
                  onChange={(e) =>
                    onBoothSettingsChange({
                      ...boothSettings,
                      spin: Number(e.target.value) / 100,
                    })
                  }
                  className="studio-slider"
                />
              </div>

              <label className="inline-flex items-center gap-2.5 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={boothSettings.pulse}
                  onChange={(e) =>
                    onBoothSettingsChange({ ...boothSettings, pulse: e.target.checked })
                  }
                  className="w-5 h-5 accent-gold-bright rounded"
                />
                <span className="font-mono text-xs uppercase tracking-[0.08em] text-gold">
                  Peak pulse
                </span>
              </label>

              <button
                type="button"
                onClick={onRandomizeBooth}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-plum-elevated border border-gold/40 text-cream hover:border-gold whitespace-nowrap min-h-[44px]"
              >
                Randomize
              </button>

              <button
                type="button"
                onClick={onResetBooth}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-plum-elevated border border-gold/40 text-cream hover:border-gold whitespace-nowrap min-h-[44px]"
              >
                Reset booth
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
