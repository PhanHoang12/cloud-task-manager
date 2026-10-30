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
    title: "Không thể xác minh tài khoản",
    message: "Thông tin đăng nhập chưa được xác thực. Hãy kiểm tra phiên đăng nhập hoặc tải lại trang. Nếu lỗi vẫn tiếp diễn, hãy liên hệ quản trị viên.",
  },
  permission: {
    title: "Không thể truy cập nội dung",
    message: "Nội dung có thể không còn khả dụng với quyền truy cập hiện tại. Hãy chọn mục khác hoặc liên hệ chủ sở hữu để kiểm tra quyền truy cập.",
  },
  unknown: {
    title: "Không thể hiển thị nội dung",
    message: "Không thể tải hoặc hiển thị mục này. Nội dung có thể tạm thời không khả dụng hoặc quyền truy cập đã thay đổi. Bạn có thể thử lại hoặc chọn mục khác.",
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
      <button type="button" className="ui-button ui-primary" onClick={onRetry}>Thử lại</button>
      {onReturn && <button type="button" className="ui-button ui-secondary" onClick={onReturn}>{returnLabel ?? "Quay lại"}</button>}
      {allowReload && <button type="button" className="ui-button ui-secondary" onClick={() => window.location.reload()}>Tải lại trang</button>}
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
