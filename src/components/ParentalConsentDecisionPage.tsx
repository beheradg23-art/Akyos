// Stand-alone page a parent/guardian lands on after clicking the link in
// the "permission requested" email (see api/parental-consent.ts's
// sendParentEmail). Deliberately has NO dependency on being signed in —
// the parent doesn't have (and doesn't need) an Akyos account at all. The
// token in the URL is the entire credential; see the security note at the
// top of api/parental-consent.ts.
//
// Mounted from App.tsx BEFORE AuthGate, whenever the URL carries a
// `parentalConsent` query param — so this works even if the browser
// happens to already have some other Akyos session sitting in it (e.g. the
// parent opens the link on the family iPad that's signed into the child's
// own account) without that session leaking into or affecting this flow at
// all.
import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Check, X, Loader2 } from 'lucide-react';
import { AkyosMark } from './shared/AkyosMark';
import { liquidFillStyle, LIQUID_GRADIENT_KEYFRAMES } from '../lib/liquidFill';
import { lookupParentalConsentToken, decideParentalConsent } from '../lib/parentalConsent';
import type { ParentalConsentStatus } from '../lib/parentalConsent';
import LegalPage from './legal/LegalPage';
// Same magnetic cursor used throughout the rest of the app/AuthGate — pure,
// self-contained, safe to mount here since this page renders standalone,
// before AuthGate/App (and their own <MagneticCursor />) ever exist.
import { MagneticCursor } from './ui/Primitives';
import { NO_SELECT_CSS } from '../styles/noSelect';

type ViewState =
  | { phase: 'loading' }
  | { phase: 'invalid' }
  | { phase: 'ready'; status: ParentalConsentStatus; parentEmailMasked?: string }
  | { phase: 'submitting'; decision: 'approve' | 'deny' }
  | { phase: 'done'; status: ParentalConsentStatus }
  | { phase: 'error'; message: string };

// Same frosted-glass "bento card" AuthGate's AuthBentoCard uses (cursor
// spotlight tracking included) — kept as a local, self-contained copy for
// the same reason AuthGate keeps its own copy instead of importing a
// shared one: this page also renders standalone, before the main App tree
// (and any shared Card component that assumes it) ever mounts.
function ConsentBentoCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const fineRef = useRef(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: fine)').matches);
  const [hovering, setHovering] = useState(false);
  const [spot, setSpot] = useState({ x: 50, y: 50 });

  const handleMove = (e: React.MouseEvent) => {
    if (!fineRef.current || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setSpot({ x: px * 100, y: py * 100 });
    setHovering(true);
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={() => setHovering(false)}
      className="cursor-target relative w-full max-w-sm overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.045] backdrop-blur-2xl backdrop-saturate-150 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)] px-6 py-8 sm:px-9 sm:py-9"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      {hovering && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[28px] transition-opacity duration-300"
          style={{ background: `radial-gradient(420px circle at ${spot.x}% ${spot.y}%, rgba(255,255,255,0.08), transparent 65%)` }}
        />
      )}
      <div className="relative flex flex-col items-center">{children}</div>
    </div>
  );
}

export function ParentalConsentDecisionPage({ token }: { token: string }) {
  const [state, setState] = useState<ViewState>({ phase: 'loading' });
  // The parent hasn't seen or agreed to anything yet just by clicking the
  // email link — they need to actually confirm they've read the Terms/
  // Privacy Policy before their Approve counts as informed consent for a
  // minor's account. Decline never needed that (declining requires no
  // agreement to anything), so this only gates the Approve button.
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [legalOverlay, setLegalOverlay] = useState<'terms' | 'privacy' | null>(null);

  useEffect(() => {
    let cancelled = false;
    lookupParentalConsentToken(token).then((result) => {
      if (cancelled) return;
      if (!result.ok || !result.valid) {
        setState({ phase: 'invalid' });
        return;
      }
      setState({ phase: 'ready', status: result.status || 'pending', parentEmailMasked: result.parentEmailMasked });
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const decide = async (decision: 'approve' | 'deny') => {
    setState({ phase: 'submitting', decision });
    const result = await decideParentalConsent(token, decision);
    if (!result.ok) {
      setState({ phase: 'error', message: result.error || 'Something went wrong. Please try again.' });
      return;
    }
    setState({ phase: 'done', status: result.status || (decision === 'approve' ? 'approved' : 'denied') });
  };

  return (
    <>
      <MagneticCursor />
      <style>{NO_SELECT_CSS}</style>
      <style>{LIQUID_GRADIENT_KEYFRAMES}</style>
      <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-zinc-950 px-6">
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl shadow-lg shadow-violet-500/20" style={liquidFillStyle()}>
          <AkyosMark className="h-5 w-5 text-neutral-950" />
        </div>

        {state.phase === 'loading' && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
            <p className="text-[12.5px] text-neutral-500">Loading request…</p>
          </div>
        )}

        {state.phase === 'invalid' && (
          <ConsentBentoCard>
            <div className="max-w-xs text-center">
              <h1 className="mb-1.5 text-[15px] font-semibold tracking-tight text-neutral-50">Link not found</h1>
              <p className="text-[12.5px] leading-relaxed text-neutral-500">
                This permission link is invalid or has expired. If your child sent you a new request, please use
                the most recent email.
              </p>
            </div>
          </ConsentBentoCard>
        )}

        {state.phase === 'error' && (
          <ConsentBentoCard>
            <div className="max-w-xs text-center">
              <h1 className="mb-1.5 text-[15px] font-semibold tracking-tight text-neutral-50">Something went wrong</h1>
              <p className="text-[12.5px] leading-relaxed text-neutral-500">{state.message}</p>
            </div>
          </ConsentBentoCard>
        )}

        {state.phase === 'ready' && state.status === 'pending' && (
          <ConsentBentoCard>
            <div className="flex max-w-xs flex-col items-center">
              <ShieldCheck className="mb-4 h-6 w-6 text-violet-400" strokeWidth={1.75} />
              <h1 className="mb-1.5 text-center text-[15px] font-semibold tracking-tight text-neutral-50">
                Permission requested
              </h1>
              <p className="mb-7 text-center text-[12.5px] leading-relaxed text-neutral-500">
                Someone using{' '}
                <span className="font-medium text-neutral-300">{state.parentEmailMasked || 'this address'}</span>{' '}
                as their parent/guardian contact wants to create an Akyos account and has told us they're under 18.
                Akyos requires your permission before their account can be used. Nothing has been activated yet.
              </p>
              <label
                className="mb-5 flex w-full cursor-pointer items-start gap-2.5 select-none"
              >
                <span
                  role="checkbox"
                  aria-checked={agreedToTerms}
                  tabIndex={0}
                  onClick={() => setAgreedToTerms((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setAgreedToTerms((v) => !v);
                    }
                  }}
                  className="cursor-target mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-md border transition-all"
                  style={
                    agreedToTerms
                      ? { ...liquidFillStyle(), border: '1px solid transparent' }
                      : { borderColor: 'rgb(64 64 70)', background: 'rgba(39,39,42,0.5)' }
                  }
                >
                  {agreedToTerms && <Check className="h-3 w-3 text-neutral-950" strokeWidth={3} />}
                </span>
                <span className="text-[12px] leading-snug text-neutral-400">
                  I've read and agree to the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setLegalOverlay('terms');
                    }}
                    className="cursor-target font-semibold text-violet-400 underline decoration-violet-400/40 underline-offset-2 transition-colors hover:text-violet-300"
                  >
                    Terms of Service
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setLegalOverlay('privacy');
                    }}
                    className="cursor-target font-semibold text-violet-400 underline decoration-violet-400/40 underline-offset-2 transition-colors hover:text-violet-300"
                  >
                    Privacy Policy
                  </button>{' '}
                  on behalf of my child.
                </span>
              </label>

              <div className="flex w-full flex-col gap-2.5">
                <button
                  type="button"
                  disabled={!agreedToTerms}
                  onClick={() => decide('approve')}
                  className="cursor-target flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold text-neutral-950 transition-opacity disabled:opacity-40"
                  style={liquidFillStyle()}
                >
                  <Check className="h-4 w-4" strokeWidth={2.5} /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => decide('deny')}
                  className="cursor-target flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/80 py-3 text-[13px] font-semibold text-neutral-300 transition-colors hover:bg-neutral-900"
                >
                  <X className="h-4 w-4" strokeWidth={2.5} /> Decline
                </button>
              </div>
              <p className="mt-5 text-center text-[11px] leading-relaxed text-neutral-600">
                Didn't expect this? You can safely choose Decline, or just close this page.
              </p>
            </div>
          </ConsentBentoCard>
        )}

        {legalOverlay && <LegalPage doc={legalOverlay} onClose={() => setLegalOverlay(null)} />}

        {state.phase === 'ready' && state.status !== 'pending' && (
          <ConsentBentoCard>
            <DecisionAlreadyMade status={state.status} />
          </ConsentBentoCard>
        )}

        {state.phase === 'submitting' && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
            <p className="text-[12.5px] text-neutral-500">
              {state.decision === 'approve' ? 'Recording your approval…' : 'Recording your decision…'}
            </p>
          </div>
        )}

        {state.phase === 'done' && (
          <ConsentBentoCard>
            <DecisionAlreadyMade status={state.status} justDecided />
          </ConsentBentoCard>
        )}
      </div>
    </>
  );
}

function DecisionAlreadyMade({ status, justDecided }: { status: ParentalConsentStatus; justDecided?: boolean }) {
  const approved = status === 'approved';
  return (
    <div className="flex max-w-xs flex-col items-center text-center">
      <div
        className={`mb-4 flex h-11 w-11 items-center justify-center rounded-full ${
          approved ? 'bg-emerald-500/10' : 'bg-neutral-800/60'
        }`}
      >
        {approved ? (
          <Check className="h-5 w-5 text-emerald-400" strokeWidth={2.5} />
        ) : (
          <X className="h-5 w-5 text-neutral-400" strokeWidth={2.5} />
        )}
      </div>
      <h1 className="mb-1.5 text-[15px] font-semibold tracking-tight text-neutral-50">
        {approved ? "You've approved this request" : "You've declined this request"}
      </h1>
      <p className="text-[12.5px] leading-relaxed text-neutral-500">
        {approved
          ? justDecided
            ? 'Your child can now finish setting up their account. You can close this page.'
            : 'This request was already approved. You can close this page.'
          : justDecided
          ? "Their account will stay on hold. You can close this page — you're welcome to approve a future request if you change your mind."
          : 'This request was already declined. You can close this page.'}
      </p>
    </div>
  );
}