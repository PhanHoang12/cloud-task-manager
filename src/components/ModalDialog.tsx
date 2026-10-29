import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

type ModalDialogProps = {
  children: ReactNode;
  className: string;
  label: string;
  busy: boolean;
  onDismiss: () => void;
};

function focusableElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(
    'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex], [contenteditable="true"]',
  )).filter(element =>
    element.tabIndex >= 0 &&
    !element.matches(":disabled") &&
    !element.closest("[hidden], [inert]") &&
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== "hidden",
  );
}

/** Mounted only while open. Native modality makes the rest of the document inert. */
export default function ModalDialog({ children, className, label, busy, onDismiss }: ModalDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const element = dialog.current!;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const fallbackScope = opener?.closest<HTMLElement>("main, .ws-page, .kb-page");
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    element.showModal();

    const controls = focusableElements(element);
    (controls.find(control => control.matches("input, textarea, select")) ?? controls[0] ?? element).focus();

    return () => {
      element.close();
      document.documentElement.style.overflow = previousOverflow;
      if (opener?.isConnected && !opener.matches(":disabled") && opener.getClientRects().length) {
        opener.focus();
      } else if (fallbackScope?.isConnected) {
        focusableElements(fallbackScope).find(control => !element.contains(control))?.focus();
      }
    };
  }, []);

  // Disabling a focused field during save can move focus to the document body.
  useLayoutEffect(() => {
    const element = dialog.current;
    if (element?.open && (!element.contains(document.activeElement) ||
      (document.activeElement instanceof HTMLElement && document.activeElement.matches(":disabled")))) {
      element.focus();
    }
  }, [busy]);

  function trapTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab" || event.defaultPrevented) return;
    const element = dialog.current!;
    const controls = focusableElements(element);
    const first = controls[0];
    const last = controls[controls.length - 1];
    const active = document.activeElement;
    if (!first) {
      event.preventDefault();
      element.focus();
    } else if (active === element || !element.contains(active) ||
      (event.shiftKey ? active === first : active === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  return <dialog
    ref={dialog}
    className={`ui-modal ${className}`}
    aria-label={label}
    aria-modal="true"
    onKeyDown={trapTab}
    onCancel={event => {
      event.preventDefault();
      if (!busy) onDismiss();
    }}
    onMouseDown={event => {
      if (event.target === event.currentTarget && !busy) {
        // Avoid the pointer default action clearing focus after unmount restores it.
        event.preventDefault();
        onDismiss();
      }
    }}
  >{children}</dialog>;
}
