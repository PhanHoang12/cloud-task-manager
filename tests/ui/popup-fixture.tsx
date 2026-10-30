import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "../../src/App";
import { FeedbackProvider } from "../../src/components/Feedback";
import "../../src/style.css";
import "../../src/components/ui.css";

createRoot(document.getElementById("root")!).render(<StrictMode><FeedbackProvider><App /></FeedbackProvider>
  <button hidden data-testid="security-focus">Bảo mật từ dịch vụ tài khoản</button>
</StrictMode>);
