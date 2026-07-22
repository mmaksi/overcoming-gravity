import type { SVGProps } from "react";

/**
 * Navigation icon set — deliberately sharp and geometric: square line caps,
 * mitered corners, zero corner radius. A more premium, architectural look than
 * the rounded default icon set, and consistent across the whole nav bar.
 */
const base: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "square",
  strokeLinejoin: "miter",
};

/** House: pitched roof, walls, doorway — all straight edges. */
export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 10.5 12 4l8.5 6.5" />
      <path d="M6 10v10h12V10" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

/** Angular dumbbell: rectangular plates on a straight bar — the Training tab. */
export function TrainingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 12h1.5M20 12h1.5" />
      <rect x="4" y="8" width="3" height="8" />
      <rect x="17" y="8" width="3" height="8" />
      <path d="M7 12h10" />
    </svg>
  );
}

/** Wall calendar: framed grid with a header bar and two hangers. */
export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="5" width="16" height="15" />
      <path d="M4 9.5h16" />
      <path d="M8 3v3M16 3v3" />
      <path d="M8.5 13h2M13.5 13h2M8.5 16.5h2M13.5 16.5h2" />
    </svg>
  );
}

/** Drafting compass: a pivot with two splayed legs — the Toolkit tab. */
export function ToolkitIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5v4" />
      <path d="m12 7.5-4 13" />
      <path d="m12 7.5 4 13" />
      <path d="M10 14h4" />
    </svg>
  );
}

/** Angular shield with a check: the admin area. */
export function ShieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 20 6.2V12l-8 9-8-9V6.2Z" />
      <path d="m8.5 11.5 2.5 2.5 4.5-5" />
    </svg>
  );
}
