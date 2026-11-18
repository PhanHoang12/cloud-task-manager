import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/react";
import { enUS } from "@clerk/localizations";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import App from "./App";
import "./style.css";
import "./components/ui.css";
import { FeedbackProvider } from "./components/Feedback";
import { BrowserRouter, useNavigate } from "react-router";
const clerkKey=import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const convexUrl=import.meta.env.VITE_CONVEX_URL;
if(!clerkKey || !convexUrl) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY or VITE_CONVEX_URL. See README.md");
const convex=new ConvexReactClient(convexUrl);
function RootProviders() {
  const navigate = useNavigate();
  return <ClerkProvider
      localization={enUS}
      publishableKey={clerkKey}
      afterSignOutUrl="/"
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/workspaces"
      signUpFallbackRedirectUrl="/workspaces"
      routerPush={to => navigate(to)}
      routerReplace={to => navigate(to, { replace: true })}
      proxyUrl={import.meta.env.VITE_CLERK_PROXY_URL || undefined}
    >
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}><FeedbackProvider><App /></FeedbackProvider></ConvexProviderWithClerk>
  </ClerkProvider>;
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><BrowserRouter><RootProviders /></BrowserRouter></React.StrictMode>
);
