import { useCallback, useLayoutEffect, type RefObject } from "react";

function tabStops(root: ParentNode) {
  return Array.from(root.querySelectorAll<HTMLElement>(
    'a[href], button, input:not([type="hidden"]), select, textarea, summary, iframe, [tabindex], [contenteditable="true"]',
  )).filter(element => element.tabIndex >= 0 && !element.matches(":disabled") &&
    !element.closest("[hidden], [inert]") && getComputedStyle(element).visibility !== "hidden" &&
    Array.from(element.getClientRects()).some(rect => rect.width > 0 && rect.height > 0)
  ).sort((a, b) => (a.tabIndex > 0 ? a.tabIndex : Number.MAX_SAFE_INTEGER) -
    (b.tabIndex > 0 ? b.tabIndex : Number.MAX_SAFE_INTEGER));
}

type PopupOptions = {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  popupRef: RefObject<HTMLElement | null>;
  insideRef?: RefObject<HTMLElement | null>;
};

/** Non-modal focus transitions. Boundary Tab exits, rather than wrapping inside the popup. */
export function useNonModalPopup({ open, onClose, triggerRef, popupRef, insideRef }: PopupOptions) {
  const dismiss = useCallback(() => {
    onClose();
    triggerRef.current?.focus({ preventScroll: true });
  }, [onClose, triggerRef]);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const popup = popupRef.current;
    if (!trigger || !popup) return;
    (tabStops(popup)[0] ?? popup).focus({ preventScroll: true });

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (trigger!.contains(target) || popup!.contains(target) || insideRef?.current?.contains(target)) return;
      // Pointer defaults may then focus the clicked outside control; never steal that focus back.
      if (popup!.contains(document.activeElement)) dismiss();
      else onClose();
    }
    function onFocusIn(event: FocusEvent) {
      const target = event.target as Node;
      if (!trigger!.contains(target) && !popup!.contains(target)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const target = event.target as Node;
      if (!trigger!.contains(target) && !popup!.contains(target)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = tabStops(popup!);
      if (target === trigger) {
        if (event.shiftKey) onClose();
        else {
          event.preventDefault();
          (controls[0] ?? popup!).focus({ preventScroll: true });
        }
      } else if (event.shiftKey && (target === controls[0] || target === popup)) {
        event.preventDefault();
        dismiss();
      } else if (!event.shiftKey && (target === controls.at(-1) || controls.length === 0)) {
        const outside = tabStops(document).filter(element => !popup!.contains(element));
        const next = outside[outside.indexOf(trigger!) + 1];
        onClose();
        if (next && next !== trigger) {
          event.preventDefault();
          next.focus();
        } else {
          // At the end of the document, leave the browser's native Tab exit available.
          trigger!.focus({ preventScroll: true });
        }
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, triggerRef, popupRef, insideRef, dismiss]);

  return dismiss;
}
