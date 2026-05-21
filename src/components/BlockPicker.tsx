"use client";

import { useEffect, useRef } from "react";
import { GherkinBlockType, GHERKIN_LABELS, GHERKIN_BLOCK_TYPES, canFollow } from "@/lib/gherkin";
import { STEP_TYPES } from "./GherkinDataTable";

export type InsertableType = GherkinBlockType | "image" | "data_table";

export const INSERTABLE_LABELS: Record<InsertableType, string> = {
  ...GHERKIN_LABELS,
  image: "Image",
  data_table: "Table",
};

export function getValidNextTypes(previous: GherkinBlockType | null): InsertableType[] {
  const types: InsertableType[] = [...GHERKIN_BLOCK_TYPES.filter((t) => canFollow(previous, t))];
  if (previous && STEP_TYPES.includes(previous)) types.push("data_table");
  if (previous !== null) types.push("image");
  return types;
}

export interface BlockPickerProps {
  anchor: DOMRect;
  options: InsertableType[];
  selectedIndex: number;
  onSelect: (type: InsertableType) => void;
  onClose: () => void;
}

export function BlockPicker({ anchor, options, selectedIndex, onSelect, onClose }: BlockPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="block-picker"
      style={{
        position: "fixed",
        top: anchor.bottom + 4,
        left: anchor.left,
        zIndex: 1000,
        minWidth: 160,
      }}
    >
      {options.map((type, i) => (
        <button
          key={type}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(type);
          }}
          className={`block-picker-item${i === selectedIndex ? " block-picker-item--active" : ""}`}
          style={{
            display: "block",
            width: "100%",
            padding: "8px 14px",
            textAlign: "left",
            border: "none",
            cursor: "pointer",
            background: "none",
          }}
        >
          {INSERTABLE_LABELS[type]}
        </button>
      ))}
    </div>
  );
}
