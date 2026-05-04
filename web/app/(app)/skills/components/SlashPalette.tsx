"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";

import type { SlashCommand } from "../state/slash-commands";

type Props = {
  open: boolean;
  commands: SlashCommand[];
  highlightedIndex: number;
  onSelect: (cmd: SlashCommand) => void;
  onHover: (index: number) => void;
};

/**
 * Dropdown que aparece sobre o composer quando o user digita "/" no input.
 * Lista comandos filtrados, suporta navegação por seta + Enter via parent
 * (parent cuida do KeyboardEvent porque o input não perde foco).
 */
export function SlashPalette({ open, commands, highlightedIndex, onSelect, onHover }: Props) {
  const listRef = useRef<HTMLUListElement | null>(null);

  // Auto-scroll pra manter highlighted visível
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[highlightedIndex] as HTMLElement | undefined;
    if (item) {
      const rect = item.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      if (rect.top < listRect.top) {
        list.scrollTop -= listRect.top - rect.top;
      } else if (rect.bottom > listRect.bottom) {
        list.scrollTop += rect.bottom - listRect.bottom;
      }
    }
  }, [highlightedIndex]);

  return (
    <AnimatePresence>
      {open && commands.length > 0 && (
        <motion.div
          className="skills-slash-palette"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
          role="listbox"
          aria-label="Comandos slash"
        >
          <ul ref={listRef} className="skills-slash-list">
            {commands.map((cmd, i) => {
              const active = i === highlightedIndex;
              return (
                <li
                  key={cmd.slug}
                  role="option"
                  aria-selected={active}
                  className={`skills-slash-item ${active ? "skills-slash-item--active" : ""}`}
                  onMouseEnter={() => onHover(i)}
                  onMouseDown={(e) => {
                    // mousedown em vez de click pra evitar perder foco do input
                    e.preventDefault();
                    onSelect(cmd);
                  }}
                >
                  <span className="skills-slash-label">{cmd.label}</span>
                  <span className="skills-slash-desc">{cmd.description}</span>
                </li>
              );
            })}
          </ul>
          <div className="skills-slash-footer">
            <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
            <span><kbd>↵</kbd> selecionar</span>
            <span><kbd>esc</kbd> fechar</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
