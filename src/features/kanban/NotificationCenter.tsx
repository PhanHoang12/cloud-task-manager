import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Bell, CheckCheck, MessageCircle, X } from "lucide-react";
import "./collaboration.css";

const PANEL_WIDTH = 380;
const VIEWPORT_GAP = 12;

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

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [panelPosition, setPanelPosition] = useState({ top: 64, left: 12, maxHeight: 480 });
  

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const notifications = useQuery(api.notifications.mine);
  const markRead = useMutation(api.notifications.markRead);
  const unreadCount = notifications?.filter((item) => !item.isRead).length ?? 0;

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

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    positionPanel();
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleRead(notificationId: Id<"notifications">, isRead: boolean) {
    if (isRead) return;
    try {
      setError("");
      await markRead({ notificationId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đánh dấu thông báo đã đọc.");
    }
  }

  return (
    <div className="notify-wrap">
      <button
        ref={buttonRef}
        type="button"
        className={`notify-btn${open ? " notify-btn-active" : ""}`}
        aria-label={`Thông báo, ${unreadCount} chưa đọc`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setError("");
          setOpen((previous) => !previous);
        }}
      >
        <Bell size={21} strokeWidth={2.1} />
        {unreadCount > 0 && (
          <span className="notify-badge" aria-hidden="true">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

        {open &&
      createPortal(
        <div
          ref={panelRef}
          className="notify-panel"
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
              <h3>Thông báo</h3>
              <p>{unreadCount ? `${unreadCount} thông báo chưa đọc` : "Bạn đã đọc hết thông báo"}</p>
            </div>
            <button
              type="button"
              className="notify-close"
              aria-label="Đóng thông báo"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          {error && <p className="notify-error" role="alert">{error}</p>}

          <div className="notify-list">
            {notifications === undefined ? (
              <div className="notify-empty">Đang tải thông báo...</div>
            ) : notifications.length === 0 ? (
              <div className="notify-empty">
                <div className="notify-empty-icon"><CheckCheck size={27} /></div>
                <strong>Chưa có thông báo</strong>
                <p>Bình luận mới liên quan đến công việc sẽ xuất hiện ở đây.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  type="button"
                  key={item._id}
                  className={`notify-item${item.isRead ? "" : " unread"}`}
                  aria-label={`${item.message}${item.isRead ? "" : ", chưa đọc"}`}
                  onClick={() => void handleRead(item._id, item.isRead)}
                >
                  <span className="notify-icon"><MessageCircle size={20} /></span>
                  <span className="notify-content">
                    <span className="notify-message">{item.message}</span>
                    <span className="notify-time">{formatTime(item.createdAt)}</span>
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
