import { SignInButton, SignUpButton } from "@clerk/react";
import { ArrowRight, Bell, Check, CheckCircle2, Circle, Cloud, LayoutDashboard, ListTodo, Users } from "lucide-react";
import "./welcome.css";

const features = [
  { icon: ListTodo, title: "Your work, in a better place", text: "Capture tasks, set priorities, and see how far you have come." },
  { icon: Users, title: "Good teamwork starts with clarity", text: "Break projects into tasks, assign an owner, and keep the conversation close to the work." },
  { icon: Bell, title: "A clearer view of what comes next", text: "Set due dates and get notified when something important changes." },
];

/** Presentation only. Clerk continues to own authentication and the return URL. */
export default function WelcomePage({ returnTo }: { returnTo: string }) {
  return (
    <div className="landing welcome">
      <a className="welcome-skip" href="#welcome-main">Skip to main content</a>
      <header className="welcome-header">
        <a className="welcome-brand" href="/" aria-label="CloudTask Pro — Home">
          <span className="welcome-brand-icon"><Cloud size={23} aria-hidden="true" /></span>
          <span>CloudTask <strong>Pro</strong></span>
        </a>
        <nav aria-label="About CloudTask Pro">
          <a className="welcome-explore" href="#welcome-features">Explore features</a>
          <a className="welcome-header-link" href="#welcome-start">Start working <ArrowRight size={15} aria-hidden="true" /></a>
        </nav>
      </header>

      <main id="welcome-main" tabIndex={-1}>
        <section className="welcome-hero" aria-labelledby="welcome-title">
          <div className="welcome-intro" id="welcome-start">
            <p className="welcome-eyebrow"><span /> Less busywork. More meaningful progress.</p>
            <h1 id="welcome-title">Clear work.<br /><span>A lighter day.</span></h1>
            <p className="welcome-description">From your personal to-do list to your next team project, bring your work together and focus on what matters.</p>
            <div className="landing-actions welcome-actions">
              <SignUpButton mode="modal" forceRedirectUrl={returnTo}>
                <button className="ui-button ui-primary">Create account <ArrowRight size={17} aria-hidden="true" /></button>
              </SignUpButton>
              <SignInButton mode="modal" forceRedirectUrl={returnTo}>
                <button className="ui-button ui-secondary">Sign in</button>
              </SignInButton>
            </div>
            <ul className="welcome-benefits" aria-label="Highlights">
              <li><Check size={15} aria-hidden="true" /> Made for everyday work</li>
              <li><Check size={15} aria-hidden="true" /> Live sync</li>
              <li><Check size={15} aria-hidden="true" /> Personal & team projects</li>
            </ul>
          </div>

          <figure className="welcome-preview" aria-label="An example workspace in CloudTask Pro">
            <div className="welcome-demo" aria-hidden="true">
              <div className="welcome-demo-top"><span><Cloud size={17} /> Workspaces</span><span className="welcome-demo-caption">PRODUCT PREVIEW</span></div>
              <div className="welcome-demo-body">
                <div className="welcome-demo-side"><span className="welcome-demo-side-active"><LayoutDashboard size={18} /></span><ListTodo size={18} /><Users size={18} /></div>
                <div className="welcome-demo-content">
                  <div className="welcome-demo-heading"><div><small>TEAM PROJECT</small><h2>A week of good work</h2></div><span className="welcome-demo-avatars"><i>H</i><i>M</i><i>+2</i></span></div>
                  <div className="welcome-demo-progress"><span>Project progress</span><strong>2 / 3 completed</strong><div><span /></div></div>
                  <div className="welcome-demo-board">
                    <div className="welcome-demo-lane"><h3><span /> In progress <small>1</small></h3><div className="welcome-demo-task"><span className="welcome-demo-tag">Today’s priority</span><h4>Prepare the presentation</h4><p>Review the main ideas together</p><div className="welcome-demo-task-foot"><span><Circle size={12} /> In progress</span><i>H</i></div></div></div>
                    <div className="welcome-demo-lane welcome-demo-done"><h3><span /> Done <small>2</small></h3><div className="welcome-demo-task"><CheckCircle2 size={18} /><h4>Agree on the plan</h4><p>Everyone is ready to get started</p></div><div className="welcome-demo-task welcome-demo-task-short"><CheckCircle2 size={17} /><h4>Share the project resources</h4></div></div>
                  </div>
                  <div className="welcome-demo-note"><CheckCircle2 size={15} /> Small steps. Shared progress.</div>
                </div>
              </div>
            </div>
            <figcaption>A look inside your workspace · Example data</figcaption>
          </figure>
        </section>

        <section className="welcome-features" id="welcome-features" aria-labelledby="welcome-features-title">
          <div className="welcome-section-heading"><p className="welcome-section-label">EASY TO GET STARTED</p><h2 id="welcome-features-title">One place for your work. And your team.</h2><p>Everything you need to start the day with a clear plan.</p></div>
          <div className="welcome-feature-grid">{features.map(({ icon: Icon, title, text }, index) => (
            <article className="welcome-feature" key={title}>
              <div className="welcome-feature-top"><span><Icon size={21} aria-hidden="true" /></span><small>0{index + 1}</small></div>
              <h3>{title}</h3><p>{text}</p>
            </article>
          ))}</div>
        </section>
      </main>
      <footer className="welcome-footer"><span>CloudTask Pro</span><p>Less to manage. More to make.</p><a href="#welcome-start">Make room for better work <ArrowRight size={14} aria-hidden="true" /></a></footer>
    </div>
  );
}
