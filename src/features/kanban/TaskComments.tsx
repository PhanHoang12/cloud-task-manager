
import { useState, type FormEvent } from "react";
import { useUser } from "@clerk/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  MessageCircle,
  ChevronDown,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";
import "./collaboration.css";

import { useAction, useFeedback } from "../../components/Feedback";

type Props = {
  taskId: Id<"projectTasks">;
  canComment: boolean;
  canModerate: boolean;
};

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TaskComments({
  taskId,
  canComment,
  canModerate,
}: Props) {
  const { user } = useUser();

  const comments = useQuery(api.comments.list, { taskId });
  const create = useMutation(api.comments.create);
  const remove = useMutation(api.comments.remove);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const { run, pending } = useAction();
  const { confirm } = useFeedback();
  const busy = pending === "create";
  const deletingId = pending === "create" ? null : pending;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = text.trim();
    if (!content || pending || !canComment) return;
    if (await run(() => create({ taskId, content }), "Đã gửi bình luận.", "Không gửi được bình luận.", "create")) setText("");
  }

  async function deleteComment(id: Id<"taskComments">) {
    if (pending || !await confirm({ title: "Xóa bình luận?", description: "Bình luận này sẽ bị xóa. Bạn không thể hoàn tác thao tác này." })) return;
    await run(() => remove({ commentId: id }), "Đã xóa bình luận.", "Không xóa được bình luận.", id);
  }

  return (
    <section className="tc-panel">
      <button
        type="button"
        className="tc-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="tc-toggle-left">
          <MessageCircle size={17} />
          <span>Thảo luận</span>
          <span className="tc-count">
            {comments?.length ?? "…"}
          </span>
        </span>

        <ChevronDown
          size={17}
          className={`tc-chevron ${open ? "is-open" : ""}`}
        />
      </button>

      {open && (
        <div className="tc-content">
          <div className="tc-list">
            {comments === undefined ? (
              <p className="tc-empty">Đang tải bình luận...</p>
            ) : comments.length === 0 ? (
              <div className="tc-empty">
                <MessageCircle size={24} />
                <p>Chưa có bình luận</p>
                <span>Hãy bắt đầu cuộc thảo luận.</span>
              </div>
            ) : (
              comments.map((comment) => {
                const mine = comment.authorId === user?.id;

                const authorName = mine
                  ? (user?.firstName ||
                     user?.fullName ||
                     "Tôi")
                  : `Thành viên ${comment.authorId.slice(-4)}`;

                const canDelete = canModerate || mine;

                return (
                  <div
                    key={comment._id}
                    className="tc-comment"
                  >
                    <div
                      className={`tc-avatar ${
                        mine ? "mine" : "other"
                      }`}
                    >
                      {mine && user?.firstName ? (
                        user.firstName.charAt(0).toUpperCase()
                      ) : (
                        <UserRound size={16} />
                      )}
                    </div>

                    <div className="tc-comment-body">
                      <div className="tc-meta">
                        <strong className="tc-author">
                          {authorName}
                        </strong>

                        <time className="tc-time">
                          {formatDate(comment.createdAt)}
                        </time>
                      </div>

                      <div className="tc-bubble">
                        {comment.content}
                      </div>

                      {canDelete && (
                        <button
                          type="button"
                          className="tc-delete ui-button ui-danger"
                          aria-busy={deletingId === comment._id}
                          disabled={pending!==null}
                          onClick={() =>
                            void deleteComment(comment._id)
                          }
                        >
                          <Trash2 size={12} />
                          {deletingId === comment._id
                            ? "Đang xóa..."
                            : "Xóa"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {canComment && (
            <form className="tc-form" onSubmit={submit}>
              <textarea
                className="tc-input"
                disabled={pending!==null}
                aria-label="Viết bình luận"
                placeholder="Viết bình luận cho nhóm..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                maxLength={2000}
              />

              <div className="tc-form-footer">
                <span>{text.length}/2000</span>

                <button
                  type="submit"
                  className="tc-send ui-button ui-primary"
                  aria-busy={busy}
                  disabled={pending!==null || !text.trim()}
                >
                  <Send size={15} />
                  {busy ? "Đang gửi..." : "Gửi"}
                </button>
              </div>
            </form>
          )}


        </div>
      )}
    </section>
  );
}
