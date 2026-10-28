import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import App from "./App";
import "./style.css";
import "./components/ui.css";
import { FeedbackProvider } from "./components/Feedback";
const clerkKey=import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const convexUrl=import.meta.env.VITE_CONVEX_URL;
if(!clerkKey || !convexUrl) throw new Error("Thiếu VITE_CLERK_PUBLISHABLE_KEY hoặc VITE_CONVEX_URL. Xem README.md");
const convex=new ConvexReactClient(convexUrl);
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
        <ClerkProvider
      publishableKey={clerkKey}
      afterSignOutUrl="/"
      proxyUrl={import.meta.env.VITE_CLERK_PROXY_URL || undefined}
    >
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}><FeedbackProvider><App /></FeedbackProvider></ConvexProviderWithClerk>
  </ClerkProvider></React.StrictMode>
);
