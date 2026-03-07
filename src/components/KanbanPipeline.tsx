import { useState } from 'react';

export type KanbanItem = {
  id: string;
  title: string;
  subtitle?: string;
  score?: number;
  tag?: string;
};

export type KanbanColumn = {
  title: string;
  statusKey: string;
  color: string;      // tailwind bg-* e.g. 'bg-blue-500'
  lightColor: string; // e.g. 'bg-blue-50 dark:bg-blue-950/30'
  textColor: string;  // e.g. 'text-blue-700 dark:text-blue-300'
  ringColor: string;  // e.g. 'ring-blue-400/50'
  borderDash: string; // e.g. 'border-blue-400/40'
  items: KanbanItem[];
};

type Props = {
  columns: KanbanColumn[];
  onMove?: (itemId: string, fromStatus: string, toStatus: string) => Promise<void>;
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-blue-400';
  return (
    <div className="flex items-center gap-1.5 mt-2">
      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-bold tabular-nums text-muted-foreground w-5 text-right">{score}</span>
    </div>
  );
}

export default function KanbanPipeline({ columns, onMove }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [movingIds, setMovingIds] = useState<Set<string>>(new Set());

  const handleDragEnd = () => {
    setDragId(null);
    setDragFrom(null);
    setDropTarget(null);
  };

  const handleDrop = async (toStatus: string) => {
    if (!dragId || !dragFrom || dragFrom === toStatus) {
      setDropTarget(null);
      return;
    }
    const id = dragId;
    const from = dragFrom;
    setDropTarget(null);
    setDragId(null);
    setDragFrom(null);
    setMovingIds(prev => new Set(prev).add(id));
    try {
      await onMove?.(id, from, toStatus);
    } finally {
      setMovingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const isDragging = !!dragId;

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {columns.map(col => {
        const isTarget = dropTarget === col.statusKey && dragFrom !== col.statusKey;

        return (
          <div
            key={col.statusKey}
            className={[
              'rounded-2xl border p-4 transition-all duration-150',
              isTarget
                ? `${col.lightColor} ring-2 ${col.ringColor} border-transparent scale-[1.01]`
                : isDragging && dragFrom !== col.statusKey
                  ? 'border-dashed opacity-80'
                  : 'bg-card border-border',
            ].join(' ')}
            onDragOver={e => { e.preventDefault(); setDropTarget(col.statusKey); }}
            onDragLeave={e => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null);
            }}
            onDrop={e => { e.preventDefault(); void handleDrop(col.statusKey); }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${col.color} shadow-sm`} />
                <span className="text-sm font-semibold">{col.title}</span>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.lightColor} ${col.textColor}`}>
                {col.items.length}
              </span>
            </div>

            {/* Drop hint */}
            {isTarget && (
              <div className={`rounded-xl border-2 border-dashed ${col.borderDash} h-12 mb-2 flex items-center justify-center animate-pulse`}>
                <span className={`text-xs font-medium ${col.textColor}`}>Slip her ↓</span>
              </div>
            )}

            {/* Cards */}
            <div className="space-y-2 min-h-[60px]">
              {col.items.length === 0 && !isTarget && (
                <div className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-xl border-border/50">
                  {onMove ? 'Træk leads hertil' : '—'}
                </div>
              )}

              {col.items.map(item => {
                const isBeingDragged = item.id === dragId;
                const isMoving = movingIds.has(item.id);

                return (
                  <div
                    key={item.id}
                    draggable={!!onMove}
                    onDragStart={() => { setDragId(item.id); setDragFrom(col.statusKey); }}
                    onDragEnd={handleDragEnd}
                    className={[
                      'rounded-xl border bg-background p-3 text-sm select-none',
                      onMove ? 'cursor-grab active:cursor-grabbing' : '',
                      'hover:shadow-md hover:-translate-y-0.5 transition-all duration-150',
                      isBeingDragged ? 'opacity-30 scale-95' : '',
                      isMoving ? 'opacity-60 animate-pulse cursor-wait' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-tight flex-1 min-w-0 truncate">{item.title}</p>
                      {item.tag && (
                        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-semibold ${col.lightColor} ${col.textColor}`}>
                          {item.tag}
                        </span>
                      )}
                    </div>
                    {item.subtitle && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.subtitle}</p>
                    )}
                    {item.score !== undefined && <ScoreBar score={item.score} />}
                    {isMoving && <p className="text-[10px] text-muted-foreground mt-1.5">Opdaterer…</p>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
