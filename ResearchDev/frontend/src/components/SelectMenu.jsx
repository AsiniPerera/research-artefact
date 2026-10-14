/* Used by QuickFilters for the city and status pills. */
import { Fragment, useEffect, useRef, useState } from "react";
import { IconChevron } from "./Icons";

/**
 * A listbox in the shape of a quick-filter pill.
 *
 * A native <select>'s option list is drawn by the operating system, not the
 * page — CSS cannot reach inside it, so it stays a square system menu however
 * the control that opens it is styled. This is the only way for the open
 * state to match the glass around it.
 *
 * Everything the native element gave away for free has to be rebuilt:
 * keyboard opening, arrow movement, Home/End, Escape, and the ARIA that says
 * this is a listbox at all. Focus stays on the button and the active option
 * is named by aria-activedescendant — the pattern that keeps that promise
 * with the least machinery.
 *
 *   options  [{ value, label }]
 *   display  what the closed button reads; defaults to the chosen label
 *   icon     optional decorative glyph shown before the label
 */
export function SelectMenu({ label, value, options, onChange, display, icon }) {
  const [open, setOpen] = useState(false);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const [active, setActive] = useState(idx);
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const id = `sel-${label.toLowerCase().replace(/\W+/g, "")}`;

  /* Reopening starts from what is chosen, not from wherever the pointer last
     wandered before it closed. */
  useEffect(() => {
    if (open) setActive(idx);
  }, [open, idx]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  /* There is deliberately NO scroll-to-close here. An earlier version had
     one, and the option list is itself scrollable: keeping the active option
     in view scrolled it, that scroll reached the handler, and the menu shut
     before the mouse could come down — every option below the first was
     unclickable. Closing on scroll is a nicety; being able to pick an option
     is not, so the nicety went. */

  function choose(i) {
    onChange(options[i].value);
    setOpen(false);
    btnRef.current?.focus();
  }

  function onKeyDown(e) {
    const last = options.length - 1;

    if (!open) {
      /* The keys that open a native select, so the replacement answers to the
         same ones rather than to a vocabulary of its own. */
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "Escape":    e.preventDefault(); setOpen(false); btnRef.current?.focus(); break;
      case "ArrowDown": e.preventDefault(); setActive((i) => Math.min(last, i + 1)); break;
      case "ArrowUp":   e.preventDefault(); setActive((i) => Math.max(0, i - 1)); break;
      case "Home":      e.preventDefault(); setActive(0); break;
      case "End":       e.preventDefault(); setActive(last); break;
      case "Enter":
      case " ":         e.preventDefault(); choose(active); break;
      case "Tab":       setOpen(false); break;
      default: break;
    }
  }

  return (
    <div className="qf-field qf-select" ref={rootRef}>
      {icon && <span className="qf-field-icon" aria-hidden="true">{icon}</span>}
      <span className="qf-field-label" id={`${id}-label`}>{label}</span>

      <button
        type="button"
        ref={btnRef}
        className="qf-select-btn"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-list`}
        aria-labelledby={`${id}-label`}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        {display ?? options[idx]?.label}
        <span className="qf-select-caret" aria-hidden="true">
          <IconChevron size={13} />
        </span>
      </button>

      {open && (
        <ul
          className="qf-menu"
          id={`${id}-list`}
          role="listbox"
          ref={listRef}
          aria-labelledby={`${id}-label`}
        >
          {options.map((o, i) => (
            /* An option carrying a `group` different from the one before it
               opens a new section. The heading is role="presentation" and is
               NOT an option, so `active` still indexes `options` directly and
               arrow keys skip the headings rather than landing on them. */
            <Fragment key={o.value}>
              {o.group && o.group !== options[i - 1]?.group && (
                <li className="qf-optgroup" role="presentation">{o.group}</li>
              )}
              <li
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={o.value === value}
                className={`qf-opt ${o.value === value ? "is-on" : ""} ${
                  i === active ? "is-active" : ""
                }`}
                onClick={() => choose(i)}
                onMouseEnter={() => setActive(i)}
              >
                {o.label}
              </li>
            </Fragment>
          ))}
        </ul>
      )}
    </div>
  );
}
