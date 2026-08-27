const SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function trapFocus(container: HTMLElement) {
  const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const list = () => [...container.querySelectorAll<HTMLElement>(SELECTOR)];
  list()[0]?.focus();

  function onKey(e: KeyboardEvent) {
    if (e.key !== "Tab") return;
    const items = list();
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  document.addEventListener("keydown", onKey);
  return () => {
    document.removeEventListener("keydown", onKey);
    prev?.focus();
  };
}
