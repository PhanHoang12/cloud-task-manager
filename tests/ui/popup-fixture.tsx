import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "../../src/App";
import { FeedbackProvider } from "../../src/components/Feedback";
import "../../src/style.css";
import "../../src/components/ui.css";
import { BrowserRouter } from "react-router";

// Test entry only: scenario parameters remain available to the service mocks.
if (location.pathname === "/tests/ui/popup-fixture.html") history.replaceState(null, "", "/workspaces" + location.search);

createRoot(document.getElementById("root")!).render(<StrictMode><BrowserRouter><FeedbackProvider><App /></FeedbackProvider></BrowserRouter>
  <button hidden data-testid="security-focus">Bảo mật từ dịch vụ tài khoản</button>
</StrictMode>);
