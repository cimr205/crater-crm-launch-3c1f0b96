const UNDO_DELAY_MS = 5000;

export interface UndoDeleteHandle {
  cancel: () => void;
}

export function scheduleDelete(
  onDelete: () => Promise<void>,
  onUndo?: () => void,
): UndoDeleteHandle {
  let cancelled = false;
  const timer = setTimeout(async () => {
    if (!cancelled) await onDelete();
  }, UNDO_DELAY_MS);

  return {
    cancel: () => {
      cancelled = true;
      clearTimeout(timer);
      onUndo?.();
    },
  };
}
