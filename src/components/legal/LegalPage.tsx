// Full-screen, in-app Terms of Service / Privacy Policy viewer.
//
// Deliberately built as data (src/lib/legalContent.ts) + this one renderer,
// rather than static PDFs, so a clause update is a text edit, not a
// re-export. Reuses the exact same visual language as the rest of the
// app — the bento <Card> (tilt + spotlight + animated sweep border) from
// Primitives.tsx, and the liquidFillStyle() gradient used on every primary
// badge/button — so it doesn't read as a bolted-on legal page.
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import { AkyosMark } from '../shared/AkyosMark';
import { Card } from '../ui/Primitives';
import { liquidFillStyle } from '../../lib/liquidFill';
import { TERMS_DOC, PRIVACY_DOC, LegalDoc, LegalBlock } from '../../lib/legalContent';

const REVEAL_KEYFRAMES = `
  @keyframes akyos-legal-reveal {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

// Fires once, the first time the wrapped section scrolls into view, then
// disconnects — a lightweight scroll-reveal so sections animate in as you
// read down the page instead of all firing on mount at once.
function useRevealOnScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            obs.disconnect();
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

function LegalBlockView({ block }: { block: LegalBlock }) {
  if (block.type === 'p') {
    return <p className="text-[13px] leading-relaxed text-neutral-400">{block.text}</p>;
  }
  if (block.type === 'ul') {
    return (
      <ul className="space-y-2">
        {block.items.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-neutral-400">
            <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-violet-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === 'table') {
    return (
      <div className="overflow-hidden rounded-xl border border-neutral-800/80">
        {block.rows.map(([k, v], i) => (
          <div
            key={i}
            className={`flex flex-col gap-0.5 px-3.5 py-2.5 sm:flex-row sm:items-baseline sm:gap-4 ${
              i !== block.rows.length - 1 ? 'border-b border-neutral-800/80' : ''
            } ${i % 2 === 1 ? 'bg-neutral-900/40' : ''}`}
          >
            <span className="w-full flex-none text-[10.5px] font-semibold uppercase tracking-wide text-violet-400 sm:w-[38%]">
              {k}
            </span>
            <span className="text-[12.5px] leading-relaxed text-neutral-300">{v}</span>
          </div>
        ))}
      </div>
    );
  }
  // callout
  const accent = block.tone === 'accent';
  return (
    <div
      className={`rounded-xl border-l-2 px-4 py-3 text-[13px] leading-relaxed ${
        accent
          ? 'border-emerald-400/70 bg-emerald-400/[0.06] text-emerald-200/90'
          : 'border-violet-400/70 bg-violet-400/[0.06] text-violet-100/90'
      }`}
    >
      {block.text}
    </div>
  );
}

function SectionCard({ index, title, blocks }: { index: number; title: string; blocks: LegalBlock[] }) {
  const { ref, inView } = useRevealOnScroll<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{
        animation: inView ? 'akyos-legal-reveal 650ms cubic-bezier(0.16,1,0.3,1) both' : undefined,
        opacity: inView ? undefined : 0,
      }}
    >
      <Card className="mb-3.5">
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-[11px] font-bold text-neutral-950"
            style={liquidFillStyle()}
          >
            {index + 1}
          </div>
          <h2 className="text-[14px] font-semibold text-neutral-50">{title}</h2>
        </div>
        <div className="space-y-3 pl-10">
          {blocks.map((b, i) => (
            <LegalBlockView key={i} block={b} />
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function LegalPage({
  doc: initialDoc,
  onClose,
}: {
  doc: 'terms' | 'privacy';
  onClose: () => void;
}) {
  const [which, setWhich] = useState<'terms' | 'privacy'>(initialDoc);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const doc: LegalDoc = which === 'terms' ? TERMS_DOC : PRIVACY_DOC;

  // Jump to top when switching between the two documents via the
  // cross-link at the bottom, rather than keeping the old scroll offset.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [which]);

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-zinc-950">
      <style>{REVEAL_KEYFRAMES}</style>

      {/* Decorative ambient glow, purely visual, matches the intro/auth screens */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[36rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)' }}
      />

      {/* Header */}
      <div className="relative z-10 flex-none border-b border-neutral-800/80 bg-zinc-950/90 px-5 py-4 backdrop-blur-sm sm:px-8">
        <button
          type="button"
          onClick={onClose}
          className="mb-4 flex items-center gap-1.5 text-[12px] font-medium text-neutral-500 transition-colors hover:text-neutral-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Back
        </button>
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 flex-none items-center justify-center rounded-xl shadow-lg shadow-violet-500/20"
            style={liquidFillStyle()}
          >
            <AkyosMark className="h-4 w-4 text-neutral-950" />
          </div>
          <div>
            <h1 className="text-[16px] font-semibold tracking-tight text-neutral-50">{doc.title}</h1>
            <p className="text-[11.5px] text-neutral-500">{doc.tagline} &middot; Effective {doc.effectiveDate}</p>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
        <div className="mx-auto w-full max-w-2xl">
          {doc.sections.map((section, i) => (
            <SectionCard key={section.title} index={i} title={section.title} blocks={section.blocks} />
          ))}

          {/* Cross-link + footer */}
          <div className="mt-2 flex flex-col items-center gap-4 pb-10 pt-3 text-center">
            <button
              type="button"
              onClick={() => setWhich(which === 'terms' ? 'privacy' : 'terms')}
              className="flex items-center gap-1.5 text-[12.5px] font-medium text-violet-400 transition-colors hover:text-violet-300"
            >
              {which === 'terms' ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
                  Read the Privacy Policy instead
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5" strokeWidth={2} />
                  Read the Terms of Service instead
                </>
              )}
            </button>
            <p className="max-w-sm text-[10.5px] leading-relaxed text-neutral-600">
              Akyos &middot; Governed by the laws of India &middot; Questions? kiwieatspumpkin@gmail.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
