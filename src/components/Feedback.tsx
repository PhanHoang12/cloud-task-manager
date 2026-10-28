import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, X, Trash2 } from "lucide-react";

type Notice = { id: number; message: string; kind: "success" | "error" };
type Confirmation = { title: string; description: string; confirmLabel?: string };
type Feedback = {
  notify: (message: string, kind?: Notice["kind"]) => void;
  confirm: (options: Confirmation) => Promise<boolean>;
};
const FeedbackContext = createContext<Feedback | null>(null);

function Toast({ notice, dismiss }: { notice: Notice; dismiss: (id: number) => void }) {
  useEffect(() => {
    if (notice.kind === "error") return;
    const timer = window.setTimeout(() => dismiss(notice.id), 6000);
    return () => window.clearTimeout(timer);
  }, [notice.id, notice.kind, dismiss]);
  return <div className={`ui-toast ui-toast-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
    {notice.kind === "success" ? <CheckCircle2 size={20} aria-hidden="true" /> : <AlertCircle size={20} aria-hidden="true" />}
    <span>{notice.message}</span>
    <button className="ui-button ui-secondary ui-icon" type="button" aria-label="Đóng thông báo" onClick={() => dismiss(notice.id)}><X size={16} /></button>
  </div>;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const sequence = useRef(0);
  const resolver = useRef<((accepted: boolean) => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const dismiss = useCallback((id: number) => setNotices(items => items.filter(item => item.id !== id)), []);
  const notify = useCallback((message: string, kind: Notice["kind"] = "success") => {
    const id = ++sequence.current;
    setNotices(items => [...items.slice(-3), { id, message, kind }]);
  }, []);
  const confirm = useCallback((options: Confirmation) => {
    if (resolver.current) return Promise.resolve(false);
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return new Promise<boolean>(resolve => {
      resolver.current = resolve;
      setConfirmation(options);
    });
  }, []);
  const finish = useCallback((accepted: boolean) => {
    dialog.current?.close();
    if (returnFocus.current?.isConnected) returnFocus.current.focus();
    resolver.current?.(accepted);
    resolver.current = null;
    setConfirmation(null);
  }, []);
  useEffect(() => {
    if (!confirmation) return;
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, [confirmation]);
  useEffect(() => () => { resolver.current?.(false); }, []);
  return <FeedbackContext.Provider value={{ notify, confirm }}>
    {children}
    {createPortal(<>
      <div className="ui-toast-region" aria-label="Thông báo thao tác">{notices.map(notice => <Toast key={notice.id} notice={notice} dismiss={dismiss} />)}</div>
      {confirmation && <dialog ref={dialog} className="ui-confirm" aria-labelledby="ui-confirm-title" aria-describedby="ui-confirm-description" onKeyDown={event => {
        if (event.key !== "Tab") return;
        const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }} onCancel={event => { event.preventDefault(); finish(false); }}>
        <div className="ui-confirm-icon"><Trash2 size={24} aria-hidden="true" /></div>
        <h2 id="ui-confirm-title">{confirmation.title}</h2>
        <p id="ui-confirm-description">{confirmation.description}</p>
        <div className="ui-confirm-actions">
          <button className="ui-button ui-secondary" type="button" autoFocus onClick={() => finish(false)}>Hủy</button>
          <button className="ui-button ui-danger" type="button" onClick={() => finish(true)}>{confirmation.confirmLabel ?? "Xóa"}</button>
        </div>
      </dialog>}
    </>, document.body)}
  </FeedbackContext.Provider>;
}

export function useFeedback() {
  const feedback = useContext(FeedbackContext);
  if (!feedback) throw new Error("FeedbackProvider is required");
  return feedback;
}

// Lock synchronously as well as disabling controls, including rapid repeated clicks.
export function useAction() {
  const { notify } = useFeedback();
  const [pending, setPending] = useState<string | null>(null);
  const locked = useRef(false);
  async function run(action: () => Promise<unknown>, success: string, fallback: string, key = "action") {
    if (locked.current) return false;
    locked.current = true;
    setPending(key);
    try {
      await action();
      notify(success);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : fallback, "error");
      return false;
    } finally {
      locked.current = false;
      setPending(null);
    }
  }
  return { run, pending };
}
