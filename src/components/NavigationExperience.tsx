import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { NotificationNavigation } from "../lib/notificationNavigation";

export type AppRoute = {
  page: "workspace" | "personal" | "profile";
  workspaceId: Id<"workspaces"> | null;
  projectId: Id<"projects"> | null;
  notification: NotificationNavigation | null;
};
const initialRoute: AppRoute = { page: "workspace", workspaceId: null, projectId: null, notification: null };
const discardMessage = "Bạn có thay đổi chưa lưu. Rời khỏi đây sẽ bỏ các thay đổi này. Bạn có muốn tiếp tục?";
export function confirmDiscard(dirty: boolean, busy = false) {
  return !busy && (!dirty || window.confirm(discardMessage));
}
type Guard = { dirty: boolean; busy: boolean };
type ViewStore = ReturnType<typeof createViewStore>;
function createViewStore() {
  const values = new Map<string, unknown>();
  const listeners = new Set<() => void>();
  return {
    get<T,>(key: string, initial: T): T {
      if (!values.has(key)) values.set(key, initial);
      return values.get(key) as T;
    },
    set<T,>(key: string, initial: T, action: SetStateAction<T>) {
      const before = this.get(key, initial);
      const after = typeof action === "function" ? (action as (value: T) => T)(before) : action;
      if (Object.is(before, after)) return;
      values.set(key, after);
      listeners.forEach(listener => listener());
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
type Navigation = {
  route: AppRoute;
  go: (patch: Partial<AppRoute>) => boolean;
  allowLeave: () => boolean;
  adoptWorkspace: (id: Id<"workspaces">) => void;
  clearNotice: () => void;
  guards: Map<symbol, Guard>;
  views: ViewStore;
};
const NavigationContext = createContext<Navigation | null>(null);
export const useAppNavigation = () => useContext(NavigationContext);

/** Only a random entry token/index enters history.state. Context and filters stay in this mounted session. */
export function NavigationProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState(initialRoute);
  const current = useRef(route);
  const [notice, setNotice] = useState("");
  const [views] = useState(createViewStore);
  const guards = useRef(new Map<symbol, Guard>());
  const session = useRef(crypto.randomUUID());
  const index = useRef(0);
  const serial = useRef(0);
  const entries = useRef(new Map<string, AppRoute>());
  const restoring = useRef(false);
  const clearNotice = useCallback(() => setNotice(""), []);
  const allowLeave = useCallback(() => {
    const active = [...guards.current.values()];
    if (active.some(guard => guard.busy)) {
      setNotice("Đang lưu thay đổi. Hãy đợi thao tác hoàn tất trước khi chuyển trang.");
      return false;
    }
    const allowed = confirmDiscard(active.some(guard => guard.dirty));
    if (allowed) setNotice("");
    return allowed;
  }, []);
  function writeHistory(next: AppRoute, replace: boolean) {
    const key = String(++serial.current);
    if (!replace) index.current++;
    entries.current.set(key, next);
    const previous = history.state && typeof history.state === "object" ? history.state : {};
    history[replace ? "replaceState" : "pushState"]({
      ...previous, cloudTaskNavigation: { session: session.current, key, index: index.current },
    }, "");
  }
  const go = useCallback((patch: Partial<AppRoute>) => {
    if (restoring.current) return false;
    const next = { ...current.current, ...patch };
    if (next.page === current.current.page && next.workspaceId === current.current.workspaceId &&
      next.projectId === current.current.projectId && next.notification === current.current.notification) return true;
    if (!allowLeave()) return false;
    writeHistory(next, false);
    current.current = next;
    setRoute(next);
    return true;
  }, [allowLeave]);
  const adoptWorkspace = useCallback((id: Id<"workspaces">) => {
    if (current.current.page !== "workspace" || current.current.workspaceId !== null) return;
    const next = { ...current.current, workspaceId: id };
    writeHistory(next, true); current.current = next; setRoute(next);
  }, []);
  useLayoutEffect(() => {
    writeHistory(current.current, true);
    function onPop(event: PopStateEvent) {
      if (restoring.current) { restoring.current = false; return; }
      const entry = event.state?.cloudTaskNavigation;
      const next = entry?.session === session.current ? entries.current.get(entry.key) : undefined;
      if (!next || !Number.isInteger(entry.index)) return;
      if (!allowLeave()) {
        const distance = index.current - entry.index;
        if (distance) { restoring.current = true; history.go(distance); }
        return;
      }
      index.current = entry.index;
      current.current = next;
      setRoute(next);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [allowLeave]);
  return <NavigationContext.Provider value={{ route, go, allowLeave, adoptWorkspace, clearNotice, guards: guards.current, views }}>
    {notice && <p className="ui-navigation-notice" role="status">{notice}</p>}
    {children}
  </NavigationContext.Provider>;
}

/** Memory-only view preferences, never form drafts, profile data or browser storage. */
export function useViewState<T,>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const navigation = useAppNavigation();
  const [local] = useState(createViewStore);
  const store = navigation?.views ?? local;
  const value = useSyncExternalStore(store.subscribe, () => store.get(key, initial));
  const setValue = useCallback((action: SetStateAction<T>) => store.set(key, initial, action), [store, key, initial]);
  return [value, setValue];
}

/** Warn for explicit dismissals, app navigation, history traversal and document unload. */
export function useDraftGuard(dirty: boolean, busy = false) {
  const navigation = useAppNavigation();
  const token = useRef(Symbol("draft"));
  const registry = navigation?.guards;
  const clearNotice = navigation?.clearNotice;
  useLayoutEffect(() => {
    const key = token.current;
    registry?.set(key, { dirty, busy });
    if (registry && ![...registry.values()].some(guard => guard.busy)) clearNotice?.();
    function beforeUnload(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ""; }
    if (dirty || busy) window.addEventListener("beforeunload", beforeUnload);
    return () => {
      registry?.delete(key);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [registry, clearNotice, dirty, busy]);
  return (action: () => void) => { if (confirmDiscard(dirty, busy)) action(); };
}
