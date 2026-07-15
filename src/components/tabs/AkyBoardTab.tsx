// AkyBoard tab: embeds Weje (app.weje.io) as an in-app moodboard/whiteboard.
// Weje itself handles its own login/boards/persistence — this tab is just a
// nicely-framed window onto it, plus a fallback for the (fairly common)
// case where a third-party web app refuses to load inside an iframe at all
// (via the X-Frame-Options / CSP frame-ancestors headers most SaaS login
// flows send). There's no reliable JS signal for "this iframe was blocked
// by a frame-ancestors policy" — the browser just silently shows nothing —
// so instead of pretending we can detect it, we always surface a visible
// "open in a new tab" escape hatch alongside the embed.
import React, { useState } from 'react';
import { Palette, ExternalLink, RotateCcw, Maximize2 } from 'lucide-react';
import { Card, RippleButton } from '../ui/Primitives';
import { EditableSectionHeading } from '../shared/EditableSectionHeading';

const WEJE_URL = 'https://app.weje.io/';

export function AkyBoardTab() {
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="space-y-5 animate-fadeIn">
      <Card className="animate-fadeIn">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <EditableSectionHeading
            id="akyboard"
            defaultTitle="AkyBoard"
            defaultIcon={Palette}
            subtitle="Your visual moodboard, right inside the dashboard"
          />
          <div className="flex items-center gap-2 shrink-0">
            <RippleButton
              onClick={() => {
                setLoaded(false);
                setReloadKey((k) => k + 1);
              }}
              title="Reload board"
              ariaLabel="Reload board"
              className="cursor-target flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-950/80 px-3 py-2 text-[11.5px] font-semibold text-neutral-400 transition-colors hover:border-neutral-700 hover:text-neutral-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reload
            </RippleButton>
            <a
              href={WEJE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-target flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[11.5px] font-semibold text-violet-300 transition-colors hover:bg-violet-500/20"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Full Screen
            </a>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-inner" style={{ height: 'min(78vh, 820px)' }}>
          {/* Ambient glow frame so the embed doesn't feel like a bare rectangle
              dropped onto the page — matches the rest of the app's soft
              violet/indigo accent glows. */}
          <div className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-violet-600/10 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-indigo-600/10 blur-[100px]" />

          {!loaded && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-neutral-950">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10">
                <Palette className="h-5 w-5 text-violet-400 animate-pulse" strokeWidth={2} />
              </div>
              <p className="text-[12px] text-neutral-500">Loading your board…</p>
              <p className="max-w-xs text-center text-[11px] text-neutral-700">
                If nothing appears after a few seconds, Weje may be blocking in-app embedding —
                use "Open Full Screen" above instead.
              </p>
            </div>
          )}

          <iframe
            key={reloadKey}
            src={WEJE_URL}
            title="AkyBoard — Weje Moodboard"
            className="relative z-0 h-full w-full border-0"
            onLoad={() => setLoaded(true)}
            allow="clipboard-read; clipboard-write; fullscreen"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-[10.5px] text-neutral-700">
          <Maximize2 className="h-3 w-3" />
          Powered by Weje — sign-in, boards, and saving all happen inside the embed itself.
        </p>
      </Card>
    </div>
  );
}