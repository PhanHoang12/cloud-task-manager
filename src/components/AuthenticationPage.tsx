import { SignIn, SignUp } from "@clerk/react";
import { Cloud } from "lucide-react";
import "./authentication.css";

/** Clerk owns callback processing, verification and redirect validation. */
export default function AuthenticationPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  return <main className="authentication-page">
    <a className="welcome-brand" href="/" aria-label="CloudTask Pro — Home">
      <span className="welcome-brand-icon"><Cloud size={23} aria-hidden="true" /></span>
      <span>CloudTask <strong>Pro</strong></span>
    </a>
    <div className="authentication-form">
      {mode === "sign-in"
        ? <SignIn routing="hash" signUpUrl="/sign-up" fallbackRedirectUrl="/workspaces" />
        : <SignUp routing="hash" signInUrl="/sign-in" fallbackRedirectUrl="/workspaces" />}
    </div>
  </main>;
}
