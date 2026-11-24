import React, { useEffect, useState } from "react";
import { DjPersona, getPersonaById } from "../data/setTemplates";
import { keyBackdropToCanvas } from "../lib/imageKeying";

export const DEFAULT_MARLOWE_BOOTH_URL = "/src/assets/images/marlowe_dj_hands_wide_1795554088018.jpg";
export const DEFAULT_MARLOWE_AVATAR_URL = "/src/assets/images/marlowe_dj_portrait_1795553950975.jpg";

interface MarlowePortraitProps {
  customImageSrc: string | null;
  persona?: DjPersona;
  variant?: "booth" | "avatar";
  className?: string;
}

export const MarloweArt: React.FC<MarlowePortraitProps> = ({
  customImageSrc,
  persona,
  variant = "booth",
  className = "",
}) => {
  const activePersona = persona || getPersonaById("marlowe");
  const activeSource =
    customImageSrc ||
    (variant === "avatar" ? activePersona.avatarUrl : activePersona.boothUrl);
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
    setCutoutUrl(null);

    if (variant !== "booth" || customImageSrc) return;

    let cancelled = false;
    const probe = new Image();
    probe.crossOrigin = "anonymous";
    probe.onload = () => {
      if (cancelled) return;
      const keyed = keyBackdropToCanvas(probe);
      if (keyed && !cancelled) {
        setCutoutUrl(keyed.toDataURL("image/png"));
      }
    };
    probe.onerror = () => {
      if (!cancelled) setLoadFailed(true);
    };
    probe.src = activeSource;

    return () => {
      cancelled = true;
    };
  }, [activeSource, variant, customImageSrc]);

  if (!loadFailed) {
    const displaySrc = variant === "booth" && cutoutUrl ? cutoutUrl : activeSource;
    return (
      <img
        src={displaySrc}
        onError={() => setLoadFailed(true)}
        alt={
          variant === "avatar"
            ? `${activePersona.name}, the DJ hosting this set`
            : `${activePersona.name}, the DJ, standing behind the booth.`
        }
        referrerPolicy="no-referrer"
        className={
          variant === "avatar"
            ? `w-full h-full object-cover object-[50%_18%] scale-125 block ${className}`
            : `w-full h-auto block select-none ${className}`
        }
      />
    );
  }

  const viewBox = variant === "avatar" ? "48 22 144 144" : "0 0 240 260";

  return (
    <svg
      viewBox={viewBox}
      className={
        variant === "avatar"
          ? `w-full h-full block ${className}`
          : `w-full h-auto block select-none ${className}`
      }
      role="img"
      aria-label={
        variant === "avatar"
          ? "Marlowe, the DJ hosting this set"
          : "Marlowe, the DJ, standing behind the booth."
      }
    >
      <defs>
        <radialGradient id="marlowe-skin-fb" cx="42%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#C98D64" />
          <stop offset="55%" stopColor="#A66D49" />
          <stop offset="100%" stopColor="#77482D" />
        </radialGradient>
        <linearGradient id="marlowe-jacket-fb" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#583A73" />
          <stop offset="100%" stopColor="#241533" />
        </linearGradient>
        <linearGradient id="marlowe-brass-fb" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F5D99B" />
          <stop offset="100%" stopColor="#9B7137" />
        </linearGradient>
      </defs>
      <circle cx="120" cy="70" r="34" fill="#1E1319" />
      <path d="M72,164 Q120,144 168,164 L164,256 L76,256 Z" fill="url(#marlowe-jacket-fb)" />
      <rect x="108" y="124" width="24" height="36" rx="10" fill="url(#marlowe-skin-fb)" />
      <ellipse cx="120" cy="96" rx="31" ry="38" fill="url(#marlowe-skin-fb)" />
      <path
        d="M80,82 A41,41 0 0 1 160,76"
        fill="none"
        stroke="url(#marlowe-brass-fb)"
        strokeWidth="6.5"
        strokeLinecap="round"
      />
    </svg>
  );
};
