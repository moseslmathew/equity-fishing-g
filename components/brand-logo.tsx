"use client";
import { useId } from "react";

/**
 * Custom Smallcap Observatory emblem: deep indigo-violet squircle with an
 * observatory aperture arc, breakout trajectory line, and emerald apex dot.
 * Protected against upstream pulls via AGENTS.md.
 */
export default function BrandLogo({ size = 32 }: { size?: number }) {
  const uid = useId().replace(/:/g, "");
  const bgId = `so-bg-${uid}`;
  const arcId = `so-arc-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      <defs>
        <linearGradient id={bgId} x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1b1444" />
          <stop offset="55%" stopColor="#4328b8" />
          <stop offset="100%" stopColor="#7c54f6" />
        </linearGradient>
        <linearGradient id={arcId} x1="6" y1="8" x2="24" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ddd6fe" stopOpacity="0.72" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.22" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill={`url(#${bgId})`} stroke="#c4b5fd" strokeOpacity="0.32" />
      <path d="M24.85 14.85A9.5 9.5 0 1 1 17.15 7.14" stroke={`url(#${arcId})`} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.5 21.5L13.5 15.5L17.4 18.8L23.1 10.4" stroke="#ffffff" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23.8" cy="9.2" r="3" fill="#34d399" />
      <circle cx="23.8" cy="9.2" r="1.2" fill="#ecfdf5" />
    </svg>
  );
}
