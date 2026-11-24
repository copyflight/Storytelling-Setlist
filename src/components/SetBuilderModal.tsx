import React, { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Download,
  FileUp,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import {
  BRAND_THEMES,
  DJ_PERSONAS,
  DjPersonaId,
  SetTemplate,
  createEmptyTrack,
  getPersonaById,
  parseArticlesDeck,
  parseImportedSetTemplate,
} from "../data/setTemplates";
import { Track } from "../data/tracks";

interface SetBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  sets: SetTemplate[];
  activeSet: SetTemplate;
  currentTrackIndex: number;
  onSelectTrackIndex: (idx: number) => void;
  onUpdateActiveSet: (updater: (prev: SetTemplate) => SetTemplate) => void;
  onSelectSet: (setId: string) => void;
  onDuplicateSet: (newName: string, newIndustry: string) => void;
  onCreateStarterSet: () => void;
  onDeleteSet: (setId: string) => void;
  onImportSet: (imported: SetTemplate) => void;
  onResetDefaultSet: () => void;
}

type BuilderTab = "articles" | "brand" | "persona" | "templates";

const SLOTS: Track["slot"][] = ["OPENER", "BUILD", "PEAK", "B2B", "COOLDOWN", "CLOSER"];

export const SetBuilderModal: React.FC<SetBuilderModalProps> = ({
  isOpen,
  onClose,
  sets,
  activeSet,
  currentTrackIndex,
  onSelectTrackIndex,
  onUpdateActiveSet,
  onSelectSet,
  onDuplicateSet,
  onCreateStarterSet,
  onDeleteSet,
  onImportSet,
  onResetDefaultSet,
}) => {
  const [tab, setTab] = useState<BuilderTab>("articles");
  const [editTrackIdx, setEditTrackIdx] = useState<number>(currentTrackIndex);
  const [dupName, setDupName] = useState("");
  const [dupIndustry, setDupIndustry] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  useEffect(() => {
    if (isOpen) {
      setEditTrackIdx(Math.min(currentTrackIndex, Math.max(0, activeSet.tracks.length - 1)));
      setDupName(`${activeSet.name} (Copy)`);
      setDupIndustry(activeSet.industry);
      setStatusMsg(null);
    }
  }, [isOpen, currentTrackIndex, activeSet.id, activeSet.name, activeSet.industry, activeSet.tracks.length]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const safeIdx = Math.max(0, Math.min(editTrackIdx, Math.max(0, activeSet.tracks.length - 1)));
  const editedTrack = activeSet.tracks[safeIdx];

  const updateTrackField = <K extends keyof Track>(field: K, value: Track[K]) => {
    onUpdateActiveSet((prev) => {
      const nextTracks = prev.tracks.map((t, i) => (i === safeIdx ? { ...t, [field]: value } : t));
      return { ...prev, tracks: nextTracks, updatedAt: new Date().toISOString() };
    });
  };

  const handleAddTrack = () => {
    onUpdateActiveSet((prev) => {
      const newTrack = createEmptyTrack(prev.tracks.length);
      const nextTracks = [...prev.tracks, newTrack];
      return { ...prev, tracks: nextTracks, updatedAt: new Date().toISOString() };
    });
    const nextIdx = activeSet.tracks.length;
    setEditTrackIdx(nextIdx);
    onSelectTrackIndex(nextIdx);
  };

  const handleDuplicateTrack = (idx: number) => {
    onUpdateActiveSet((prev) => {
      const src = prev.tracks[idx];
      if (!src) return prev;
      const copy: Track = {
        ...src,
        title: `${src.title} (Copy)`,
        b2bnote: src.b2bnote ? { ...src.b2bnote } : null,
      };
      const nextTracks = [...prev.tracks];
      nextTracks.splice(idx + 1, 0, copy);
      return { ...prev, tracks: nextTracks, updatedAt: new Date().toISOString() };
    });
    setEditTrackIdx(idx + 1);
    onSelectTrackIndex(idx + 1);
  };

  const handleMoveTrack = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= activeSet.tracks.length) return;
    onUpdateActiveSet((prev) => {
      const nextTracks = [...prev.tracks];
      const [item] = nextTracks.splice(idx, 1);
      nextTracks.splice(targetIdx, 0, item);
      return { ...prev, tracks: nextTracks, updatedAt: new Date().toISOString() };
    });
    setEditTrackIdx(targetIdx);
    onSelectTrackIndex(targetIdx);
  };

  const handleDeleteTrack = (idx: number) => {
    if (activeSet.tracks.length <= 1) return;
    const nextLen = activeSet.tracks.length - 1;
    const nextFocus = Math.min(idx, nextLen - 1);
    onUpdateActiveSet((prev) => ({
      ...prev,
      tracks: prev.tracks.filter((_, i) => i !== idx),
      updatedAt: new Date().toISOString(),
    }));
    setEditTrackIdx(nextFocus);
    onSelectTrackIndex(nextFocus);
  };

  const handleChoosePersona = (id: DjPersonaId) => {
    const nextPersona = getPersonaById(id);
    const prevPersona = getPersonaById(activeSet.personaId);
    onUpdateActiveSet((prev) => ({
      ...prev,
      personaId: id,
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
  };

  const handleExportJsonFile = () => {
    const slug = activeSet.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const blob = new Blob([JSON.stringify(activeSet, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug || "storytelling-set"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusMsg({ kind: "ok", text: "Exported template JSON file." });
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(activeSet, null, 2));
      setJsonCopied(true);
      window.setTimeout(() => setJsonCopied(false), 2000);
    } catch {
      setStatusMsg({ kind: "err", text: "Clipboard unavailable; use Download .json instead." });
    }
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        const valid = parseImportedSetTemplate(parsed);
        if (!valid) {
          setStatusMsg({
            kind: "err",
            text: "Could not read a valid set template from that JSON file.",
          });
          return;
        }
        onImportSet(valid);
        setStatusMsg({ kind: "ok", text: `Loaded "${valid.name}" into your library.` });
      } catch {
        setStatusMsg({ kind: "err", text: "Invalid JSON file format." });
      }
    };
    reader.readAsText(file);
  };

  const applyBulkDeck = (raw: string) => {
    const parsed = parseArticlesDeck(raw);
    if (!parsed) {
      setStatusMsg({
        kind: "err",
        text: "Could not parse articles. Use a JSON array or CSV with at least a 'title' header column.",
      });
      return;
    }
    onUpdateActiveSet((prev) => ({
      ...prev,
      tracks: parsed,
      updatedAt: new Date().toISOString(),
    }));
    setEditTrackIdx(0);
    onSelectTrackIndex(0);
    setBulkOpen(false);
    setBulkText("");
    setStatusMsg({
      kind: "ok",
      text: `Loaded ${parsed.length} articles into "${activeSet.name}".`,
    });
  };

  const handleBulkDeckFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => applyBulkDeck(String(reader.result || ""));
    reader.readAsText(file);
  };

  const handleDownloadSampleCsv = () => {
    const csv = [
      "slot,tag,bpm,energy,title,real,author,pub,date,url,hook,hookby,why,intro",
      'OPENER,B-SIDE,118,5,"First Big Industry Read","Original Headline Here","Author Name","Substack","2026","https://www.copyflight.com/dig/","Key quote from the piece.","Author Name","Why readers need this.","Opening spin from the DJ."',
      'PEAK,HIT,142,10,"The Viral Debate","Full Episode or Essay Title","Guest Name","Podcast #100","2026","https://www.copyflight.com/dig/","The stat everyone quoted.","Guest Name","The turning point in the market.","Peak energy on the decks."',
      'CLOSER,HIT,120,6,"Where This Goes Next","Closing Essay Headline","Editor Name","Annual Letter","2026","https://www.copyflight.com/dig/","Closing takeaway line.","Editor Name","Sets up the reader next move.","Final record in the crate."',
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "article-deck-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onUpdateActiveSet((prev) => ({
          ...prev,
          brand: { ...prev.brand, logoUrl: reader.result as string },
          updatedAt: new Date().toISOString(),
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const inputClass =
    "w-full rounded-lg bg-plum-room border border-gold/25 px-3 py-2 text-sm text-cream placeholder:text-cream/40 focus:border-gold-bright focus:outline-none";
  const labelClass = "block font-mono text-xs uppercase tracking-[0.1em] text-gold mb-1";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set Builder & Brand Studio"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-6"
    >
      <div className="w-full max-w-[1140px] max-h-[92vh] flex flex-col bg-plum-surface border border-gold/35 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gold/20 bg-plum-deep">
          <div className="min-w-0">
            <h2 className="font-display font-black text-xl sm:text-2xl text-cream truncate">
              Set Builder &amp; Brand Studio
            </h2>
            <p className="text-xs sm:text-sm text-gold truncate">
              Active set: {activeSet.name} · {activeSet.tracks.length} tracks
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close studio builder"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-bold bg-plum-elevated border border-gold/35 text-cream hover:border-gold-bright whitespace-nowrap shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Done</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 px-5 py-3 border-b border-gold/15 bg-plum-room/70">
          {(
            [
              ["articles", `Articles (${activeSet.tracks.length})`],
              ["brand", "Brand & CTAs"],
              ["persona", "DJ Persona"],
              ["templates", `Templates (${sets.length})`],
            ] as [BuilderTab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tab === key
                  ? "bg-gold-bright text-ink"
                  : "bg-plum-deep text-cream/85 border border-gold/20 hover:border-gold/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {statusMsg && (
            <div
              className={`mb-5 px-4 py-3 rounded-xl border text-sm font-medium ${
                statusMsg.kind === "ok"
                  ? "bg-live/10 border-live/45 text-live"
                  : "bg-warn/10 border-warn/50 text-warn"
              }`}
            >
              {statusMsg.text}
            </div>
          )}

          {/* TAB 1: ARTICLES / TRACKS EDITOR */}
          {tab === "articles" && editedTrack && (
            <div className="space-y-4">
              {/* Bulk Import Bar for fast client deck swaps */}
              <div className="bg-plum-deep border border-gold/20 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-cream/90">
                  <strong className="text-gold-bright">Swapping a client’s full deck?</strong>{" "}
                  Upload a CSV/JSON deck file or paste rows to replace all articles at once.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadSampleCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-gold/30 text-gold hover:border-gold cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Sample CSV</span>
                  </button>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-plum-elevated border border-gold/40 text-cream hover:border-gold-bright cursor-pointer whitespace-nowrap">
                    <FileUp className="w-3.5 h-3.5 text-gold-bright" />
                    <span>Upload CSV / JSON</span>
                    <input
                      type="file"
                      accept=".csv,.json,text/csv,application/json"
                      onChange={handleBulkDeckFile}
                      className="sr-only"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setBulkOpen((v) => !v)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gold-bright text-ink hover:brightness-105 cursor-pointer whitespace-nowrap"
                  >
                    {bulkOpen ? "Hide paste box" : "Paste CSV / JSON"}
                  </button>
                </div>

                {bulkOpen && (
                  <div className="w-full pt-2 border-t border-gold/15 space-y-2.5">
                    <textarea
                      rows={5}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder="Paste CSV (with title,author,pub,url,bpm,energy,slot,hook,why,intro headers) or a JSON array of track objects..."
                      className={`${inputClass} font-mono text-xs`}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => applyBulkDeck(bulkText)}
                        disabled={!bulkText.trim()}
                        className="px-4 py-2 rounded-lg text-xs font-bold bg-gold-bright text-ink disabled:opacity-40 cursor-pointer"
                      >
                        Replace deck with pasted articles
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">
                {/* Left Crate Sequence List */}
                <div className="bg-plum-deep border border-gold/20 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-gold/15">
                    <span className="font-mono text-xs uppercase tracking-[0.12em] text-gold">
                      Crate Order
                    </span>
                    <button
                      type="button"
                      onClick={handleAddTrack}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-gold-bright text-ink hover:brightness-105 whitespace-nowrap cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add article</span>
                    </button>
                  </div>

                  <ol className="space-y-2 max-h-[52vh] overflow-y-auto pr-1">
                  {activeSet.tracks.map((t, i) => {
                    const selected = i === safeIdx;
                    return (
                      <li
                        key={i}
                        className={`rounded-lg border p-2.5 transition-colors ${
                          selected
                            ? "bg-plum-elevated border-gold-bright"
                            : "bg-plum-room/70 border-gold/15 hover:border-gold/45"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setEditTrackIdx(i);
                            onSelectTrackIndex(i);
                          }}
                          className="w-full text-left cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2 font-mono text-xs text-gold tabular-nums">
                            <span>
                              {String(i + 1).padStart(2, "0")} · {t.slot}
                            </span>
                            <span>{t.bpm} BPM</span>
                          </div>
                          <div className="font-bold text-sm text-cream truncate mt-0.5">
                            {t.title || "Untitled"}
                          </div>
                        </button>

                        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gold/10">
                          <button
                            type="button"
                            onClick={() => handleMoveTrack(i, -1)}
                            disabled={i === 0}
                            aria-label={`Move track ${i + 1} up`}
                            className="p-1.5 rounded border border-gold/20 text-cream/80 hover:border-gold disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveTrack(i, 1)}
                            disabled={i === activeSet.tracks.length - 1}
                            aria-label={`Move track ${i + 1} down`}
                            className="p-1.5 rounded border border-gold/20 text-cream/80 hover:border-gold disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateTrack(i)}
                            aria-label={`Duplicate track ${i + 1}`}
                            className="p-1.5 rounded border border-gold/20 text-cream/80 hover:border-gold cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTrack(i)}
                            disabled={activeSet.tracks.length <= 1}
                            aria-label={`Delete track ${i + 1}`}
                            className="ml-auto p-1.5 rounded border border-gold/20 text-warn hover:border-warn disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* Right Track Form */}
              <div className="bg-plum-deep border border-gold/20 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label htmlFor="edSlot" className={labelClass}>
                      Slot
                    </label>
                    <select
                      id="edSlot"
                      value={editedTrack.slot}
                      onChange={(e) =>
                        updateTrackField("slot", e.target.value as Track["slot"])
                      }
                      className={inputClass}
                    >
                      {SLOTS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="edTag" className={labelClass}>
                      Tag
                    </label>
                    <select
                      id="edTag"
                      value={editedTrack.tag}
                      onChange={(e) =>
                        updateTrackField("tag", e.target.value as Track["tag"])
                      }
                      className={inputClass}
                    >
                      <option value="HIT">HIT</option>
                      <option value="B-SIDE">B-SIDE</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="edBpm" className={labelClass}>
                      BPM
                    </label>
                    <input
                      id="edBpm"
                      type="number"
                      min={60}
                      max={200}
                      value={editedTrack.bpm}
                      onChange={(e) =>
                        updateTrackField(
                          "bpm",
                          Math.max(60, Math.min(200, Number(e.target.value) || 120))
                        )
                      }
                      className={`${inputClass} tabular-nums`}
                    />
                  </div>
                  <div>
                    <label htmlFor="edEnergy" className={labelClass}>
                      Energy (1-10)
                    </label>
                    <input
                      id="edEnergy"
                      type="number"
                      min={1}
                      max={10}
                      value={editedTrack.energy}
                      onChange={(e) =>
                        updateTrackField(
                          "energy",
                          Math.max(1, Math.min(10, Number(e.target.value) || 5))
                        )
                      }
                      className={`${inputClass} tabular-nums`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="edTitle" className={labelClass}>
                      Display Track Title
                    </label>
                    <input
                      id="edTitle"
                      type="text"
                      value={editedTrack.title}
                      onChange={(e) => updateTrackField("title", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="edReal" className={labelClass}>
                      Original Article / Episode Title
                    </label>
                    <input
                      id="edReal"
                      type="text"
                      value={editedTrack.real}
                      onChange={(e) => updateTrackField("real", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="edAuthor" className={labelClass}>
                      Author
                    </label>
                    <input
                      id="edAuthor"
                      type="text"
                      value={editedTrack.author}
                      onChange={(e) => updateTrackField("author", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="edPub" className={labelClass}>
                      Publication
                    </label>
                    <input
                      id="edPub"
                      type="text"
                      value={editedTrack.pub}
                      onChange={(e) => updateTrackField("pub", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="edDate" className={labelClass}>
                      Published Date
                    </label>
                    <input
                      id="edDate"
                      type="text"
                      value={editedTrack.date}
                      onChange={(e) => updateTrackField("date", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
                  <div>
                    <label htmlFor="edUrl" className={labelClass}>
                      Source Article URL
                    </label>
                    <input
                      id="edUrl"
                      type="url"
                      value={editedTrack.url}
                      onChange={(e) => updateTrackField("url", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 min-h-[38px] px-3 rounded-lg border border-gold/25 bg-plum-room cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editedTrack.verify}
                      onChange={(e) => updateTrackField("verify", e.target.checked)}
                      className="w-4 h-4 accent-gold-bright"
                    />
                    <span className="font-mono text-xs text-warn">[VERIFY]</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="edHook" className={labelClass}>
                      Featured Pull Quote
                    </label>
                    <textarea
                      id="edHook"
                      rows={2}
                      value={editedTrack.hook}
                      onChange={(e) => updateTrackField("hook", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="edHookBy" className={labelClass}>
                      Quote Attribution
                    </label>
                    <textarea
                      id="edHookBy"
                      rows={2}
                      value={editedTrack.hookby}
                      onChange={(e) => updateTrackField("hookby", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="edWhy" className={labelClass}>
                    Why It’s in the Set
                  </label>
                  <textarea
                    id="edWhy"
                    rows={2}
                    value={editedTrack.why}
                    onChange={(e) => updateTrackField("why", e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="edIntro" className={labelClass}>
                      DJ Spoken Intro
                    </label>
                    <textarea
                      id="edIntro"
                      rows={2}
                      value={editedTrack.intro}
                      onChange={(e) => updateTrackField("intro", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="edTrans" className={labelClass}>
                      Crossfade Transition Line
                    </label>
                    <textarea
                      id="edTrans"
                      rows={2}
                      value={editedTrack.transition || ""}
                      onChange={(e) =>
                        updateTrackField("transition", e.target.value.trim() ? e.target.value : null)
                      }
                      placeholder="Optional caption when switching onto this track"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-gold/15">
                  <label className="inline-flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={editedTrack.b2b}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        onUpdateActiveSet((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t, i) =>
                            i === safeIdx
                              ? {
                                  ...t,
                                  b2b: checked,
                                  b2bnote: checked
                                    ? t.b2bnote || {
                                        label: "B2B · Side A",
                                        text: "Add back-to-back counterpoint note.",
                                      }
                                    : null,
                                }
                              : t
                          ),
                          updatedAt: new Date().toISOString(),
                        }));
                      }}
                      className="w-4 h-4 accent-gold-bright"
                    />
                    <span className="font-mono text-xs uppercase tracking-[0.1em] text-gold">
                      Include Back-to-Back (B2B) Counterpoint Note
                    </span>
                  </label>

                  {editedTrack.b2b && editedTrack.b2bnote && (
                    <div className="grid grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)] gap-3">
                      <input
                        type="text"
                        aria-label="B2B label"
                        value={editedTrack.b2bnote.label}
                        onChange={(e) =>
                          updateTrackField("b2bnote", {
                            ...editedTrack.b2bnote!,
                            label: e.target.value,
                          })
                        }
                        className={inputClass}
                      />
                      <input
                        type="text"
                        aria-label="B2B note text"
                        value={editedTrack.b2bnote.text}
                        onChange={(e) =>
                          updateTrackField("b2bnote", {
                            ...editedTrack.b2bnote!,
                            text: e.target.value,
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>
          )}

          {/* TAB 2: BRANDING, PALETTE & CTAS */}
          {tab === "brand" && (
            <div className="space-y-6">
              <div className="bg-plum-deep border border-gold/20 rounded-xl p-4 sm:p-5 space-y-4">
                <h3 className="font-display font-bold text-lg text-cream">
                  Brand Identity &amp; Hero Copy
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="bName" className={labelClass}>
                      Brand / Wordmark
                    </label>
                    <input
                      id="bName"
                      type="text"
                      value={activeSet.brand.companyName}
                      onChange={(e) =>
                        onUpdateActiveSet((prev) => ({
                          ...prev,
                          brand: { ...prev.brand, companyName: e.target.value },
                        }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="bSite" className={labelClass}>
                      Brand Website URL
                    </label>
                    <input
                      id="bSite"
                      type="url"
                      value={activeSet.brand.companyWebsiteUrl}
                      onChange={(e) =>
                        onUpdateActiveSet((prev) => ({
                          ...prev,
                          brand: { ...prev.brand, companyWebsiteUrl: e.target.value },
                        }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="bIndustry" className={labelClass}>
                      Industry / Vertical Label
                    </label>
                    <input
                      id="bIndustry"
                      type="text"
                      value={activeSet.industry}
                      onChange={(e) =>
                        onUpdateActiveSet((prev) => ({ ...prev, industry: e.target.value }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="bKicker" className={labelClass}>
                      Hero Kicker Line
                    </label>
                    <input
                      id="bKicker"
                      type="text"
                      value={activeSet.brand.kicker}
                      onChange={(e) =>
                        onUpdateActiveSet((prev) => ({
                          ...prev,
                          brand: { ...prev.brand, kicker: e.target.value },
                        }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="bCurator" className={labelClass}>
                      Curator Line
                    </label>
                    <input
                      id="bCurator"
                      type="text"
                      value={activeSet.brand.curatorLine}
                      onChange={(e) =>
                        onUpdateActiveSet((prev) => ({
                          ...prev,
                          brand: {
                            ...prev.brand,
                            curatorLine: e.target.value,
                            curatorShort: e.target.value,
                          },
                        }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="bTitleLead" className={labelClass}>
                      Set Title Lead
                    </label>
                    <input
                      id="bTitleLead"
                      type="text"
                      value={activeSet.brand.setTitleLead}
                      onChange={(e) =>
                        onUpdateActiveSet((prev) => ({
                          ...prev,
                          brand: { ...prev.brand, setTitleLead: e.target.value },
                        }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="bTitleAcc" className={labelClass}>
                      Italic Accent Word
                    </label>
                    <input
                      id="bTitleAcc"
                      type="text"
                      value={activeSet.brand.setTitleAccent}
                      onChange={(e) =>
                        onUpdateActiveSet((prev) => ({
                          ...prev,
                          brand: { ...prev.brand, setTitleAccent: e.target.value },
                        }))
                      }
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="pt-3 border-t border-gold/15 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {activeSet.brand.logoUrl ? (
                      <div className="h-10 px-3 rounded-lg bg-plum-room border border-gold/30 flex items-center">
                        <img
                          src={activeSet.brand.logoUrl}
                          alt={`${activeSet.brand.companyName} logo preview`}
                          className="max-h-7 w-auto object-contain"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-cream/75">
                        Header logo: using default mark
                      </span>
                    )}

                    <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold bg-plum-elevated border border-gold/40 text-cream hover:border-gold-bright cursor-pointer whitespace-nowrap">
                      <FileUp className="w-3.5 h-3.5 text-gold-bright" />
                      <span>Upload client logo (PNG/SVG)</span>
                      <input
                        type="file"
                        accept="image/png,image/svg+xml,image/jpeg,image/webp"
                        onChange={handleLogoUpload}
                        className="sr-only"
                      />
                    </label>

                    {activeSet.brand.logoUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateActiveSet((prev) => ({
                            ...prev,
                            brand: { ...prev.brand, logoUrl: "" },
                          }))
                        }
                        className="text-xs font-mono text-gold hover:text-gold-bright underline cursor-pointer"
                      >
                        Remove logo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-plum-deep border border-gold/20 rounded-xl p-4 sm:p-5 space-y-4">
                <h3 className="font-display font-bold text-lg text-cream">
                  Theme Palette (UI + 3D Studio Lighting)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {BRAND_THEMES.map((preset) => {
                    const selected = activeSet.brand.themePresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          onUpdateActiveSet((prev) => ({
                            ...prev,
                            brand: {
                              ...prev.brand,
                              themePresetId: preset.id,
                              customAccentHex: "",
                              customBgHex: "",
                            },
                          }))
                        }
                        className={`flex flex-col items-start gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          selected
                            ? "border-gold-bright bg-plum-elevated"
                            : "border-gold/20 bg-plum-room hover:border-gold/50"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-5 h-5 rounded-full border border-white/20"
                            style={{ backgroundColor: preset.deep }}
                          />
                          <span
                            className="w-5 h-5 rounded-full border border-white/20"
                            style={{ backgroundColor: preset.surface }}
                          />
                          <span
                            className="w-5 h-5 rounded-full border border-white/20"
                            style={{ backgroundColor: preset.accentBright }}
                          />
                        </div>
                        <span className="text-sm font-bold text-cream">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-2">
                  <label className="inline-flex items-center gap-2.5 text-sm text-cream cursor-pointer">
                    <input
                      type="color"
                      value={
                        activeSet.brand.customBgHex ||
                        BRAND_THEMES.find((t) => t.id === activeSet.brand.themePresetId)?.deep ||
                        "#21142f"
                      }
                      onChange={(e) =>
                        onUpdateActiveSet((prev) => ({
                          ...prev,
                          brand: { ...prev.brand, customBgHex: e.target.value },
                        }))
                      }
                      className="w-9 h-9 rounded border border-gold/40 bg-transparent cursor-pointer"
                    />
                    <span>Custom Base Dark Hex</span>
                  </label>

                  <label className="inline-flex items-center gap-2.5 text-sm text-cream cursor-pointer">
                    <input
                      type="color"
                      value={
                        activeSet.brand.customAccentHex ||
                        BRAND_THEMES.find((t) => t.id === activeSet.brand.themePresetId)
                          ?.accentBright ||
                        "#e5bb71"
                      }
                      onChange={(e) =>
                        onUpdateActiveSet((prev) => ({
                          ...prev,
                          brand: { ...prev.brand, customAccentHex: e.target.value },
                        }))
                      }
                      className="w-9 h-9 rounded border border-gold/40 bg-transparent cursor-pointer"
                    />
                    <span>Custom Brand Accent Hex</span>
                  </label>

                  {(activeSet.brand.customAccentHex || activeSet.brand.customBgHex) && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateActiveSet((prev) => ({
                          ...prev,
                          brand: { ...prev.brand, customAccentHex: "", customBgHex: "" },
                        }))
                      }
                      className="text-xs font-mono text-gold hover:text-gold-bright underline cursor-pointer"
                    >
                      Clear custom hexes
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-plum-deep border border-gold/20 rounded-xl p-4 sm:p-5 space-y-4">
                <h3 className="font-display font-bold text-lg text-cream">
                  CTAs &amp; Liner Notes Copy
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="bCtaLabel" className={labelClass}>
                      Primary CTA Button Label
                    </label>
                    <input
                      id="bCtaLabel"
                      type="text"
                      value={activeSet.brand.ctaLabel}
                      onChange={(e) =>
                        onUpdateActiveSet((prev) => ({
                          ...prev,
                          brand: { ...prev.brand, ctaLabel: e.target.value },
                        }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="bCtaUrl" className={labelClass}>
                      Primary CTA Destination URL
                    </label>
                    <input
                      id="bCtaUrl"
                      type="url"
                      value={activeSet.brand.ctaUrl}
                      onChange={(e) =>
                        onUpdateActiveSet((prev) => ({
                          ...prev,
                          brand: { ...prev.brand, ctaUrl: e.target.value },
                        }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="bFinalHead" className={labelClass}>
                      Final CTA Heading
                    </label>
                    <input
                      id="bFinalHead"
                      type="text"
                      value={activeSet.brand.finalCtaHeading}
                      onChange={(e) =>
                        onUpdateActiveSet((prev) => ({
                          ...prev,
                          brand: { ...prev.brand, finalCtaHeading: e.target.value },
                        }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="bLinerSign" className={labelClass}>
                      Curation Sign-Off
                    </label>
                    <input
                      id="bLinerSign"
                      type="text"
                      value={activeSet.linerNotes.curationSignOff}
                      onChange={(e) =>
                        onUpdateActiveSet((prev) => ({
                          ...prev,
                          linerNotes: { ...prev.linerNotes, curationSignOff: e.target.value },
                        }))
                      }
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="bFinalBody" className={labelClass}>
                    Final CTA Body
                  </label>
                  <textarea
                    id="bFinalBody"
                    rows={2}
                    value={activeSet.brand.finalCtaBody}
                    onChange={(e) =>
                      onUpdateActiveSet((prev) => ({
                        ...prev,
                        brand: { ...prev.brand, finalCtaBody: e.target.value },
                      }))
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="bSummary" className={labelClass}>
                    Liner Notes Thesis
                  </label>
                  <textarea
                    id="bSummary"
                    rows={3}
                    value={activeSet.linerNotes.summary}
                    onChange={(e) =>
                      onUpdateActiveSet((prev) => ({
                        ...prev,
                        linerNotes: { ...prev.linerNotes, summary: e.target.value },
                      }))
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="bCurationNote" className={labelClass}>
                    How This Set Was Picked
                  </label>
                  <textarea
                    id="bCurationNote"
                    rows={2}
                    value={activeSet.linerNotes.curationNote}
                    onChange={(e) =>
                      onUpdateActiveSet((prev) => ({
                        ...prev,
                        linerNotes: { ...prev.linerNotes, curationNote: e.target.value },
                      }))
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="bPromo" className={labelClass}>
                    Custom Share Message (Optional — overrides auto-generated promo copy)
                  </label>
                  <textarea
                    id="bPromo"
                    rows={3}
                    value={activeSet.linerNotes.promoBlurb}
                    onChange={(e) =>
                      onUpdateActiveSet((prev) => ({
                        ...prev,
                        linerNotes: { ...prev.linerNotes, promoBlurb: e.target.value },
                      }))
                    }
                    placeholder="Leave blank to auto-generate promotional text from your brand & track count"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DJ PERSONA PICKER */}
          {tab === "persona" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {DJ_PERSONAS.map((persona) => {
                  const selected = activeSet.personaId === persona.id;
                  return (
                    <button
                      key={persona.id}
                      type="button"
                      onClick={() => handleChoosePersona(persona.id)}
                      aria-pressed={selected}
                      className={`flex flex-col text-left rounded-2xl border overflow-hidden transition-all cursor-pointer ${
                        selected
                          ? "bg-plum-elevated border-gold-bright shadow-[0_0_24px_rgba(229,187,113,0.22)]"
                          : "bg-plum-deep border-gold/20 hover:border-gold/55"
                      }`}
                    >
                      <div className="aspect-[4/3] w-full bg-plum-room overflow-hidden border-b border-gold/15">
                        <img
                          src={persona.boothUrl}
                          alt={`${persona.name} at the turntables`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover object-top"
                        />
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display font-bold text-xl text-cream">
                            {persona.name}
                          </span>
                          {selected && (
                            <span className="font-mono text-xs uppercase tracking-[0.1em] text-gold-bright font-bold">
                              Active
                            </span>
                          )}
                        </div>
                        <span className="block font-mono text-xs text-gold mt-0.5">
                          {persona.role}
                        </span>
                        <p className="text-sm text-cream/85 mt-2">{persona.vibe}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="bg-plum-deep border border-gold/20 rounded-xl p-4 sm:p-5 space-y-4">
                <h3 className="font-display font-bold text-lg text-cream">
                  Host Script Lines
                </h3>
                <div>
                  <label htmlFor="pWelcome" className={labelClass}>
                    Hero Welcome Quote
                  </label>
                  <textarea
                    id="pWelcome"
                    rows={2}
                    value={activeSet.hostWelcome}
                    onChange={(e) =>
                      onUpdateActiveSet((prev) => ({ ...prev, hostWelcome: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="pSignOff" className={labelClass}>
                    Liner Notes Sign-Off Quote
                  </label>
                  <textarea
                    id="pSignOff"
                    rows={2}
                    value={activeSet.hostSignOff}
                    onChange={(e) =>
                      onUpdateActiveSet((prev) => ({ ...prev, hostSignOff: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TEMPLATES LIBRARY & JSON PORTABILITY */}
          {tab === "templates" && (
            <div className="space-y-6">
              {/* Duplicate Active Set */}
              <div className="bg-plum-deep border border-gold/20 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display font-bold text-lg text-cream">
                      Duplicate for Another Industry or Client
                    </h3>
                    <p className="text-sm text-cream/80">
                      Clone the current crate and brand settings into a fresh editable set, or spin up a 5-track starter prototype.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onCreateStarterSet();
                      setStatusMsg({
                        kind: "ok",
                        text: "Created a fresh Industry Starter Prototype in your library.",
                      });
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-plum-elevated border border-gold/45 text-cream hover:border-gold-bright whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-gold-bright" />
                    <span>New blank industry prototype</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-3 items-end">
                  <div>
                    <label htmlFor="dupName" className={labelClass}>
                      New Set Name
                    </label>
                    <input
                      id="dupName"
                      type="text"
                      value={dupName}
                      onChange={(e) => setDupName(e.target.value)}
                      placeholder="e.g. 2026 Fintech GTM Set"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="dupInd" className={labelClass}>
                      Industry / Client
                    </label>
                    <input
                      id="dupInd"
                      type="text"
                      value={dupIndustry}
                      onChange={(e) => setDupIndustry(e.target.value)}
                      placeholder="e.g. B2B Fintech"
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onDuplicateSet(
                        dupName.trim() || `${activeSet.name} (Copy)`,
                        dupIndustry.trim() || activeSet.industry
                      );
                      setStatusMsg({
                        kind: "ok",
                        text: `Duplicated "${dupName.trim() || activeSet.name}".`,
                      });
                    }}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold bg-gold-bright text-ink hover:brightness-105 whitespace-nowrap cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Duplicate active set</span>
                  </button>
                </div>
              </div>

              {/* Saved Sets List */}
              <div className="bg-plum-deep border border-gold/20 rounded-xl p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display font-bold text-lg text-cream">Saved Set Library</h3>
                  <button
                    type="button"
                    onClick={() => {
                      onResetDefaultSet();
                      setStatusMsg({
                        kind: "ok",
                        text: "Restored the original 2026 Business Storytelling Set.",
                      });
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-gold hover:text-gold-bright cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore Copyflight 2026 default</span>
                  </button>
                </div>

                <div className="grid gap-2.5">
                  {sets.map((s) => {
                    const isCurrent = s.id === activeSet.id;
                    const host = getPersonaById(s.personaId);
                    const isCoreDefault = s.id === "copyflight-2026-storytelling";
                    return (
                      <div
                        key={s.id}
                        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 ${
                          isCurrent
                            ? "bg-plum-elevated border-gold-bright"
                            : "bg-plum-room/70 border-gold/20"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-base text-cream truncate">{s.name}</div>
                          <div className="font-mono text-xs text-gold mt-0.5 tabular-nums">
                            {s.brand.companyName} · {s.industry} · {s.tracks.length} tracks · DJ{" "}
                            {host.name}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectSet(s.id)}
                            disabled={isCurrent}
                            className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer ${
                              isCurrent
                                ? "bg-live/20 text-live border border-live/40 cursor-default"
                                : "bg-gold-bright text-ink hover:brightness-105"
                            }`}
                          >
                            {isCurrent ? "Active" : "Load set"}
                          </button>

                          {!isCoreDefault && sets.length > 1 && (
                            <button
                              type="button"
                              onClick={() => onDeleteSet(s.id)}
                              aria-label={`Delete ${s.name}`}
                              className="p-2 rounded-lg border border-gold/25 text-warn hover:border-warn cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Export / Import Portable JSON */}
              <div className="bg-plum-deep border border-gold/20 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-display font-bold text-lg text-cream">
                    Export or Import Portable Template (.json)
                  </h3>
                  <p className="text-sm text-cream/80">
                    Back up a client’s branded set or swap JSON templates between sessions.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleExportJsonFile}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-plum-elevated border border-gold/40 text-cream hover:border-gold-bright whitespace-nowrap cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-gold-bright" />
                    <span>Download .json</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-plum-elevated border border-gold/40 text-cream hover:border-gold-bright whitespace-nowrap cursor-pointer"
                  >
                    {jsonCopied ? (
                      <Check className="w-4 h-4 text-live" />
                    ) : (
                      <Copy className="w-4 h-4 text-gold-bright" />
                    )}
                    <span>{jsonCopied ? "Copied JSON" : "Copy JSON"}</span>
                  </button>

                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-gold-bright text-ink hover:brightness-105 whitespace-nowrap cursor-pointer">
                    <FileUp className="w-4 h-4" />
                    <span>Import .json</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleImportJsonFile}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
