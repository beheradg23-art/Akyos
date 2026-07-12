// Syllabus tab: phase-by-phase topic checklist with revision-status
// coloring (fresh/due/overdue) and AI-generated topic detail panels,
// falling back to the static TOPIC_DETAILS.
import React, { useState } from 'react';
import { BookOpen, ChevronRight, ArrowUpRight, RotateCcw } from 'lucide-react';
import {
  ConfigContext, getTopicRevisionKey, getRevisionStatus, getAllSyllabusTopics,
  getSubjectStyle, getLocalDateString,
} from '../../lib/appConfig';
import { TOPIC_DETAILS } from '../../lib/staticContent';
import { Card, RippleButton, ModalData } from '../ui/Primitives';
import { EditableSectionHeading } from '../shared/EditableSectionHeading';
import { generateTopicDetails } from '../../lib/contentGen';

export function SyllabusTab({ setModal }: { setModal: (data: ModalData | null) => void }) {
  const { subjects, syllabus } = React.useContext(ConfigContext);
  const allSyllabusTopics = useMemo(() => getAllSyllabusTopics(syllabus), [syllabus]);
  const [activePhase, setActivePhase] = useState(1);
  const phase = syllabus.find((p) => p.phase === activePhase) || syllabus[0];

  const [revisionLog, setRevisionLog] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('topic_revision_log');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('topic_revision_log', JSON.stringify(revisionLog));
    } catch {
      /* storage unavailable — fail silently */
    }
  }, [revisionLog]);

  const markRevised = (key: string) => {
    setRevisionLog((prev) => ({ ...prev, [key]: getLocalDateString() }));
  };

  // Topics revised at least once before, now gone stale — sorted worst-first.
  // Topics never touched at all are excluded here (not "overdue", just not
  // started yet); they still get a neutral badge inline in the topic lists.
  const staleTopics = useMemo(() => {
    return allSyllabusTopics
      .map((t) => ({ ...t, ...getRevisionStatus(revisionLog[t.key]) }))
      .filter((t) => t.status === 'due' || t.status === 'overdue')
      .sort((a, b) => (b.days || 0) - (a.days || 0));
  }, [revisionLog, allSyllabusTopics]);

  const handleTopicClick = async (topicName) => {
    const defaultMeta = {
      chapters: ['General Conceptual Practice Modules'],
      focus: ['Complete all textbook back exercises', 'Review core formulas & dynamic testing metrics'],
    };
    const known = TOPIC_DETAILS[topicName];

    if (known) {
      setModal({
        title: topicName,
        subtitle: `Syllabus Structural Tracking Units`,
        icon: BookOpen,
        arrayTitle: 'Sub-Chapters Checklist',
        arrayItems: known.chapters,
        focusPoints: known.focus,
      });
      return;
    }

    // A topic the user added themselves — quietly generate a real
    // chapter/focus breakdown instead of the generic placeholder.
    setModal({
      title: topicName,
      subtitle: `Syllabus Structural Tracking Units`,
      icon: BookOpen,
      loading: true,
    });
    const generated = await generateTopicDetails(topicName);
    const meta = generated || defaultMeta;
    setModal({
      title: topicName,
      subtitle: `Syllabus Structural Tracking Units`,
      icon: BookOpen,
      arrayTitle: 'Sub-Chapters Checklist',
      arrayItems: meta.chapters,
      focusPoints: meta.focus,
    });
  };

  return (
    <div className="animate-fadeIn">
      <EditableSectionHeading id="syl_runway" defaultTitle="Syllabus Runway" defaultIcon={BookOpen} subtitle="Absolute deadline stack. Click on any topic/chapter box to reveal specific deep focus items." />

      {staleTopics.length > 0 && (
        <Card className="mb-5 border border-amber-500/20">
          <EditableSectionHeading
            id="syl_revision"
            defaultTitle="Revision Due"
            defaultIcon={RotateCcw}
            subtitle={`${staleTopics.length} topic${staleTopics.length === 1 ? '' : 's'} revised before, now going stale — oldest first`}
          />
          <div className="space-y-2 mt-4">
            {staleTopics.slice(0, 8).map((t) => (
              <div
                key={t.key}
                className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2.5 flex-wrap"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${t.status === 'overdue' ? 'bg-rose-400' : 'bg-amber-400'}`} />
                  <button onClick={() => handleTopicClick(t.topic)} className="cursor-target text-[13px] text-neutral-200 hover:text-neutral-50 text-left truncate">
                    {t.topic}
                  </button>
                  <span className={`text-[10.5px] shrink-0 ${getSubjectStyle(t.subject, subjects).text}`}>{t.month}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${t.status === 'overdue' ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'}`}>
                    {t.days}d ago
                  </span>
                  <RippleButton
                    onClick={() => markRevised(t.key)}
                    className="cursor-target flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-300 hover:bg-neutral-800 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" /> Mark Revised
                  </RippleButton>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        {syllabus.map((p) => (
          <button
            key={p.phase}
            onClick={() => setActivePhase(p.phase)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-left transition-all duration-150 ${
              activePhase === p.phase
                ? 'border-indigo-500/40 bg-indigo-500/[0.08]'
                : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
            }`}
          >
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold ${activePhase === p.phase ? 'bg-indigo-500/20 text-indigo-300' : 'bg-neutral-800 text-neutral-400'}`}>
              {p.phase}
            </span>
            <div>
              <div className={`text-[12.5px] font-medium ${activePhase === p.phase ? 'text-indigo-300' : 'text-neutral-300'}`}>{p.month}</div>
              <div className="text-[10.5px] text-neutral-500">{p.label}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {subjects
          .filter((s) => Array.isArray(phase.subjects[s.key]))
          .map((s) => {
            const style = getSubjectStyle(s.key, subjects);
            return (
          <Card key={s.key} className={`border ${style.border}`}>
            <div className="flex items-center gap-2 mb-3.5">
              <span className={`h-2 w-2 rounded-full ${style.dot}`} />
              <span className={`text-[13px] font-semibold ${style.text}`}>{s.label}</span>
            </div>
            <ul className="space-y-2">
              {phase.subjects[s.key].map((topic) => {
                const key = getTopicRevisionKey(activePhase, s.key, topic);
                const { status, days } = getRevisionStatus(revisionLog[key]);
                const dotColor =
                  status === 'never' ? 'bg-neutral-700' :
                  status === 'fresh' ? 'bg-violet-400' :
                  status === 'due' ? 'bg-amber-400' : 'bg-rose-400';
                const badgeText =
                  status === 'never' ? 'Not yet revised' :
                  status === 'fresh' ? `Revised ${days === 0 ? 'today' : `${days}d ago`}` :
                  status === 'due' ? `Due · ${days}d ago` : `Overdue · ${days}d ago`;
                const badgeClass =
                  status === 'never' ? 'text-neutral-600' :
                  status === 'fresh' ? 'text-violet-400' :
                  status === 'due' ? 'text-amber-400' : 'text-rose-400';

                return (
                  <li
                    key={topic}
                    className="flex flex-col gap-1.5 text-[12.5px] text-neutral-300 leading-snug p-2 rounded-lg bg-neutral-950/40 border border-neutral-800/40 hover:bg-neutral-800/50 hover:border-neutral-700 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div onClick={() => handleTopicClick(topic)} className="flex items-start gap-2 cursor-pointer min-w-0">
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-neutral-600 group-hover:text-indigo-400" strokeWidth={2} />
                        <span className="group-hover:text-neutral-100 truncate">{topic}</span>
                      </div>
                      <ArrowUpRight
                        onClick={() => handleTopicClick(topic)}
                        className="h-3 w-3 shrink-0 text-neutral-600 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 pl-5.5">
                      <span className={`flex items-center gap-1.5 text-[10.5px] ${badgeClass}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} /> {badgeText}
                      </span>
                      <button
                        onClick={() => markRevised(key)}
                        title="Mark as revised today"
                        className="cursor-target shrink-0 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                      >
                        <RotateCcw className="h-2.5 w-2.5" /> Revise
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
            );
          })}
      </div>
    </div>
  );
}

// ---------- Tab Subcomponent: Mock Test Tracker ----------
// A dependency-free SVG line chart tracing Math/Physics/Chem scores over time.
