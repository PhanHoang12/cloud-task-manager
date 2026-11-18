import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import {
  SignOutButton,
  useAuth,
  useClerk,
} from "@clerk/react";
import { Authenticated, Unauthenticated, AuthLoading, useConvex, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import CardIllustration from "./components/CardIllustration";
import type { Doc } from "../convex/_generated/dataModel";
import {
  CalendarDays,
  Target,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Plus,
  Search,
  Trash2,
  Pencil,
  X,
  LayoutDashboard,
  Cloud,
  ListTodo,
  UserRound,
  Settings2,
  LogOut,
  ChevronDown,
  Menu,
} from "lucide-react";
import "./app-layout.css";
import WelcomePage from "./components/WelcomePage";
import "./components/product-polish.css";
import "./components/workbench.css";
import "./components/interior.css";
import PagePhoto from "./components/PagePhoto";
import ModalDialog from "./components/ModalDialog";
import { NavigationProvider, useAppNavigation, useDraftGuard, useViewState } from "./components/NavigationExperience";
import ScreenErrorBoundary from "./components/ScreenErrorBoundary";
import { useNonModalPopup } from "./components/useNonModalPopup";
import { useAction, useFeedback } from "./components/Feedback";
import WorkspaceManager from "./features/workspaces/WorkspaceManager";
import ProfileSettings from "./features/profile/ProfileSettings";
import NotificationCenter from "./features/kanban/NotificationCenter";
import { resolveNotificationTarget, type NotificationTarget } from "./lib/notificationNavigation";
import { formatDueDate, getErrorMessage } from "./lib/uiText";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { appPaths } from "./lib/appRoutes";
const AuthenticationPage = lazy(() => import("./components/AuthenticationPage"));
type Task=Doc<"tasks">;
type Status=Task["status"];
type Priority=Task["priority"];
const blank={title:"",description:"",priority:"medium" as Priority,dueDate:"",status:"todo" as Status};
const statusNames:Record<Status,string>={todo:"To do",doing:"In progress",done:"Done"};
const priorityNames:Record<Priority,string>={low:"Low",medium:"Medium",high:"High"};

function TaskDashboard(){
 const { notify, confirm } = useFeedback();
 const { run, pending } = useAction();
 const tasks=useQuery(api.tasks.list);
 const create=useMutation(api.tasks.create),update=useMutation(api.tasks.update),remove=useMutation(api.tasks.remove),setStatus=useMutation(api.tasks.setStatus);
 const [search,setSearch]=useViewState("personal:search","");const [filter,setFilter]=useViewState<Status|"all">("personal:filter","all");
 const [editing,setEditing]=useState<Task|null>(null);const [open,setOpen]=useState(false);
 const [form,setForm]=useState(blank);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const baseline=editing ? {title:editing.title,description:editing.description,priority:editing.priority,dueDate:editing.dueDate??"",status:editing.status} : blank;
 const dismissDraft=useDraftGuard(open && JSON.stringify(form)!==JSON.stringify(baseline),busy);
 const closeTask=()=>dismissDraft(()=>setOpen(false));
 const filtered=useMemo(()=>((tasks??[]).filter(t=>(filter==="all"||t.status===filter)&&(t.title+" "+t.description).toLowerCase().includes(search.toLowerCase()))).sort((a,b)=>b.createdAt-a.createdAt),[tasks,filter,search]);
 const loading=tasks===undefined;
 const counts={all:tasks?.length??0,todo:tasks?.filter(t=>t.status==="todo").length??0,doing:tasks?.filter(t=>t.status==="doing").length??0,done:tasks?.filter(t=>t.status==="done").length??0};
 const completion=counts.all===0?0:Math.round(counts.done/counts.all*100);
 const showCreate=()=>{setEditing(null);setForm(blank);setError("");setOpen(true)};
 const showEdit=(t:Task)=>{setEditing(t);setForm({title:t.title,description:t.description,priority:t.priority,dueDate:t.dueDate??"",status:t.status});setError("");setOpen(true)};
 const save=async(e:FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);setError("");try{
   if(editing) await update({id:editing._id,title:form.title,description:form.description,priority:form.priority,dueDate:form.dueDate||undefined,status:form.status});
   else await create({title:form.title,description:form.description,priority:form.priority,dueDate:form.dueDate||undefined});
   notify(editing ? "Task changes saved." : "Task created.");
   setOpen(false);
 }catch(err){const message=getErrorMessage(err, "Could not save the task.");setError(message);notify(message,"error")}finally{setBusy(false)}};
 const changeStatus=async(t:Task,s:Status)=>{await run(()=>setStatus({id:t._id,status:s}),"Status updated.","Could not update the status.",`status:${t._id}`)};
 const deleteTask=async(t:Task)=>{
   if(pending || !await confirm({title:"Delete task?",description:`Task “${t.title}” will be deleted. This cannot be undone.`}))return;
   await run(()=>remove({id:t._id}),"Task deleted.","Could not delete the task.",`delete:${t._id}`);
 };
 return <div className="personal-dashboard">
   <main className="main"><header className="topbar photo-heading"><PagePhoto scene="desk"/><div><div className="eyebrow">A LITTLE FOCUS, EVERY DAY</div><h1><ListTodo size={27}/>My tasks</h1></div><button className="primary ui-button ui-primary" onClick={showCreate}><Plus size={18}/> New task</button></header>
   <section className="stats" aria-label="Personal task overview" aria-busy={loading}><div className="stat"><span className="stat-title">Total tasks <ListTodo size={19}/></span><strong>{loading ? "—" : counts.all}</strong></div><div className="stat"><span className="stat-title">In progress <Clock3 size={19}/></span><strong>{loading ? "—" : counts.doing}</strong></div><div className="stat"><span className="stat-title">Completed <CheckCircle2 size={19}/></span><strong>{loading ? "—" : counts.done}</strong></div><div className="stat progress-stat"><span className="stat-title">Completion rate <CircleDashed size={19}/></span><strong>{loading ? "—" : completion+"%"}</strong><div className="track" aria-hidden={loading}><div className="fill" style={{width:`${completion}%`}}/></div></div></section>
   <div className="personal-layout"><section className="task-section"><div className="section-head"><div><h2>Your task list</h2></div><span className="live"><span/> Live sync</span></div>
   <div className="toolbar"><div className="filters">{(["all","todo","doing","done"] as const).map(f=><button key={f} className={filter===f?"filter selected":"filter"} onClick={()=>setFilter(f)}>{f==="all"?"All":statusNames[f]} <span>{loading ? "…" : counts[f]}</span></button>)}</div><label className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tasks..." aria-label="Search tasks"/></label></div>
   {tasks===undefined?<p className="empty" role="status">Loading tasks...</p>:filtered.length===0?<div className="empty"><ListTodo size={36}/><h3>{counts.all === 0 ? "Your next great day starts here" : "No matching tasks"}</h3><p>{counts.all === 0 ? "Add your first task and give your day a little direction." : "Try a different search or adjust your filters."}</p><button className="primary ui-button ui-primary" onClick={showCreate}><Plus size={16}/> Add task</button></div>:<div className="task-list">{filtered.map(t=><article className="task" key={t._id} aria-busy={pending===`status:${t._id}` || pending===`delete:${t._id}`}><button disabled={pending!==null} aria-busy={pending===`status:${t._id}` || pending===`delete:${t._id}`} className={`status-dot ${t.status}`} aria-label="Change status" title="Change status" onClick={()=>changeStatus(t,t.status==="todo"?"doing":t.status==="doing"?"done":"todo")}>{t.status==="done"?<CheckCircle2 size={22}/>:t.status==="doing"?<Clock3 size={22}/>:<CircleDashed size={22}/>}</button><div className="task-body">{pending===`status:${t._id}` && <span className="ui-inline-busy" role="status">Updating...</span>}<div className="task-line"><h3 className={t.status==="done"?"completed":""}>{t.title}</h3><span className={`priority ${t.priority}`}>{priorityNames[t.priority]}</span></div><CardIllustration target={{ kind: "tasks", id: t._id }} title={t.title} src={t.coverUrl} editable disabled={pending!==null} />{t.description&&<p>{t.description}</p>}<div className="task-meta"><span className={`status-text ${t.status}`}>{statusNames[t.status]}</span><span><CalendarDays size={13}/>{t.dueDate?`Due: ${formatDueDate(t.dueDate)}`:"No due date"}</span></div></div><div className="task-actions"><button className="ui-button ui-secondary ui-icon" disabled={pending!==null} aria-label="Edit" title="Edit task" onClick={()=>showEdit(t)}><Pencil size={17}/></button><button className="ui-button ui-danger ui-icon" disabled={pending!==null} aria-busy={pending===`delete:${t._id}`} aria-label="Delete" title="Delete task" onClick={()=>deleteTask(t)}><Trash2 size={17}/></button></div></article>)}</div>}
   </section><aside className="personal-focus" aria-label="Personal focus">
     <h2><Target size={18}/>Progress</h2>
     <div className="focus-ring" role={loading ? undefined : "progressbar"} aria-label="Personal task completion" aria-valuenow={loading ? undefined : completion} aria-valuemin={0} aria-valuemax={100}>
       <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50"/><circle cx="60" cy="60" r="50" strokeDasharray="314.16" strokeDashoffset={314.16 * (1-completion/100)}/></svg><strong>{loading ? "..." : completion+"%"}</strong>
     </div><p>{loading ? "Loading your progress..." : counts.done+" of "+counts.all+" tasks completed"}</p>
     <h3><CalendarDays size={16}/>Deadlines to watch</h3>
     {loading ? <p>Loading deadlines...</p> : (()=> { const upcoming=(tasks??[]).filter(t=>t.status!=="done" && t.dueDate).sort((a,b)=>a.dueDate!.localeCompare(b.dueDate!)).slice(0,3); return upcoming.length ? upcoming.map(t=><button key={t._id} className="focus-task" type="button" onClick={()=>showEdit(t)}><CircleDashed size={16}/><span>{t.title}<small>{formatDueDate(t.dueDate!)}</small></span></button>) : <p>No open tasks with a deadline.</p>; })()}
   </aside></div></main>
   {open&&<ModalDialog className="overlay" label={editing?"Edit task":"Create task"} busy={busy} onDismiss={closeTask}><form className="modal" onSubmit={save}><div className="modal-head"><div><h2>{editing?"Edit task":"Create a task"}</h2><p>Add the details, then save your task.</p></div><button type="button" className="icon-btn ui-button ui-secondary ui-icon" aria-label="Close" disabled={busy} onClick={closeTask}><X size={21}/></button></div><label>Title *<input disabled={busy} required maxLength={120} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Finish the end-of-term report"/></label><label>Description<textarea disabled={busy} maxLength={2000} rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Add a little more context..."/></label><div className="form-row"><label>Priority<select disabled={busy} value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as Priority})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Due date<input disabled={busy} type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></label></div>{editing&&<label>Status<select disabled={busy} value={form.status} onChange={e=>setForm({...form,status:e.target.value as Status})}><option value="todo">To do</option><option value="doing">In progress</option><option value="done">Done</option></select></label>}{error&&<p className="error" role="alert">{error}</p>}<div className="modal-buttons"><button type="button" className="secondary ui-button ui-secondary" disabled={busy} onClick={closeTask}>Cancel</button><button className="primary ui-button ui-primary" aria-busy={busy} disabled={busy||!form.title.trim()} type="submit">{busy?"Saving...":editing?"Save changes":"Create task"}</button></div></form></ModalDialog>}
 </div>
}


type AccountMenuProps = {
  onOpenProfile: () => void;
};

function AccountMenu({ onOpenProfile }: AccountMenuProps) {
  const navigation = useAppNavigation();
  const { openUserProfile, signOut } = useClerk();
  const account = useQuery(api.profiles.me);

  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popupId = useId();
  const onClose = useCallback(() => setIsOpen(false), []);
  const closeMenu = useNonModalPopup({ open: isOpen, onClose, triggerRef, popupRef, insideRef: rootRef });

  const fullName =
    account?.profile?.fullName ||
    account?.clerk.name ||
    "My account";

  const email = account?.clerk.email || "";
  const avatarUrl = account?.profile?.avatarUrl;


  return (
    <div ref={rootRef} className="ctp-profile-menu">
      <button
        type="button"
        ref={triggerRef}
        className="ctp-profile-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={isOpen ? popupId : undefined}
        aria-label="Open account menu"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Profile photo"
            className="ctp-profile-avatar"
          />
        ) : (
          <span className="ctp-profile-avatar ctp-profile-fallback">
            <UserRound size={20} />
          </span>
        )}

        <span className="ctp-profile-name">{fullName}</span>
        <ChevronDown size={16} />
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className="ctp-profile-backdrop"
            tabIndex={-1}
            aria-hidden="true"
            onMouseDown={event => event.preventDefault()}
            onClick={closeMenu}
            aria-label="Close menu"
          />

          <div ref={popupRef} id={popupId} className="ctp-profile-dropdown" role="group" aria-label="Account options" tabIndex={-1}>
            <div className="ctp-profile-info">
              <strong>{fullName}</strong>
              <small>{email}</small>
            </div>

            <button
              type="button"
              onClick={() => {
                closeMenu();
                onOpenProfile();
              }}
            >
              <UserRound size={18} />
              Edit profile
            </button>

            <button
              type="button"
              onClick={() => {
                closeMenu();
                openUserProfile();
              }}
            >
              <Settings2 size={18} />
              Security & sign-in
            </button>

            <button
              type="button"
              className="ctp-profile-logout"
              onClick={() => {
                if (navigation && !navigation.allowLeave()) return;
                closeMenu();
                void signOut();
              }}
            >
              <LogOut size={18} />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
function CloudTaskWorkspace() {
  const { userId } = useAuth();
  return <NavigationProvider key={userId ?? "authenticated"}><CloudTaskShell /></NavigationProvider>;
}
function UnknownRoute() {
  const navigation = useAppNavigation()!;
  return <div className="ws-page"><section className="ws-panel ws-empty" role="alert"><h1>Page not found</h1><p>This link is not valid. Choose a page from the sidebar or return to your workspace.</p><button className="ui-button ui-secondary" onClick={() => navigation.go({ page: "workspace", workspaceId: null, projectId: null, notification: null })}>Back to workspaces</button></section></div>;
}
function CloudTaskShell() {
  const navigationState = useAppNavigation()!;
  const { route, go, location } = navigationState;
  const activePage = route.page;
  const client = useConvex();
  const notificationNavigation = route.notification;
  const notificationSequence = useRef(0);
  async function openNotification(target: NotificationTarget, signal: AbortSignal) {
    const destination = await resolveNotificationTarget(target, {
      workspaces: () => client.query(api.workspaces.list, {}),
      projects: workspaceId => client.query(api.projects.list, { workspaceId }),
      tasks: projectId => client.query(api.projectTasks.list, { projectId }),
    }, signal);
    if (signal.aborted) return false;
    const opened = go({ page: "workspace", workspaceId: destination.workspaceId, projectId: destination.projectId, notification: { ...destination, requestId: ++notificationSequence.current } });
    if (opened) setMenuOpen(false);
    return opened;
  }
  const syncIdentity = useMutation(api.profiles.syncIdentity);
  const { notify } = useFeedback();
  const didSync = useRef(false);
  useEffect(() => {
    if (didSync.current) return;
    didSync.current = true;
    void syncIdentity({}).catch(() => {
      didSync.current = false;
      notify("Could not sync your account. Please reload the page.", "error");
    });
  }, [syncIdentity, notify]);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  function navigate(page: typeof activePage) {
    if (!go({ page, notification: null })) return;
    setMenuOpen(false);
    if (window.matchMedia("(max-width: 760px)").matches) menuButton.current?.focus();
  }

  const navigation = [
    { id: "workspace", label: "Workspaces & projects", description: "Build something together", icon: <LayoutDashboard size={19} /> },
    { id: "personal", label: "My tasks", description: "A little focus for your day", icon: <ListTodo size={19} /> },
    { id: "profile", label: "Profile", description: "Your details & preferences", icon: <UserRound size={19} /> },
  ] as const;

  const pageTitle = {
    workspace: "Workspaces & projects",
    personal: "My tasks",
    profile: "Profile",
    "not-found": "Page not found",
  }[activePage];

  return (
    <div className="ctp-shell">
      <aside className={`ctp-sidebar ${menuOpen ? "is-expanded" : ""}`} aria-label="Main navigation" onKeyDown={event => {
        if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); }
      }}>
        <div className="ctp-sidebar-top">
        <div className="ctp-brand">
          <span className="ctp-brand-mark"><Cloud size={23} /></span>
          <span>CloudTask <strong>Pro</strong><small>WORK, CONNECTED</small></span>
        </div>

        <button ref={menuButton} type="button" className="ctp-menu-toggle" aria-expanded={menuOpen} aria-controls="ctp-main-navigation" aria-label={menuOpen ? "Collapse navigation" : "Open navigation"} onClick={() => setMenuOpen(value => !value)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        </div>
        <div className="ctp-navigation-label">YOUR WORKSPACE</div>
        <nav id="ctp-main-navigation" className="ctp-navigation" aria-label="Application pages">
          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`ctp-nav-item ${activePage === item.id ? "is-active" : ""}`}
              aria-current={activePage === item.id ? "page" : undefined}
              aria-label={item.label}
              onClick={() => navigate(item.id)}
            >
              {item.icon}
              <span className="ctp-nav-copy"><span>{item.id === "workspace" ? "Workspaces" : item.label}</span></span>
            </button>
          ))}
        </nav>

        <div className="ctp-sidebar-note">
          <CheckCircle2 size={18} />
          <span>Live sync</span>
        </div>
      </aside>

      <div className="ctp-right">
        <header className="ctp-header">
          <div className="ctp-header-text">
            <span className="ctp-header-overline">Workspace</span>
            <strong>{activePage === "personal" ? "Personal" : activePage === "profile" ? "Account" : "Projects"}</strong>
          </div>
          <div className="ctp-header-account">
            <ScreenErrorBoundary scope="Notifications" resetKey={activePage} compact allowReload>
              <NotificationCenter onNavigate={openNotification} />
            </ScreenErrorBoundary>
            <ScreenErrorBoundary scope="Account" resetKey={activePage} compact allowReload>
              <AccountMenu
                onOpenProfile={() => navigate("profile")}
              />
            </ScreenErrorBoundary>
          </div>
        </header>
        <div className="ctp-content">
          <ScreenErrorBoundary
            scope={pageTitle}
            resetKey={activePage + ":" + route.workspaceId + ":" + route.projectId + ":" + (notificationNavigation?.requestId ?? "page")}
            onReturn={() => navigate(activePage === "workspace" ? "personal" : "workspace")}
            returnLabel={activePage === "workspace" ? "Back to my tasks" : "Back to workspaces"}
            allowReload
          >
            {/* Accepted entries discard local forms; cancelled POP keeps this key mounted. */}
            <Routes key={location.key} location={location}>
              <Route path="/" element={<Navigate to={appPaths.workspaces} replace />} />
              <Route path={appPaths.personal} element={<TaskDashboard />} />
              <Route path={appPaths.workspaces} element={<WorkspaceManager />} />
              <Route path={appPaths.workspace} element={activePage === "not-found" ? <UnknownRoute /> : <WorkspaceManager />} />
              <Route path={appPaths.project} element={activePage === "not-found" ? <UnknownRoute /> : <WorkspaceManager />} />
              <Route path={appPaths.profile} element={<ProfileSettings />} />
              <Route path="*" element={<UnknownRoute />} />
            </Routes>
          </ScreenErrorBoundary>
        </div>
      </div>
    </div>
  );
}

function AuthConnectionNotice() {
 return <div className="landing"><section className="landing-card" aria-labelledby="auth-connection-title">
  <div className="landing-logo"><Cloud size={32}/></div>
  <h2 id="auth-connection-title">Signed in. Waiting for your workspace.</h2>
  <p>Your sign-in is complete, but we could not connect to your data. Try reloading the page or signing out and back in.</p>
  <div className="landing-actions">
   <button className="primary ui-button ui-primary" onClick={() => window.location.reload()}>Try again</button>
   <SignOutButton><button className="secondary ui-button ui-secondary">Sign out</button></SignOutButton>
  </div>
  <small>If the problem continues, contact your administrator.</small>
 </section></div>;
}

export default function App(){const {isLoaded,isSignedIn}=useAuth();const location=useLocation();const returnTo=location.pathname.startsWith("//")?appPaths.workspaces:location.pathname+location.search+location.hash;if(!isLoaded)return <div className="auth-loading">Loading your session...</div>;const authMode=location.pathname==="/sign-in"||location.pathname.startsWith("/sign-in/")?"sign-in":location.pathname==="/sign-up"||location.pathname.startsWith("/sign-up/")?"sign-up":null;if(authMode)return <Suspense fallback={<div className="auth-loading" role="status">Loading sign-in...</div>}><AuthenticationPage mode={authMode}/></Suspense>;return <><AuthLoading><div className="auth-loading">Connecting to your workspace...</div></AuthLoading><Unauthenticated>{isSignedIn?<AuthConnectionNotice/>:<WelcomePage returnTo={returnTo} />}</Unauthenticated><Authenticated><ScreenErrorBoundary scope="Application" allowReload><CloudTaskWorkspace /></ScreenErrorBoundary></Authenticated></>}


