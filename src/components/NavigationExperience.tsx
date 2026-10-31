import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createPath, useLocation, useNavigate, useNavigationType, type Location } from "react-router";
import type { Id } from "../../convex/_generated/dataModel";
import { routeFromLocation, routePath, type AppRoute } from "../lib/appRoutes";
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
  location: Location;
};
const NavigationContext = createContext<Navigation | null>(null);
export const useAppNavigation = () => useContext(NavigationContext);

/** BrowserRouter owns history. Only filters and the last workspace destination stay in memory. */
export function NavigationProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const [accepted, setAccepted] = useState(location);
  const acceptedIndex = useRef<number | null>(window.history.state?.idx ?? null);
  const returning = useRef(false);
  // Declarative BrowserRouter has no useBlocker. Keep the existing screen mounted
  // during POP confirmation, then use only router navigation to accept or return.
  const visibleLocation = navigationType === "POP" ? accepted : location;
  const route = useMemo(() => routeFromLocation(visibleLocation), [visibleLocation]);
  const current = useRef(route);
  current.current = route;
  const lastWorkspace = useRef<Pick<AppRoute, "workspaceId" | "projectId">>({ workspaceId: null, projectId: null });
  const [notice, setNotice] = useState("");
  const [views] = useState(createViewStore);
  const guards = useRef(new Map<symbol, Guard>());
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
  const go = useCallback((patch: Partial<AppRoute>) => {
    if (returning.current) return false;
    const base = patch.page === "workspace" && current.current.page !== "workspace" ?
      { ...current.current, ...lastWorkspace.current } : current.current;
    const next = { ...base, ...patch };
    if (routePath(next) === createPath(visibleLocation) && !patch.notification) return true;
    if (!allowLeave()) return false;
    void navigate(routePath(next), { state: patch.notification ? { focusProject: !patch.notification.taskId } : null });
    return true;
  }, [allowLeave, navigate, visibleLocation]);
  const adoptWorkspace = useCallback((id: Id<"workspaces">) => {
    if (current.current.page !== "workspace" || current.current.workspaceId !== null) return;
    const next = { ...current.current, workspaceId: id };
    void navigate(routePath(next), { replace: true });
  }, [navigate]);
  useLayoutEffect(() => {
    if (location.key === accepted.key) { returning.current = false; return; }
    const nextIndex = window.history.state?.idx;
    if (navigationType === "POP" && !returning.current && !allowLeave()) {
      returning.current = true;
      if (typeof nextIndex === "number" && acceptedIndex.current !== null && nextIndex !== acceptedIndex.current) {
        void navigate(acceptedIndex.current - nextIndex);
      } else {
        // An entry created outside the router has no router index.
        void navigate(createPath(accepted), { replace: true, state: accepted.state });
      }
      return;
    }
    returning.current = false;
    acceptedIndex.current = typeof nextIndex === "number" ? nextIndex : null;
    setAccepted(location);
  }, [location, accepted, navigationType, navigate, allowLeave]);
  useLayoutEffect(() => {
    if (route.page === "workspace") lastWorkspace.current = { workspaceId: route.workspaceId, projectId: route.projectId };
  }, [route]);
  return <NavigationContext.Provider value={{ route, go, allowLeave, adoptWorkspace, clearNotice, guards: guards.current, views, location: visibleLocation }}>
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
