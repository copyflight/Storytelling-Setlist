import { Track } from "../data/tracks";
import { AssetDB, LS } from "./storage";

export interface AudioState {
  hasCustomTrack: boolean;
  trackName: string;
  volume: number;
  grooveLabel: string;
}

type GrooveStyle = "funk" | "pop" | "peak" | "slow" | "closer";

interface SlotArrangement {
  label: string;
  style: GrooveStyle;
  /** 4-bar chord progression (MIDI note arrays) */
  chords: number[][];
  /** Bass root MIDI notes per bar */
  bassRoots: number[];
  /** Effective step BPM (halves ultra-high BPMs like 180 for natural pocket) */
  effectiveBpm: number;
  swing: number; // 0..0.06
}

const ARRANGEMENTS: Record<Track["slot"], SlotArrangement> = {
  OPENER: {
    label: "Warm Pocket Funk",
    style: "funk",
    // Am9 -> Fmaj7 -> Dm9 -> E7#9
    chords: [
      [57, 60, 64, 67, 71],
      [53, 57, 60, 64, 69],
      [50, 53, 57, 60, 64],
      [52, 56, 59, 62, 67],
    ],
    bassRoots: [45, 41, 38, 40],
    effectiveBpm: 112,
    swing: 0.035,
  },
  BUILD: {
    label: "Upbeat Nu-Disco Pop",
    style: "pop",
    // Cmaj9 -> Am7 -> Fmaj7 -> G6
    chords: [
      [60, 64, 67, 71, 74],
      [57, 60, 64, 67, 72],
      [53, 57, 60, 64, 69],
      [55, 59, 62, 64, 67],
    ],
    bassRoots: [36, 45, 41, 43],
    effectiveBpm: 124,
    swing: 0.0,
  },
  PEAK: {
    label: "High-Energy Electro Funk",
    style: "peak",
    // Em9 -> Gmaj7 -> Cmaj9 -> B7alt
    chords: [
      [52, 55, 59, 62, 66],
      [55, 59, 62, 66, 71],
      [60, 64, 67, 71, 74],
      [59, 63, 66, 69, 75],
    ],
    bassRoots: [40, 43, 36, 35],
    effectiveBpm: 130,
    swing: 0.01,
  },
  B2B: {
    label: "Syncopated Brass Funk",
    style: "funk",
    // Dm9 -> G13 -> Bbmaj7 -> A7#9
    chords: [
      [50, 53, 57, 60, 64],
      [55, 59, 62, 65, 69],
      [58, 62, 65, 69, 72],
      [57, 61, 64, 67, 72],
    ],
    bassRoots: [38, 43, 46, 45],
    effectiveBpm: 118,
    swing: 0.03,
  },
  COOLDOWN: {
    label: "Slow Late-Night Soul",
    style: "slow",
    // Bbmaj7 -> Gm9 -> Ebmaj7 -> F13
    chords: [
      [58, 62, 65, 69, 72],
      [55, 58, 62, 65, 69],
      [51, 55, 58, 62, 67],
      [53, 57, 60, 63, 67],
    ],
    bassRoots: [46, 43, 39, 41],
    effectiveBpm: 82,
    swing: 0.045,
  },
  CLOSER: {
    label: "Golden-Hour Synth Pop",
    style: "closer",
    // Fmaj9 -> G6 -> Em7 -> Am9
    chords: [
      [53, 57, 60, 64, 67],
      [55, 59, 62, 64, 67],
      [52, 55, 59, 62, 67],
      [57, 60, 64, 67, 71],
    ],
    bassRoots: [41, 43, 40, 45],
    effectiveBpm: 116,
    swing: 0.0,
  },
};

const midiToHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

class StudioAudioEngine {
  private audioEl: HTMLAudioElement;
  private objectUrl: string | null = null;
  private hasCustom = false;
  private trackName = "";
  private volume = 0.7;
  private bpm = 120;
  private slot: Track["slot"] = "OPENER";
  private playing = false;
  private soundOn = false;

  // Web Audio API graph
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private freqBuffer: Uint8Array<ArrayBuffer> | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // 16th-note groove scheduler
  private beatTimer: number | null = null;
  private nextStepTime = 0;
  private step16 = 0;

  private onChangeListeners = new Set<(state: AudioState) => void>();

  constructor() {
    this.audioEl = new Audio();
    this.audioEl.loop = true;
    this.audioEl.preload = "auto";
    this.audioEl.crossOrigin = "anonymous";

    const savedVol = LS.get("vol");
    if (savedVol !== null) {
      const parsed = Number(savedVol);
      if (!Number.isNaN(parsed)) {
        this.volume = Math.max(0, Math.min(1, parsed / 100));
      }
    }
    this.audioEl.volume = this.volume;
  }

  public subscribe(listener: (state: AudioState) => void): () => void {
    this.onChangeListeners.add(listener);
    listener(this.getState());
    return () => {
      this.onChangeListeners.delete(listener);
    };
  }

  private emit(): void {
    const snapshot = this.getState();
    this.onChangeListeners.forEach((fn) => fn(snapshot));
  }

  public getState(): AudioState {
    return {
      hasCustomTrack: this.hasCustom,
      trackName: this.trackName,
      volume: Math.round(this.volume * 100),
      grooveLabel: ARRANGEMENTS[this.slot].label,
    };
  }

  public async init(): Promise<void> {
    const rec = await AssetDB.get("music");
    if (rec && rec.blob) {
      this.useBlob(rec.blob, rec.name || "your track");
    }
  }

  private ensureAudioContext(): void {
    if (this.ctx) return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -16;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.16;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 64;
    this.analyser.smoothingTimeConstant = 0.72;
    this.freqBuffer = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Pre-build reusable 1-second white noise buffer for snares/hats/shakers
    const len = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = Math.random() * 2 - 1;
    }

    try {
      this.mediaSource = this.ctx.createMediaElementSource(this.audioEl);
      this.mediaSource.connect(this.masterGain);
    } catch {
      // Ignore if already attached
    }
  }

  private useBlob(blob: Blob, label: string): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
    }
    this.objectUrl = URL.createObjectURL(blob);
    this.audioEl.src = this.objectUrl;
    this.audioEl.load();
    this.hasCustom = true;
    this.trackName = label;
    this.audioEl.volume = this.volume;
    this.emit();
    this.syncPlayback();
  }

  public async loadFile(file: File): Promise<void> {
    this.useBlob(file, file.name);
    await AssetDB.put("music", { blob: file, name: file.name });
  }

  public async clearFile(): Promise<void> {
    this.audioEl.pause();
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.audioEl.removeAttribute("src");
    this.audioEl.load();
    this.hasCustom = false;
    this.trackName = "";
    await AssetDB.del("music");
    this.emit();
    this.syncPlayback();
  }

  public setVolume(pct: number): void {
    this.volume = Math.max(0, Math.min(1, pct / 100));
    this.audioEl.volume = this.volume;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
    LS.set("vol", String(Math.round(pct)));
    this.emit();
  }

  public setTrackProfile(bpm: number, slot: Track["slot"]): void {
    const slotChanged = this.slot !== slot;
    this.bpm = bpm;
    this.slot = slot;
    if (slotChanged) {
      this.step16 = 0;
      this.emit();
    }
  }

  public setPlayback(playing: boolean, soundOn: boolean): void {
    this.playing = playing;
    this.soundOn = soundOn;
    this.syncPlayback();
  }

  private syncPlayback(): void {
    if (this.playing && this.soundOn) {
      this.ensureAudioContext();
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      if (this.hasCustom) {
        this.stopGroove();
        this.audioEl.play().catch(() => {});
      } else {
        this.audioEl.pause();
        this.startGroove();
      }
    } else {
      this.audioEl.pause();
      this.stopGroove();
    }
  }

  private startGroove(): void {
    if (!this.ctx || !this.masterGain) return;
    if (this.beatTimer !== null) return;
    this.nextStepTime = this.ctx.currentTime + 0.04;
    this.beatTimer = window.setInterval(() => this.scheduleSteps(), 50);
  }

  private stopGroove(): void {
    if (this.beatTimer !== null) {
      window.clearInterval(this.beatTimer);
      this.beatTimer = null;
    }
  }

  private scheduleSteps(): void {
    if (!this.ctx || !this.masterGain) return;
    const arr = ARRANGEMENTS[this.slot];
    const sixteenth = 60 / arr.effectiveBpm / 4;

    while (this.nextStepTime < this.ctx.currentTime + 0.18) {
      const stepInBar = this.step16 % 16;
      const barIndex = Math.floor(this.step16 / 16) % arr.chords.length;
      const swingOffset = stepInBar % 2 === 1 ? sixteenth * arr.swing : 0;
      const t = this.nextStepTime + swingOffset;

      this.playBarStep(arr, barIndex, stepInBar, t, sixteenth);

      this.nextStepTime += sixteenth;
      this.step16++;
    }
  }

  private playBarStep(
    arr: SlotArrangement,
    barIdx: number,
    step: number,
    t: number,
    sixteenth: number
  ): void {
    const chord = arr.chords[barIdx];
    const root = arr.bassRoots[barIdx];

    if (arr.style === "slow") {
      // Slow soulful R&B / lo-fi groove
      if (step === 0 || step === 7 || step === 10) {
        this.triggerKick(t, step === 0 ? 0.34 : 0.2, 42);
      }
      if (step === 4 || step === 12) {
        this.triggerRimshot(t, 0.14);
      }
      if (step % 2 === 0) {
        this.triggerHat(t, step % 4 === 0 ? 0.04 : 0.025, 0.05);
      }
      if (step === 0) {
        this.triggerRhodesChord(t, chord, sixteenth * 14, 0.065);
        this.triggerBass(t, root, sixteenth * 7, 0.24, 340);
      }
      if (step === 10) {
        this.triggerBass(t, root + 7, sixteenth * 4, 0.18, 320);
      }
      return;
    }

    if (arr.style === "pop" || arr.style === "closer") {
      // Upbeat Nu-Disco / Synth-Pop four-on-the-floor
      if (step % 4 === 0) {
        this.triggerKick(t, 0.38, 46);
      }
      if (step === 4 || step === 12) {
        this.triggerClapSnare(t, 0.14);
      }
      if (step % 2 === 1) {
        // Off-beat open disco hat lift
        this.triggerHat(t, 0.075, 0.095);
      } else {
        this.triggerHat(t, 0.032, 0.03);
      }

      // Driving octave disco bassline
      if (step % 2 === 0) {
        const isOctave = step === 2 || step === 6 || step === 10 || step === 14;
        const note = isOctave ? root + 12 : step === 12 ? root + 7 : root;
        this.triggerBass(t, note, sixteenth * 1.4, 0.24, 620);
      }

      // Bright Rhodes / synth stabs
      if (step === 0 || step === 6 || step === 10) {
        this.triggerRhodesChord(t, chord, sixteenth * (step === 0 ? 5.5 : 3.2), 0.055);
      }
      if (arr.style === "closer" && step % 4 === 2) {
        const arpNote = chord[(step / 2) % chord.length] + 12;
        this.triggerPluck(t, arpNote, sixteenth * 1.8, 0.045);
      }
      return;
    }

    if (arr.style === "peak") {
      // High-energy driving electro-funk
      if (step === 0 || step === 4 || step === 8 || step === 11 || step === 14) {
        this.triggerKick(t, step % 4 === 0 ? 0.42 : 0.26, 48);
      }
      if (step === 4 || step === 12) {
        this.triggerClapSnare(t, 0.18);
      }
      this.triggerHat(t, step % 4 === 2 ? 0.065 : 0.03, step % 4 === 2 ? 0.07 : 0.03);

      // Driving syncopated bass
      if (step === 0 || step === 3 || step === 6 || step === 8 || step === 10 || step === 14) {
        const note = step === 10 ? root + 10 : step === 14 ? root + 12 : root;
        this.triggerBass(t, note, sixteenth * 1.6, 0.27, 780);
      }
      if (step === 0 || step === 6 || step === 12) {
        this.triggerFunkStab(t, chord, sixteenth * 2.2, 0.055);
      }
      if (step === 2 || step === 9 || step === 15) {
        this.triggerPluck(t, chord[2] + 12, sixteenth * 1.3, 0.045);
      }
      return;
    }

    // Default: "funk" (Opener & B2B) — tight syncopated funk pocket
    if (step === 0 || step === 6 || step === 8 || step === 14) {
      this.triggerKick(t, step === 0 ? 0.38 : 0.25, 45);
    }
    if (step === 4 || step === 12) {
      this.triggerClapSnare(t, 0.15);
    }
    if (step === 7 || step === 15) {
      // Ghost snare tap
      this.triggerRimshot(t, 0.06);
    }
    this.triggerHat(t, step % 2 === 0 ? 0.045 : 0.025, 0.038);

    // Funky slap/synth bassline (root, b7, octave, fifth)
    if (step === 0 || step === 3 || step === 6 || step === 10 || step === 12 || step === 14) {
      const offset =
        step === 10 ? 10 : step === 12 ? 12 : step === 14 ? 7 : 0;
      this.triggerBass(t, root + offset, sixteenth * 1.5, 0.25, 680);
    }
    if (step === 0) {
      this.triggerRhodesChord(t, chord, sixteenth * 8, 0.052);
    }
    if (step === 6 || step === 11 || step === 14) {
      this.triggerFunkStab(t, chord.slice(1, 4), sixteenth * 1.4, 0.05);
    }
  }

  private triggerKick(time: number, gainAmt: number, floorHz: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(128, time);
    osc.frequency.exponentialRampToValueAtTime(floorHz, time + 0.11);
    gain.gain.setValueAtTime(gainAmt, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.24);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.26);
  }

  private triggerClapSnare(time: number, gainAmt: number): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    // Crisp filtered noise burst
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1850;
    filter.Q.value = 0.85;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainAmt, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(time);
    src.stop(time + 0.14);

    // Subtle body thump
    const osc = this.ctx.createOscillator();
    const oGain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(190, time);
    osc.frequency.exponentialRampToValueAtTime(110, time + 0.07);
    oGain.gain.setValueAtTime(gainAmt * 0.5, time);
    oGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
    osc.connect(oGain);
    oGain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  private triggerRimshot(time: number, gainAmt: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(420, time);
    osc.frequency.exponentialRampToValueAtTime(240, time + 0.035);
    gain.gain.setValueAtTime(gainAmt, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  private triggerHat(time: number, gainAmt: number, dur: number): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7200;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainAmt, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(time);
    src.stop(time + dur + 0.01);
  }

  private triggerBass(
    time: number,
    midi: number,
    dur: number,
    gainAmt: number,
    cutoff: number
  ): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    const freq = midiToHz(midi);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, time);
    sub.type = "sine";
    sub.frequency.setValueAtTime(freq, time);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff * 1.6, time);
    filter.frequency.exponentialRampToValueAtTime(cutoff * 0.45, time + dur);
    filter.Q.value = 2.4;

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(gainAmt, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    sub.start(time);
    osc.stop(time + dur + 0.02);
    sub.stop(time + dur + 0.02);
  }

  private triggerRhodesChord(
    time: number,
    notes: number[],
    dur: number,
    perNoteGain: number
  ): void {
    if (!this.ctx || !this.masterGain) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1450, time);
    filter.frequency.exponentialRampToValueAtTime(680, time + dur);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, time);
    env.gain.linearRampToValueAtTime(perNoteGain, time + 0.035);
    env.gain.exponentialRampToValueAtTime(0.001, time + dur);

    filter.connect(env);
    env.connect(this.masterGain);

    notes.forEach((m, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = idx % 2 === 0 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(midiToHz(m), time);
      osc.detune.setValueAtTime(idx % 2 === 0 ? -4 : 4, time);
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + dur + 0.03);
    });
  }

  private triggerFunkStab(
    time: number,
    notes: number[],
    dur: number,
    perNoteGain: number
  ): void {
    if (!this.ctx || !this.masterGain) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1550, time);
    filter.Q.value = 1.4;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, time);
    env.gain.linearRampToValueAtTime(perNoteGain, time + 0.008);
    env.gain.exponentialRampToValueAtTime(0.001, time + dur);

    filter.connect(env);
    env.connect(this.masterGain);

    notes.forEach((m) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(midiToHz(m), time);
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + dur + 0.02);
    });
  }

  private triggerPluck(time: number, midi: number, dur: number, gainAmt: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(midiToHz(midi), time);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200, time);
    filter.frequency.exponentialRampToValueAtTime(600, time + dur);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(gainAmt, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  public sampleLevels(timeSec: number): [number, number, number] {
    if (this.playing && this.soundOn && this.analyser && this.freqBuffer) {
      this.analyser.getByteFrequencyData(this.freqBuffer);
      let bass = 0;
      let mid = 0;
      let high = 0;
      const len = this.freqBuffer.length;
      for (let i = 0; i < 4 && i < len; i++) bass += this.freqBuffer[i];
      for (let i = 4; i < 12 && i < len; i++) mid += this.freqBuffer[i];
      for (let i = 12; i < 24 && i < len; i++) high += this.freqBuffer[i];
      const b = Math.min(1, bass / (4 * 200));
      const m = Math.min(1, mid / (8 * 165));
      const h = Math.min(1, high / (12 * 135));
      if (b + m + h > 0.02) {
        return [b, m, h];
      }
    }

    if (!this.playing) return [0, 0, 0];
    const beat = this.bpm / 60;
    const phase = (timeSec * beat) % 1;
    const kick = Math.pow(Math.max(0, 1 - phase * 2.4), 2);
    const offPhase = (timeSec * beat + 0.5) % 1;
    const snare = Math.pow(Math.max(0, 1 - offPhase * 3.0), 2);
    const hat = 0.28 + 0.25 * Math.abs(Math.sin(timeSec * beat * Math.PI * 2));
    return [0.25 + 0.72 * kick, 0.22 + 0.65 * snare, hat];
  }
}

export const audioEngine = new StudioAudioEngine();
