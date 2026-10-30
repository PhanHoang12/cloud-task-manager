import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  Bell,
  CheckCheck,
  MessageCircle,
  Clock3,
  AlertTriangle,
  UserPlus,
  X,
} from "lucide-react";
import "./collaboration.css";
import { getErrorMessage } from "../../lib/uiText";
import { useNonModalPopup } from "../../components/useNonModalPopup";
import { getNotificationTarget, notificationNavigationError, type NotificationTarget } from "../../lib/notificationNavigation";

const PANEL_WIDTH = 380;
const VIEWPORT_GAP = 12;


function getNotificationIcon(kind: string) {
  switch (kind) {
    case "deadline_upcoming":
      return <Clock3 size={20} />;

    case "deadline_overdue":
      return <AlertTriangle size={20} />;

    case "assigned":
      return <UserPlus size={20} />;

    case "comment":
    default:
      return <MessageCircle size={20} />;
  }
}

function formatTime(timestamp: number): string {
  const difference = Math.max(0, Date.now() - timestamp);
  const minute = 60_000;
  const hour = minute * 60;
  const day = hour * 24;

  if (difference < minute) return "Vừa xong";
  if (difference < hour) return `${Math.floor(difference / minute)} phút trước`;
  if (difference < day) return `${Math.floor(difference / hour)} giờ trước`;
  if (difference < day * 7) return `${Math.floor(difference / day)} ngày trước`;
  return new Date(timestamp).toLocaleDateString("vi-VN");
}

export default function NotificationCenter({ onNavigate }: { onNavigate?: (target: NotificationTarget, signal: AbortSignal) => Promise<boolean | void> }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState<Id<"notifications"> | null>(null);
  const navigationController = useRef<AbortController | null>(null);
  useEffect(() => () => navigationController.current?.abort(), []);
  const [panelPosition, setPanelPosition] = useState({ top: 64, left: 12, maxHeight: 480 });
  

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  const onClose = useCallback(() => {
    navigationController.current?.abort();
    navigationController.current = null;
    setOpeningId(null);
    setOpen(false);
  }, []);
  const dismiss = useNonModalPopup({ open, onClose, triggerRef: buttonRef, popupRef: panelRef });

  const notifications = useQuery(api.notifications.mine);
  const markRead = useMutation(api.notifications.markRead);
  const loading = notifications === undefined;
  const unreadCount = notifications?.filter((item) => !item.isRead).length;

  useEffect(() => {
    if (!open) return;

    function positionPanel() {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_GAP * 2);
      const left = Math.max(
        VIEWPORT_GAP,
        Math.min(rect.right - width, window.innerWidth - width - VIEWPORT_GAP)
      );
      const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_GAP * 2;
      const openAbove = spaceBelow < 240 && rect.top > spaceBelow;
      const maxHeight = Math.max(
        120,
        Math.min(520, openAbove ? rect.top - VIEWPORT_GAP * 2 : spaceBelow)
      );
      const top = openAbove
        ? Math.max(VIEWPORT_GAP, rect.top - maxHeight - 10)
        : rect.bottom + 10;

      setPanelPosition({ top, left, maxHeight });
    }

    positionPanel();
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);

    return () => {
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
    };
  }, [open]);

  async function handleActivate(item: Doc<"notifications">) {
    if (navigationController.current) return;
    const target = getNotificationTarget(item);
    if (item.isRead && !(target && onNavigate)) return;
    const controller = new AbortController();
    navigationController.current = controller;
    if (target && onNavigate) setOpeningId(item._id);
    let reading = !item.isRead;
    try {
      setError("");
      if (reading) await markRead({ notificationId: item._id });
      reading = false;
      if (controller.signal.aborted) return;
      if (target && onNavigate) {
        const opened = await onNavigate(target, controller.signal);
        if (opened !== false && !controller.signal.aborted) setOpen(false);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(!reading && target && onNavigate ? notificationNavigationError(err) : getErrorMessage(err, "Không thể đánh dấu thông báo đã đọc."));
      }
    } finally {
      if (navigationController.current === controller) {
        navigationController.current = null;
        setOpeningId(null);
      }
    }
  }

  return (
    <div className="notify-wrap">
      <button
        ref={buttonRef}
        type="button"
        className={`notify-btn${open ? " notify-btn-active" : ""}`}
        aria-label={loading ? "Thông báo, đang tải" : `Thông báo, ${unreadCount} chưa đọc`}
        aria-busy={loading}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          setError("");
          if (open) onClose();
          else setOpen(true);
        }}
      >
        <Bell size={21} strokeWidth={2.1} />
        {(loading || (unreadCount ?? 0) > 0) && (
          <span className="notify-badge" aria-hidden="true">
            {loading ? "…" : unreadCount! > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

        {open &&
      createPortal(
        <div
          ref={panelRef}
          className="notify-panel"
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={panelId + "-title"}
          tabIndex={-1}
          style={{
            position: "fixed",
            top: panelPosition.top,
            left: panelPosition.left,
            maxHeight: panelPosition.maxHeight,
            zIndex: 99999,
          }}
        >
          <div className="notify-header">
            <div>
              <h3 id={panelId + "-title"}>Thông báo</h3>
              <p>{loading ? "Đang tải số thông báo chưa đọc…" : unreadCount ? `${unreadCount} thông báo chưa đọc` : "Bạn đã đọc hết thông báo"}</p>
            </div>
            <button
              type="button"
              className="notify-close"
              aria-label="Đóng thông báo"
              onClick={dismiss}
            >
              <X size={18} />
            </button>
          </div>

          {error && <p className="notify-error" role="alert">{error}</p>}
          {openingId && <p className="notify-navigation-status" role="status">Đang mở nội dung liên quan…</p>}

          {loading && <p className="notify-navigation-status" role="status">Đang tải thông báo...</p>}
          <div className="notify-list" aria-busy={loading}>
            {notifications === undefined ? (
              null
            ) : notifications.length === 0 ? (
              <div className="notify-empty">
                <div className="notify-empty-icon"><CheckCheck size={27} /></div>
                <strong>Chưa có thông báo</strong>
                <p>Các cập nhật về công việc và dự án sẽ xuất hiện ở đây.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  type="button"
                  key={item._id}
                  className={`notify-item${item.isRead ? "" : " unread"}`}
                  aria-label={`${item.message}${item.isRead ? "" : ", chưa đọc"}${onNavigate && getNotificationTarget(item) ? getNotificationTarget(item)?.taskId ? ", mở công việc" : ", mở dự án" : ""}`}
                  aria-busy={openingId === item._id}
                  onClick={() => void handleActivate(item)}
                >
                  <span className={`notify-icon notify-icon-${item.kind}`}>{getNotificationIcon(item.kind)}</span>
                  <span className="notify-content">
                    <span className="notify-message">{item.message}</span>
                    <span className="notify-time">{formatTime(item.createdAt)}</span>
                    {onNavigate && getNotificationTarget(item) && <span className="notify-destination">{getNotificationTarget(item)?.taskId ? "Mở công việc" : "Mở dự án"}</span>}
                  </span>
                  {!item.isRead && <span className="notify-dot" aria-hidden="true" />}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
