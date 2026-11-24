import { Track, TRACKS } from "./tracks";

export type DjPersonaId = "marlowe" | "julian" | "sora";

export interface DjPersona {
  id: DjPersonaId;
  name: string;
  role: string;
  vibe: string;
  boothUrl: string;
  avatarUrl: string;
  defaultWelcome: string;
  defaultSignOff: string;
}

export const DJ_PERSONAS: DjPersona[] = [
  {
    id: "marlowe",
    name: "Marlowe",
    role: "Late-Night Storyteller",
    vibe: "Warm, incisive vinyl curator in deep plum & brushed brass.",
    boothUrl: "/src/assets/images/marlowe_dj_hands_wide_1795554088018.jpg",
    avatarUrl: "/src/assets/images/marlowe_dj_portrait_1795553950975.jpg",
    defaultWelcome:
      "You made it. Todd E Jones stacked the crate with nine stories from 2026 — I’m Marlowe, and I’ll play them for you.",
    defaultSignOff:
      "That’s the last record. The rest is yours to tell. I’m Marlowe — goodnight.",
  },
  {
    id: "julian",
    name: "Julian",
    role: "Executive Vinyl Selector",
    vibe: "Measured, sharp boardroom-to-afterhours selector in tailored charcoal & gold.",
    boothUrl: "/src/assets/images/julian_dj_hands_wide_1795555659861.jpg",
    avatarUrl: "/src/assets/images/julian_dj_portrait_1795555660053.jpg",
    defaultWelcome:
      "Pull up a chair. I’m Julian — I’ve cued up the sharpest reads in the crate, sequenced to build from first insight to closing argument.",
    defaultSignOff:
      "Needle’s up on the final groove. Take what resonated into tomorrow’s room. I’m Julian — see you next set.",
  },
  {
    id: "sora",
    name: "Sora",
    role: "Editorial Precision Selector",
    vibe: "Crisp, modern tastemaker blending tight pacing with deep focus.",
    boothUrl: "/src/assets/images/sora_dj_hands_wide_1795555662038.jpg",
    avatarUrl: "/src/assets/images/sora_dj_portrait_1795555661940.jpg",
    defaultWelcome:
      "Welcome to the booth. I’m Sora — every record in this crate earned its spin by cutting through the noise.",
    defaultSignOff:
      "Side B is finished, and the signal’s yours to carry forward. I’m Sora — until the next pressing.",
  },
];

export function getPersonaById(id: DjPersonaId | string): DjPersona {
  return DJ_PERSONAS.find((p) => p.id === id) || DJ_PERSONAS[0];
}

export interface BrandThemePreset {
  id: string;
  name: string;
  room: string;
  deep: string;
  surface: string;
  panel: string;
  elevated: string;
  accent: string;
  accentBright: string;
  ink: string;
  cream: string;
}

export const BRAND_THEMES: BrandThemePreset[] = [
  {
    id: "plum-brass",
    name: "Plum & Brass",
    room: "#170d21",
    deep: "#21142f",
    surface: "#2d1d3e",
    panel: "#38254d",
    elevated: "#473060",
    accent: "#c9a87c",
    accentBright: "#e5bb71",
    ink: "#1e1229",
    cream: "#f7f3ec",
  },
  {
    id: "midnight-copper",
    name: "Midnight & Copper",
    room: "#0c121e",
    deep: "#121a2b",
    surface: "#1a253c",
    panel: "#23314f",
    elevated: "#2d3f63",
    accent: "#d19c77",
    accentBright: "#efb084",
    ink: "#101725",
    cream: "#f5f4f0",
  },
  {
    id: "forest-champagne",
    name: "Pine & Champagne",
    room: "#0b1713",
    deep: "#11221c",
    surface: "#183028",
    panel: "#213f35",
    elevated: "#2b4f43",
    accent: "#c8b583",
    accentBright: "#ead494",
    ink: "#0f1e18",
    cream: "#f6f4ed",
  },
  {
    id: "obsidian-sky",
    name: "Obsidian & Amber",
    room: "#121216",
    deep: "#191920",
    surface: "#24242f",
    panel: "#2f2f3d",
    elevated: "#3b3b4d",
    accent: "#cfa968",
    accentBright: "#f2c679",
    ink: "#16161b",
    cream: "#f7f5f0",
  },
  {
    id: "oxblood-gold",
    name: "Oxblood & Gold",
    room: "#1a0c12",
    deep: "#25121a",
    surface: "#341a25",
    panel: "#432230",
    elevated: "#542c3d",
    accent: "#d4ab74",
    accentBright: "#f0c788",
    ink: "#1f0e15",
    cream: "#f8f2ee",
  },
];

function mixHex(hex: string, targetHex: string, ratio: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(hex);
  const [r2, g2, b2] = parse(targetHex);
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${clamp(r1 + (r2 - r1) * ratio)}${clamp(g1 + (g2 - g1) * ratio)}${clamp(b1 + (b2 - b1) * ratio)}`;
}

export function getBrandTheme(
  id: string,
  customAccentHex?: string,
  customBgHex?: string
): BrandThemePreset {
  const base = BRAND_THEMES.find((t) => t.id === id) || BRAND_THEMES[0];
  let next = { ...base };
  if (customBgHex && /^#[0-9a-fA-F]{6}$/.test(customBgHex)) {
    next = {
      ...next,
      room: mixHex(customBgHex, "#000000", 0.25),
      deep: customBgHex,
      surface: mixHex(customBgHex, "#ffffff", 0.08),
      panel: mixHex(customBgHex, "#ffffff", 0.14),
      elevated: mixHex(customBgHex, "#ffffff", 0.21),
      ink: mixHex(customBgHex, "#000000", 0.3),
    };
  }
  if (customAccentHex && /^#[0-9a-fA-F]{6}$/.test(customAccentHex)) {
    next = {
      ...next,
      accent: customAccentHex,
      accentBright: customAccentHex,
    };
  }
  return next;
}

export interface SetBrandConfig {
  companyName: string;
  companyWebsiteUrl: string;
  logoUrl?: string;
  kicker: string;
  setTitleLead: string;
  setTitleAccent: string;
  curatorLine: string;
  curatorShort: string;
  ctaLabel: string;
  ctaUrl: string;
  finalCtaHeading: string;
  finalCtaBody: string;
  themePresetId: string;
  customAccentHex?: string;
  customBgHex?: string;
}

export interface SetLinerNotesConfig {
  summary: string;
  curationNote: string;
  curationSignOff: string;
  promoBlurb: string;
}

export interface SetTemplate {
  id: string;
  name: string;
  industry: string;
  personaId: DjPersonaId;
  hostWelcome: string;
  hostSignOff: string;
  brand: SetBrandConfig;
  linerNotes: SetLinerNotesConfig;
  tracks: Track[];
  updatedAt: string;
}

export const COPYFLIGHT_DEFAULT_SET: SetTemplate = {
  id: "copyflight-2026-storytelling",
  name: "2026 Business Storytelling Set",
  industry: "Business Storytelling",
  personaId: "marlowe",
  hostWelcome:
    "You made it. Todd E Jones stacked the crate with nine stories from 2026 — I’m Marlowe, and I’ll play them for you.",
  hostSignOff:
    "That’s the last record. The rest is yours to tell. I’m Marlowe — goodnight.",
  brand: {
    companyName: "COPYFLIGHT",
    companyWebsiteUrl: "https://copyflight.com",
    kicker: "Copyflight presents · nine tracks · one year",
    setTitleLead: "The 2026 Business Storytelling",
    setTitleAccent: "Set",
    curatorLine: "Mixed by Todd E Jones, Narrative Archeologist",
    curatorShort: "Todd E Jones, Narrative Archeologist",
    ctaLabel: "Send Todd one thing",
    ctaUrl: "https://www.copyflight.com/dig/",
    finalCtaHeading: "Want a set like this for your own year?",
    finalCtaBody:
      "Send Todd one thing you made that deserved more attention — a webinar, a case study, a podcast episode. He’ll find the story still alive in it and show you what he’d turn it into.",
    themePresetId: "plum-brass",
    customAccentHex: "",
    customBgHex: "",
    logoUrl: "",
  },
  linerNotes: {
    summary:
      "2026 was the year story stopped being a deliverable and became infrastructure. The market put a price on it — up to $775,000 for the right storyteller — while the average team could barely agree on what the company actually does. Underneath every hit in this crate runs the same warning: AI is already telling your story, using whatever old material you left lying around. And the pieces that lasted all pointed at the same fix — one clear narrative, governed like code, told by people who actually lived it.",
    curationNote:
      "2026 originals only — no encores, no homepage links, no coverage of somebody else’s work. Every track links to its original source, every author is credited by name, and anything I couldn’t fully confirm is marked [VERIFY] on the card.",
    curationSignOff: "— Todd",
    promoBlurb:
      "The 2026 Business Storytelling Set — curated by Todd E Jones (Copyflight) and spun by Marlowe.\n\nNine standout 2026 tracks on why story stopped being a deliverable and became infrastructure—and how to keep your narrative clear before AI tells an outdated version for you.",
  },
  tracks: TRACKS.map((t) => ({ ...t, b2bnote: t.b2bnote ? { ...t.b2bnote } : null })),
  updatedAt: "2026-11-24T00:00:00.000Z",
};

export const INDUSTRY_BLUEPRINT_STARTER: SetTemplate = {
  id: "industry-starter-blueprint",
  name: "Industry Top Reads (Starter Prototype)",
  industry: "Custom Industry / Client",
  personaId: "julian",
  hostWelcome:
    "Pull up a chair. I’m Julian — we stacked this starter crate so you can swap in your industry’s standout articles, podcasts, and research.",
  hostSignOff:
    "Needle’s up on the final groove. Duplicate this prototype for your next client or industry vertical. I’m Julian — goodnight.",
  brand: {
    companyName: "YOUR BRAND",
    companyWebsiteUrl: "https://www.copyflight.com/dig/",
    kicker: "Industry Edition · curated reads · one crate",
    setTitleLead: "The 2026 Category Leaders",
    setTitleAccent: "Set",
    curatorLine: "Curated by Your Editorial Team",
    curatorShort: "Your Editorial Team",
    ctaLabel: "Send us one thing",
    ctaUrl: "https://www.copyflight.com/dig/",
    finalCtaHeading: "Want a custom set built for your market?",
    finalCtaBody:
      "Send Todd one flagship piece you made — a keynote, report, or customer story — and see how it plays inside an interactive crate branded for your team.",
    themePresetId: "midnight-copper",
    customAccentHex: "",
  },
  linerNotes: {
    summary:
      "Replace this note with the overarching thesis tying your industry set together: what shifted this year, what buyers stopped believing, and the pattern connecting every article in the crate.",
    curationNote:
      "Primary sources only — direct links to original essays, benchmark reports, and podcast episodes, with clear attribution and unverified dates flagged [VERIFY].",
    curationSignOff: "— Editorial Desk",
    promoBlurb: "",
  },
  tracks: [
    {
      slot: "OPENER",
      tag: "B-SIDE",
      b2b: false,
      energy: 5,
      bpm: 118,
      title: "Start With the Customer’s Own Words",
      real: "Replace with your opener article headline",
      author: "First Author Name",
      pub: "Industry Substack or Blog",
      date: "2026",
      verify: false,
      url: "https://www.copyflight.com/dig/",
      hook: "Paste the sharpest one-sentence quote from the piece here.",
      hookby: "Quoted speaker & context",
      why: "Explain in two crisp sentences why readers in this vertical should care right now.",
      intro: "Warm opening line from the DJ introducing this first record in the crate.",
      transition: null,
      b2bnote: null,
    },
    {
      slot: "BUILD",
      tag: "HIT",
      b2b: false,
      energy: 7,
      bpm: 128,
      title: "The Shift Nobody Priced In Yet",
      real: "Replace with your momentum-building report or essay",
      author: "Second Author Name",
      pub: "Category Benchmark Report",
      date: "2026",
      verify: false,
      url: "https://www.copyflight.com/dig/",
      hook: "Drop a concrete stat, benchmark, or contrarian claim from the article.",
      hookby: "Second Author Name",
      why: "Connect the benchmark to a real budget or positioning decision your audience faces.",
      intro: "Turn the dial up — this one puts hard numbers behind the shift.",
      transition: "From field notes to hard economics — here is what the data actually shows.",
      b2bnote: null,
    },
    {
      slot: "PEAK",
      tag: "HIT",
      b2b: false,
      energy: 10,
      bpm: 140,
      title: "The Peak-Energy Industry Debate",
      real: "Replace with the standout viral piece of the year",
      author: "Third Author Name",
      pub: "Flagship Podcast or Journal",
      date: "2026",
      verify: false,
      url: "https://www.copyflight.com/dig/",
      hook: "Include the line everyone in the industry forwarded to their Slack channel.",
      hookby: "Third Author Name",
      why: "Summarize the tension that makes this the centerpiece of your curated set.",
      intro: "Peak energy on the decks — this is the conversation everyone cited this year.",
      transition: "Now let’s take it straight to the loudest debate in the room.",
      b2bnote: null,
    },
    {
      slot: "COOLDOWN",
      tag: "B-SIDE",
      b2b: false,
      energy: 4,
      bpm: 96,
      title: "Inside the Tuesday-Morning Playbook",
      real: "Replace with a grounded practitioner breakdown",
      author: "Fourth Author Name",
      pub: "Operator Notes",
      date: "2026",
      verify: false,
      url: "https://www.copyflight.com/dig/",
      hook: "Highlight a practical operating principle from someone doing the real work.",
      hookby: "Fourth Author Name",
      why: "Show how teams actually apply the big idea once the hype cools down.",
      intro: "Bringing the tempo down for a closer look at how the work actually happens.",
      transition: "After the noise settles, here is what the day-to-day execution looks like.",
      b2bnote: null,
    },
    {
      slot: "CLOSER",
      tag: "HIT",
      b2b: false,
      energy: 6,
      bpm: 120,
      title: "What Holds Up Next Year",
      real: "Replace with your forward-looking closing essay",
      author: "Fifth Author Name",
      pub: "Annual Letter",
      date: "2026",
      verify: false,
      url: "https://www.copyflight.com/dig/",
      hook: "Leave the listener with a memorable closing provocation.",
      hookby: "Fifth Author Name",
      why: "Frame the next 12 months so the reader walks away with a clear next move.",
      intro: "Final record in the crate. Take this question with you into next quarter.",
      transition: "One last spin before lights up — looking ahead at what compounds next.",
      b2bnote: null,
    },
  ],
  updatedAt: "2026-11-24T00:00:00.000Z",
};

export function createEmptyTrack(index: number): Track {
  return {
    slot: index === 0 ? "OPENER" : "BUILD",
    tag: "HIT",
    b2b: false,
    energy: 6,
    bpm: 124,
    title: `New Track ${index + 1}`,
    real: "Original article or episode headline",
    author: "Author Name",
    pub: "Publication",
    date: "2026",
    verify: false,
    url: "https://www.copyflight.com/dig/",
    hook: "Pull quote from the piece.",
    hookby: "Speaker Name",
    why: "Why this piece earned a spot in the crate.",
    intro: "DJ intro cueing up this record.",
    transition: index === 0 ? null : "Smooth transition line from the previous track.",
    b2bnote: null,
  };
}

export function cloneSetTemplate(
  source: SetTemplate,
  overrides?: Partial<Pick<SetTemplate, "id" | "name" | "industry">>
): SetTemplate {
  return {
    ...source,
    id: overrides?.id ?? `custom-set-${Date.now()}`,
    name: overrides?.name ?? `${source.name} (Copy)`,
    industry: overrides?.industry ?? source.industry,
    brand: { ...source.brand },
    linerNotes: { ...source.linerNotes },
    tracks: source.tracks.map((t) => ({
      ...t,
      b2bnote: t.b2bnote ? { ...t.b2bnote } : null,
    })),
    updatedAt: new Date().toISOString(),
  };
}

export function parseImportedSetTemplate(raw: unknown): SetTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.tracks) || obj.tracks.length === 0) return null;
  const brandObj = (obj.brand && typeof obj.brand === "object" ? obj.brand : {}) as Record<string, unknown>;
  const linerObj = (obj.linerNotes && typeof obj.linerNotes === "object"
    ? obj.linerNotes
    : {}) as Record<string, unknown>;

  const validSlots: Track["slot"][] = ["OPENER", "BUILD", "PEAK", "B2B", "COOLDOWN", "CLOSER"];
  const tracks: Track[] = obj.tracks
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((t, idx) => {
      const slot = validSlots.includes(t.slot as Track["slot"])
        ? (t.slot as Track["slot"])
        : "BUILD";
      const b2bRaw =
        t.b2bnote && typeof t.b2bnote === "object"
          ? (t.b2bnote as Record<string, unknown>)
          : null;
      return {
        slot,
        tag: t.tag === "B-SIDE" ? "B-SIDE" : "HIT",
        b2b: Boolean(t.b2b),
        energy: Math.max(1, Math.min(10, Number(t.energy) || 6)),
        bpm: Math.max(60, Math.min(200, Number(t.bpm) || 124)),
        title: String(t.title || `Track ${idx + 1}`),
        real: String(t.real || ""),
        author: String(t.author || "Unknown Author"),
        pub: String(t.pub || "Publication"),
        date: String(t.date || "2026"),
        verify: Boolean(t.verify),
        url: String(t.url || "https://www.copyflight.com/dig/"),
        hook: String(t.hook || ""),
        hookby: String(t.hookby || ""),
        why: String(t.why || ""),
        intro: String(t.intro || ""),
        transition: t.transition ? String(t.transition) : null,
        b2bnote: b2bRaw
          ? {
              label: String(b2bRaw.label || "B2B Note"),
              text: String(b2bRaw.text || ""),
            }
          : null,
      };
    });

  if (tracks.length === 0) return null;

  const personaId: DjPersonaId =
    obj.personaId === "julian" || obj.personaId === "sora" || obj.personaId === "marlowe"
      ? obj.personaId
      : "marlowe";
  const persona = getPersonaById(personaId);

  return {
    id: `imported-${Date.now()}`,
    name: String(obj.name || "Imported Industry Set"),
    industry: String(obj.industry || "Custom Industry"),
    personaId,
    hostWelcome: String(obj.hostWelcome || persona.defaultWelcome),
    hostSignOff: String(obj.hostSignOff || persona.defaultSignOff),
    brand: {
      companyName: String(brandObj.companyName || "COPYFLIGHT"),
      companyWebsiteUrl: String(brandObj.companyWebsiteUrl || "https://www.copyflight.com/dig/"),
      kicker: String(brandObj.kicker || "Curated Industry Set"),
      setTitleLead: String(brandObj.setTitleLead || "The 2026 Storytelling"),
      setTitleAccent: String(brandObj.setTitleAccent || "Set"),
      curatorLine: String(brandObj.curatorLine || "Curated Editorial Mix"),
      curatorShort: String(brandObj.curatorShort || "Editorial Team"),
      ctaLabel: String(brandObj.ctaLabel || "Send Todd one thing"),
      ctaUrl: String(brandObj.ctaUrl || "https://www.copyflight.com/dig/"),
      finalCtaHeading: String(brandObj.finalCtaHeading || "Want a set like this for your own year?"),
      finalCtaBody: String(
        brandObj.finalCtaBody ||
          "Send one flagship piece you made and see how it plays inside an interactive crate."
      ),
      themePresetId: String(brandObj.themePresetId || "plum-brass"),
      customAccentHex: brandObj.customAccentHex ? String(brandObj.customAccentHex) : "",
      customBgHex: brandObj.customBgHex ? String(brandObj.customBgHex) : "",
      logoUrl: brandObj.logoUrl ? String(brandObj.logoUrl) : "",
    },
    linerNotes: {
      summary: String(linerObj.summary || ""),
      curationNote: String(linerObj.curationNote || ""),
      curationSignOff: String(linerObj.curationSignOff || "— Curator"),
      promoBlurb: String(linerObj.promoBlurb || ""),
    },
    tracks,
    updatedAt: new Date().toISOString(),
  };
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

export function parseArticlesDeck(rawText: string): Track[] | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  // Try JSON array or { tracks: [...] }
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).tracks)
          ? (parsed as Record<string, unknown>).tracks
          : null;
      if (Array.isArray(arr) && arr.length > 0) {
        const temp = parseImportedSetTemplate({ tracks: arr });
        return temp ? temp.tracks : null;
      }
    } catch {
      return null;
    }
  }

  // Try CSV with header row
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  if (!headers.includes("title")) return null;

  const validSlots: Track["slot"][] = ["OPENER", "BUILD", "PEAK", "B2B", "COOLDOWN", "CLOSER"];
  const tracks: Track[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cols = splitCsvLine(lines[r]);
    const get = (key: string) => {
      const idx = headers.indexOf(key);
      return idx >= 0 ? cols[idx] || "" : "";
    };
    const title = get("title");
    if (!title) continue;
    const rawSlot = get("slot").toUpperCase() as Track["slot"];
    const slot: Track["slot"] = validSlots.includes(rawSlot)
      ? rawSlot
      : r === 1
        ? "OPENER"
        : r === lines.length - 1
          ? "CLOSER"
          : "BUILD";
    tracks.push({
      slot,
      tag: get("tag").toUpperCase() === "B-SIDE" ? "B-SIDE" : "HIT",
      b2b: get("b2b").toLowerCase() === "true" || slot === "B2B",
      energy: Math.max(1, Math.min(10, Number(get("energy")) || 6)),
      bpm: Math.max(60, Math.min(200, Number(get("bpm")) || 124)),
      title,
      real: get("real") || get("headline") || title,
      author: get("author") || "Author Name",
      pub: get("pub") || get("publication") || "Publication",
      date: get("date") || "2026",
      verify: get("verify").toLowerCase() === "true",
      url: get("url") || "https://www.copyflight.com/dig/",
      hook: get("hook") || get("quote") || "",
      hookby: get("hookby") || get("author") || "",
      why: get("why") || "",
      intro: get("intro") || `Next up: ${title}.`,
      transition: get("transition") || null,
      b2bnote: null,
    });
  }
  return tracks.length > 0 ? tracks : null;
}

