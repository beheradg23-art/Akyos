// To-Do List tab: a free-form daily checklist, separate from the fixed
// Daily Matrix tracker items. Entries are stored per calendar day (keyed by
// getLocalDateString(), same convention as globalHistory/dietLog/pomodoro
// logs elsewhere in the app) so the list naturally "resets" at local
// midnight — there's no timer wiping anything, the component just starts
// reading/writing a new date's (empty) array once the date rolls over.
// Past days' lists are kept in storage (nothing is deleted), they just
// aren't shown here — this tab only ever displays today's key.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ListChecks, Plus, X, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { getLocalDateString } from '../../lib/appConfig';
import { Card, RippleButton, useRipple } from '../ui/Primitives';
import { EditableSectionHeading } from '../shared/EditableSectionHeading';
import { haptic } from '../../lib/haptics';

const STORAGE_KEY = 'jee_command_todos_v1';

type TodoItem = { id: string; text: string; done: boolean };
type TodoStore = Record<string, TodoItem[]>;

function loadStore(): TodoStore {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function TodoRow({ item, onToggle, onDelete }: { item: TodoItem; onToggle: () => void; onDelete: () => void }) {
  const ref = useRef(null);
  const [spawnRipple, rippleNodes] = useRipple();

  return (
    <div
      ref={ref}
      onClick={(e) => {
        spawnRipple(e, ref.current);
        haptic.light();
        onToggle();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          haptic.light();
          onToggle();
        }
      }}
      aria-pressed={item.done}
      aria-label={`${item.text}, ${item.done ? 'completed' : 'not completed'}`}
      className={`cursor-target group relative flex items-center gap-3 overflow-hidden rounded-xl border px-3.5 py-3 transition-colors duration-200 ${
        item.done
          ? 'bg-violet-500/[0.08] border-violet-500/30'
          : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
      }`}
    >
      <span className="shrink-0 pointer-events-none">
        {item.done ? (
          <CheckCircle2 className="h-5 w-5 text-violet-400" strokeWidth={2} />
        ) : (
          <Circle className="h-5 w-5 text-neutral-600 group-hover:text-neutral-400 transition-colors" strokeWidth={1.75} />
        )}
      </span>

      <span
        className={`flex-1 text-[13.5px] leading-snug transition-colors pointer-events-none ${
          item.done ? 'text-violet-200/70 line-through decoration-2 decoration-violet-400/80' : 'text-neutral-200'
        }`}
      >
        {item.text}
      </span>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label={`Delete "${item.text}"`}
        className="cursor-target shrink-0 rounded-lg p-1.5 text-neutral-700 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
      >
        <X className="h-4 w-4" />
      </button>

      {rippleNodes}
    </div>
  );
}

export function TodoTab() {
  const [todayStr, setTodayStr] = useState(() => getLocalDateString());
  const [store, setStore] = useState<TodoStore>(loadStore);
  const [draft, setDraft] = useState('');

  // Same "pulse check" pattern App.tsx uses to keep currentDateStr aligned
  // with the real clock — once local midnight passes, todayStr flips and
  // this component starts reading/writing a fresh (empty) day automatically.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = getLocalDateString();
      if (now !== todayStr) setTodayStr(now);
    }, 30000);
    return () => clearInterval(interval);
  }, [todayStr]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      /* storage unavailable — fail silently, nothing to do here */
    }
  }, [store]);

  const items = store[todayStr] || [];
  const doneCount = items.filter((i) => i.done).length;

  const setTodayItems = (updater: (prev: TodoItem[]) => TodoItem[]) => {
    setStore((prev) => ({ ...prev, [todayStr]: updater(prev[todayStr] || []) }));
  };

  const addItem = () => {
    const text = draft.trim();
    if (!text) return;
    setTodayItems((prev) => [...prev, { id: `todo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, text, done: false }]);
    setDraft('');
  };

  const toggleItem = (id: string) => {
    setTodayItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  };

  const deleteItem = (id: string) => {
    setTodayItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearCompleted = () => {
    setTodayItems((prev) => prev.filter((i) => !i.done));
  };

  const dayLabel = useMemo(() => {
    const [y, m, d] = todayStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }, [todayStr]);

  return (
    <div className="space-y-5 animate-fadeIn">
      <Card className="animate-fadeIn">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <EditableSectionHeading id="todo_list" defaultTitle="To-Do List" defaultIcon={ListChecks} subtitle={`${dayLabel} · resets fresh at midnight`} />
          {items.length > 0 && (
            <span className="text-[11px] text-neutral-500 shrink-0">
              {doneCount}/{items.length} done
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mb-5">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addItem();
            }}
            placeholder="What do you need to do today?"
            className="cursor-target flex-1 rounded-xl border border-neutral-800 bg-neutral-950/80 px-3.5 py-2.5 text-[13.5px] text-neutral-200 placeholder:text-neutral-600 outline-none transition-colors focus:border-violet-500/50"
          />
          <RippleButton
            onClick={addItem}
            disabled={!draft.trim()}
            ariaLabel="Add to-do item"
            className="cursor-target flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-violet-500 text-neutral-950 transition-opacity disabled:opacity-30 hover:bg-violet-400"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </RippleButton>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-800 py-10 text-center">
            <ListChecks className="h-6 w-6 text-neutral-700" strokeWidth={1.5} />
            <p className="text-[12.5px] text-neutral-600">Nothing on the list yet — add your first task above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <TodoRow key={item.id} item={item} onToggle={() => toggleItem(item.id)} onDelete={() => deleteItem(item.id)} />
            ))}
          </div>
        )}

        {doneCount > 0 && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={clearCompleted}
              className="cursor-target flex items-center gap-1.5 text-[11.5px] font-medium text-neutral-600 transition-colors hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear completed
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}