// Akyos brand mark — replaces the placeholder GraduationCap icon that used
// to sit inside the gradient badge blob (IntroLoader, AuthGate, sidebar/
// header brand chip, onboarding header). Renders as a single-color glyph
// via currentColor so it drops into the same className-driven color/size
// classes the old lucide icon used (e.g. `text-neutral-950`).
import React from 'react';

export function AkyosMark({ className, strokeWidth: _strokeWidth, ...props }: React.SVGProps<SVGSVGElement> & { strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 509.968 580.695"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="currentColor"
      {...props}
    >
      <path d="M173.7533,403.3044,85.308,580.195h106.15l106.17-212.34H231.1116A64.1286,64.1286,0,0,0,173.7533,403.3044Z" transform="translate(0 0.5)" />
      <path d="M311.0844,261.695H244.568l159.25,318.5h106.15L368.4427,297.1444A64.1286,64.1286,0,0,0,311.0844,261.695Z" transform="translate(0 0.5)" />
    </svg>
  );
}
