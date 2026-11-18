import { Component, useEffect, useId, useRef, type ReactNode } from "react";
import "./screen-error.css";

type Props = {
  children: ReactNode;
  scope: string;
  resetKey?: string;
  onReturn?: () => void;
  returnLabel?: string;
  compact?: boolean;
  allowReload?: boolean;
};
type State = { hasError: boolean; error: unknown; resetKey?: string };
type FailureKind = "authentication" | "permission" | "unknown";

function errorRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}

function failureKind(error: unknown): FailureKind {
  const record = errorRecord(error);
  const data = errorRecord(record?.data);
  // Honor explicit codes/statuses before legacy message matching.
  for (const candidate of [data, record]) {
    if (!candidate) continue;
    const code = typeof candidate.code === "string" ? candidate.code.toUpperCase() : "";
    const status = candidate.status ?? candidate.statusCode;
    if (["FORBIDDEN", "PERMISSION_DENIED", "ACCESS_DENIED"].includes(code) || Number(status) === 403) return "permission";
    if (["UNAUTHENTICATED", "UNAUTHORIZED", "AUTH_REQUIRED", "AUTHENTICATION_REQUIRED", "SESSION_EXPIRED"].includes(code) || Number(status) === 401) return "authentication";
  }
  const messages = [
    typeof record?.data === "string" ? record.data : "",
    typeof record?.message === "string" ? record.message : "",
    typeof error === "string" ? error : "",
  ].join("\n");
  if (/bạn cần đăng nhập|chưa đăng nhập|not authenticated|authentication required|unauthenticated|unauthorized|clerk phải cung cấp email đã xác minh/i.test(messages)) return "authentication";
  if (/không có quyền|không thuộc workspace|không phải thành viên workspace|cần quyền owner|chỉ owner|permission denied|access denied|forbidden/i.test(messages)) return "permission";
  return "unknown";
}

const guidance = {
  authentication: {
    title: "Could not verify your account",
    message: "Your sign-in could not be verified. Check your session or reload the page. If this continues, contact your administrator.",
  },
  permission: {
    title: "You cannot access this content",
    message: "This content may no longer be available with your current permissions. Choose another item or ask the owner to check your access.",
  },
  unknown: {
    title: "We could not display this content",
    message: "This item may be temporarily unavailable or your access may have changed. Try again or choose another item.",
  },
};

function FailureNotice({ error, scope, onRetry, onReturn, returnLabel, compact, allowReload }: Omit<Props, "children" | "resetKey"> & { error: unknown; onRetry: () => void }) {
  const id = useId();
  const region = useRef<HTMLElement>(null);
  const copy = guidance[failureKind(error)];
  useEffect(() => {
    // Recover lost focus without stealing it from working navigation or sibling controls.
    if (document.activeElement === document.body) region.current?.focus();
  }, []);
  return <section
    ref={region}
    tabIndex={-1}
    className={`ui-card ui-error-state${compact ? " ui-error-state-compact" : ""}`}
    role="alert"
    aria-labelledby={id + "-title"}
    aria-describedby={id + "-description"}
  >
    <h2 id={id + "-title"}>{copy.title}</h2>
    <p className="ui-error-scope">{scope}</p>
    <p id={id + "-description"}>{copy.message}</p>
    <div className="ui-error-actions">
      <button type="button" className="ui-button ui-primary" onClick={onRetry}>Try again</button>
      {onReturn && <button type="button" className="ui-button ui-secondary" onClick={onReturn}>{returnLabel ?? "Go back"}</button>}
      {allowReload && <button type="button" className="ui-button ui-secondary" onClick={() => window.location.reload()}>Reload page</button>}
    </div>
  </section>;
}

/** Handles render/query errors only; existing async mutation handlers keep their own feedback. */
export default class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { hasError: true, error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey
      ? { hasError: false, error: null, resetKey: props.resetKey }
      : null;
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <FailureNotice
      error={this.state.error}
      scope={this.props.scope}
      compact={this.props.compact}
      allowReload={this.props.allowReload}
      onReturn={this.props.onReturn}
      returnLabel={this.props.returnLabel}
      onRetry={() => this.setState({ hasError: false, error: null })}
    />;
  }
}
