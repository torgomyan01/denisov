"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";

type DragPayload = {
  group: string;
  index: number;
};

type DndContextValue = {
  active: DragPayload | null;
  overIndex: number | null;
  overGroup: string | null;
  beginDrag: (payload: DragPayload) => void;
  setOver: (group: string, index: number) => void;
  clear: () => void;
};

const DndContext = createContext<DndContextValue | null>(null);

export const DndProvider = ({ children }: { children: ReactNode }) => {
  const [active, setActive] = useState<DragPayload | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [overGroup, setOverGroup] = useState<string | null>(null);

  const beginDrag = useCallback((payload: DragPayload) => {
    setActive(payload);
    setOverIndex(payload.index);
    setOverGroup(payload.group);
  }, []);

  const setOver = useCallback((group: string, index: number) => {
    setOverGroup(group);
    setOverIndex(index);
  }, []);

  const clear = useCallback(() => {
    setActive(null);
    setOverIndex(null);
    setOverGroup(null);
  }, []);

  return (
    <DndContext.Provider value={{ active, overIndex, overGroup, beginDrag, setOver, clear }}>
      {children}
    </DndContext.Provider>
  );
};

const useDnd = (): DndContextValue => {
  const ctx = useContext(DndContext);
  if (!ctx) throw new Error("useDnd must be used within DndProvider");
  return ctx;
};

export const SortableItem = ({
  group,
  index,
  onReorder,
  className = "",
  bodyClassName = "",
  children,
}: {
  group: string;
  index: number;
  onReorder: (from: number, to: number) => void;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) => {
  const { active, overIndex, overGroup, beginDrag, setOver, clear } = useDnd();
  const handleRef = useRef<HTMLButtonElement>(null);

  const isDragging = active?.group === group && active.index === index;
  const isOver =
    overGroup === group &&
    overIndex === index &&
    active !== null &&
    !(active.group === group && active.index === index);

  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ group, index }));
    beginDrag({ group, index });
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOver(group, index);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData("text/plain");
      const payload = JSON.parse(raw) as DragPayload;
      if (payload.group !== group) return;
      if (payload.index === index) return;
      onReorder(payload.index, index);
    } catch {
      /* ignore bad payload */
    } finally {
      clear();
    }
  };

  const onDragEnd = () => clear();

  return (
    <div
      className={`sortable-item ${className}${isDragging ? " is-dragging" : ""}${isOver ? " is-drop-target" : ""}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <button
        ref={handleRef}
        type="button"
        className="drag-handle"
        draggable
        aria-label="Перетащить"
        title="Перетащить"
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>
      <div className={`sortable-body ${bodyClassName}`.trim()}>{children}</div>
    </div>
  );
};
