import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  SignInButton,
  SignUpButton,
  SignOutButton,
  useAuth,
  useClerk,
} from "@clerk/react";
import { Authenticated, Unauthenticated, AuthLoading, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import {
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
import ModalDialog from "./components/ModalDialog";
import ScreenErrorBoundary from "./components/ScreenErrorBoundary";
import { useAction, useFeedback } from "./components/Feedback";
import WorkspaceManager from "./features/workspaces/WorkspaceManager";
import ProfileSettings from "./features/profile/ProfileSettings";
import { formatDueDate, getErrorMessage } from "./lib/uiText";
type Task=Doc<"tasks">;
type Status=Task["status"];
type Priority=Task["priority"];
const blank={title:"",description:"",priority:"medium" as Priority,dueDate:"",status:"todo" as Status};
const statusNames:Record<Status,string>={todo:"Cần làm",doing:"Đang thực hiện",done:"Hoàn thành"};
const priorityNames:Record<Priority,string>={low:"Thấp",medium:"Trung bình",high:"Cao"};

function TaskDashboard(){
 const { notify, confirm } = useFeedback();
 const { run, pending } = useAction();
 const tasks=useQuery(api.tasks.list);
 const create=useMutation(api.tasks.create),update=useMutation(api.tasks.update),remove=useMutation(api.tasks.remove),setStatus=useMutation(api.tasks.setStatus);
 const [search,setSearch]=useState("");const [filter,setFilter]=useState<Status|"all">("all");
 const [editing,setEditing]=useState<Task|null>(null);const [open,setOpen]=useState(false);
 const [form,setForm]=useState(blank);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const filtered=useMemo(()=>((tasks??[]).filter(t=>(filter==="all"||t.status===filter)&&(t.title+" "+t.description).toLowerCase().includes(search.toLowerCase()))).sort((a,b)=>b.createdAt-a.createdAt),[tasks,filter,search]);
 const counts={all:tasks?.length??0,todo:tasks?.filter(t=>t.status==="todo").length??0,doing:tasks?.filter(t=>t.status==="doing").length??0,done:tasks?.filter(t=>t.status==="done").length??0};
 const completion=counts.all===0?0:Math.round(counts.done/counts.all*100);
 const showCreate=()=>{setEditing(null);setForm(blank);setError("");setOpen(true)};
 const showEdit=(t:Task)=>{setEditing(t);setForm({title:t.title,description:t.description,priority:t.priority,dueDate:t.dueDate??"",status:t.status});setError("");setOpen(true)};
 const save=async(e:FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);setError("");try{
   if(editing) await update({id:editing._id,title:form.title,description:form.description,priority:form.priority,dueDate:form.dueDate||undefined,status:form.status});
   else await create({title:form.title,description:form.description,priority:form.priority,dueDate:form.dueDate||undefined});
   notify(editing ? "Đã lưu thay đổi công việc." : "Đã tạo công việc.");
   setOpen(false);
 }catch(err){const message=getErrorMessage(err, "Không thể lưu công việc.");setError(message);notify(message,"error")}finally{setBusy(false)}};
 const changeStatus=async(t:Task,s:Status)=>{await run(()=>setStatus({id:t._id,status:s}),"Đã cập nhật trạng thái.","Không thể cập nhật trạng thái.",`status:${t._id}`)};
 const deleteTask=async(t:Task)=>{
   if(pending || !await confirm({title:"Xóa công việc?",description:`Công việc “${t.title}” sẽ bị xóa. Bạn không thể hoàn tác thao tác này.`}))return;
   await run(()=>remove({id:t._id}),"Đã xóa công việc.","Không thể xóa công việc.",`delete:${t._id}`);
 };
 return <div className="personal-dashboard">
   <main className="main"><header className="topbar"><div><div className="eyebrow">CÔNG VIỆC CÁ NHÂN / TỔNG QUAN</div><h1>Quản lý công việc <span className="wave">✳</span></h1><p className="subtitle">Tập trung vào những việc quan trọng, mọi lúc mọi nơi.</p></div><button className="primary ui-button ui-primary" onClick={showCreate}><Plus size={18}/> Công việc mới</button></header>
   <section className="stats"><div className="stat"><span className="stat-title">Tổng công việc <ListTodo size={19}/></span><strong>{counts.all}</strong><span className="stat-foot">Tất cả đầu việc của bạn</span></div><div className="stat"><span className="stat-title">Đang thực hiện <Clock3 size={19}/></span><strong>{counts.doing}</strong><span className="stat-foot">Công việc đang tiến hành</span></div><div className="stat"><span className="stat-title">Đã hoàn thành <CheckCircle2 size={19}/></span><strong>{counts.done}</strong><span className="stat-foot">Tuyệt vời, tiếp tục nhé!</span></div><div className="stat progress-stat"><span className="stat-title">Tiến độ chung <CircleDashed size={19}/></span><strong>{completion}%</strong><div className="track"><div className="fill" style={{width:`${completion}%`}}/></div><span className="stat-foot">Tỷ lệ công việc hoàn thành</span></div></section>
   <section className="task-section"><div className="section-head"><div><h2>Danh sách công việc</h2><p>Tổ chức và theo dõi công việc hàng ngày</p></div><span className="live"><span/> Đồng bộ tự động</span></div>
   <div className="toolbar"><div className="filters">{(["all","todo","doing","done"] as const).map(f=><button key={f} className={filter===f?"filter selected":"filter"} onClick={()=>setFilter(f)}>{f==="all"?"Tất cả":statusNames[f]} <span>{counts[f]}</span></button>)}</div><label className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm công việc..." aria-label="Tìm công việc"/></label></div>
   {tasks===undefined?<p className="empty">Đang tải công việc...</p>:filtered.length===0?<div className="empty"><ListTodo size={36}/><h3>{counts.all === 0 ? "Chưa có công việc nào" : "Không tìm thấy công việc"}</h3><p>{counts.all === 0 ? "Tạo công việc đầu tiên để bắt đầu theo dõi tiến độ." : "Thử từ khóa khác hoặc thay đổi bộ lọc."}</p><button className="primary ui-button ui-primary" onClick={showCreate}><Plus size={16}/> Thêm công việc</button></div>:<div className="task-list">{filtered.map(t=><article className="task" key={t._id} aria-busy={pending===`status:${t._id}` || pending===`delete:${t._id}`}><button disabled={pending!==null} aria-busy={pending===`status:${t._id}` || pending===`delete:${t._id}`} className={`status-dot ${t.status}`} aria-label="Thay đổi trạng thái" title="Thay đổi trạng thái" onClick={()=>changeStatus(t,t.status==="todo"?"doing":t.status==="doing"?"done":"todo")}>{t.status==="done"?<CheckCircle2 size={22}/>:t.status==="doing"?<Clock3 size={22}/>:<CircleDashed size={22}/>}</button><div className="task-body">{pending===`status:${t._id}` && <span className="ui-inline-busy" role="status">Đang cập nhật...</span>}<div className="task-line"><h3 className={t.status==="done"?"completed":""}>{t.title}</h3><span className={`priority ${t.priority}`}>{priorityNames[t.priority]}</span></div>{t.description&&<p>{t.description}</p>}<div className="task-meta"><span className={`status-text ${t.status}`}>{statusNames[t.status]}</span><span>{t.dueDate?`Hạn: ${formatDueDate(t.dueDate)}`:"Không có hạn"}</span></div></div><div className="task-actions"><button className="ui-button ui-secondary ui-icon" disabled={pending!==null} aria-label="Sửa" title="Sửa công việc" onClick={()=>showEdit(t)}><Pencil size={17}/></button><button className="ui-button ui-danger ui-icon" disabled={pending!==null} aria-busy={pending===`delete:${t._id}`} aria-label="Xóa" title="Xóa công việc" onClick={()=>deleteTask(t)}><Trash2 size={17}/></button></div></article>)}</div>}
   </section><footer>CloudTask Pro · Quản lý công việc mọi lúc, mọi nơi</footer></main>
   {open&&<ModalDialog className="overlay" label={editing?"Chỉnh sửa công việc":"Tạo công việc"} busy={busy} onDismiss={()=>setOpen(false)}><form className="modal" onSubmit={save}><div className="modal-head"><div><h2>{editing?"Chỉnh sửa công việc":"Tạo công việc mới"}</h2><p>Thông tin được lưu và đồng bộ tự động.</p></div><button type="button" className="icon-btn ui-button ui-secondary ui-icon" aria-label="Đóng" disabled={busy} onClick={()=>setOpen(false)}><X size={21}/></button></div><label>Tiêu đề *<input disabled={busy} required maxLength={120} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ví dụ: Hoàn thành báo cáo cuối kỳ"/></label><label>Mô tả<textarea disabled={busy} maxLength={2000} rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Ghi chú thêm..."/></label><div className="form-row"><label>Mức ưu tiên<select disabled={busy} value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as Priority})}><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option></select></label><label>Hạn hoàn thành<input disabled={busy} type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></label></div>{editing&&<label>Trạng thái<select disabled={busy} value={form.status} onChange={e=>setForm({...form,status:e.target.value as Status})}><option value="todo">Cần làm</option><option value="doing">Đang thực hiện</option><option value="done">Hoàn thành</option></select></label>}{error&&<p className="error" role="alert">{error}</p>}<div className="modal-buttons"><button type="button" className="secondary ui-button ui-secondary" disabled={busy} onClick={()=>setOpen(false)}>Hủy</button><button className="primary ui-button ui-primary" aria-busy={busy} disabled={busy||!form.title.trim()} type="submit">{busy?"Đang lưu...":editing?"Lưu thay đổi":"Tạo công việc"}</button></div></form></ModalDialog>}
 </div>
}


type AccountMenuProps = {
  onOpenProfile: () => void;
};

function AccountMenu({ onOpenProfile }: AccountMenuProps) {
  const { openUserProfile, signOut } = useClerk();
  const account = useQuery(api.profiles.me);

  const [isOpen, setIsOpen] = useState(false);

  const fullName =
    account?.profile?.fullName ||
    account?.clerk.name ||
    "Tài khoản của tôi";

  const email = account?.clerk.email || "";
  const avatarUrl = account?.profile?.avatarUrl;

  const closeMenu = () => setIsOpen(false);

  return (
    <div className="ctp-profile-menu">
      <button
        type="button"
        className="ctp-profile-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Mở trình đơn tài khoản"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Ảnh đại diện"
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
            onClick={closeMenu}
            aria-label="Đóng trình đơn"
          />

          <div className="ctp-profile-dropdown">
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
              Chỉnh sửa hồ sơ
            </button>

            <button
              type="button"
              onClick={() => {
                closeMenu();
                openUserProfile();
              }}
            >
              <Settings2 size={18} />
              Bảo mật và đăng nhập
            </button>

            <button
              type="button"
              className="ctp-profile-logout"
              onClick={() => {
                closeMenu();
                void signOut();
              }}
            >
              <LogOut size={18} />
              Đăng xuất
            </button>
          </div>
        </>
      )}
    </div>
  );
}
function CloudTaskWorkspace() {
  const syncIdentity = useMutation(api.profiles.syncIdentity);
  const { notify } = useFeedback();
  const didSync = useRef(false);
  useEffect(() => {
    if (didSync.current) return;
    didSync.current = true;
    void syncIdentity({}).catch(() => {
      didSync.current = false;
      notify("Không thể đồng bộ thông tin tài khoản. Hãy thử tải lại trang.", "error");
    });
  }, [syncIdentity, notify]);
  const [activePage, setActivePage] = useState<
    "personal" | "workspace" | "profile"
  >("workspace");

  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  function navigate(page: typeof activePage) {
    setActivePage(page);
    setMenuOpen(false);
    if (window.matchMedia("(max-width: 760px)").matches) menuButton.current?.focus();
  }

  const navigation = [
    { id: "workspace", label: "Không gian và dự án", icon: <LayoutDashboard size={19} /> },
    { id: "personal", label: "Công việc cá nhân", icon: <ListTodo size={19} /> },
    { id: "profile", label: "Hồ sơ cá nhân", icon: <UserRound size={19} /> },
  ] as const;

  const pageTitle = {
    workspace: "Không gian và dự án",
    personal: "Công việc cá nhân",
    profile: "Hồ sơ cá nhân",
  }[activePage];

  return (
    <div className="ctp-shell">
      <aside className={`ctp-sidebar ${menuOpen ? "is-expanded" : ""}`} aria-label="Điều hướng chính" onKeyDown={event => {
        if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); }
      }}>
        <div className="ctp-sidebar-top">
        <div className="ctp-brand">
          <span className="ctp-brand-mark"><Cloud size={23} /></span>
          <span>CloudTask <strong>Pro</strong><small>QUẢN LÝ CÔNG VIỆC</small></span>
        </div>

        <button ref={menuButton} type="button" className="ctp-menu-toggle" aria-expanded={menuOpen} aria-controls="ctp-main-navigation" aria-label={menuOpen ? "Thu gọn điều hướng" : "Mở điều hướng"} onClick={() => setMenuOpen(value => !value)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        </div>
        <div className="ctp-navigation-label">KHÔNG GIAN LÀM VIỆC</div>
        <nav id="ctp-main-navigation" className="ctp-navigation" aria-label="Các trang ứng dụng">
          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`ctp-nav-item ${activePage === item.id ? "is-active" : ""}`}
              aria-current={activePage === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="ctp-sidebar-note">
          <CheckCircle2 size={18} />
          <span>Dữ liệu được đồng bộ tự động.</span>
        </div>
      </aside>

      <div className="ctp-right">
        <header className="ctp-header">
          <div className="ctp-header-text">
            <span className="ctp-header-overline">QUẢN LÝ CÔNG VIỆC</span>
            <strong>{pageTitle}</strong>
          </div>
          <div className="ctp-header-account">
            <ScreenErrorBoundary scope="Tài khoản" resetKey={activePage} compact allowReload>
              <AccountMenu
                onOpenProfile={() => navigate("profile")}
              />
            </ScreenErrorBoundary>
          </div>
        </header>
        <div className="ctp-content">
          <ScreenErrorBoundary
            scope={pageTitle}
            resetKey={activePage}
            onReturn={() => navigate(activePage === "workspace" ? "personal" : "workspace")}
            returnLabel={activePage === "workspace" ? "Về công việc cá nhân" : "Về không gian làm việc"}
            allowReload
          >
            {activePage === "personal" && <TaskDashboard />}
            {activePage === "workspace" && <WorkspaceManager />}
            {activePage === "profile" && <ProfileSettings />}
          </ScreenErrorBoundary>
        </div>
      </div>
    </div>
  );
}

function AuthConnectionNotice() {
 return <div className="landing"><section className="landing-card" aria-labelledby="auth-connection-title">
  <div className="landing-logo"><Cloud size={32}/></div>
  <h2 id="auth-connection-title">Đã đăng nhập, chưa kết nối được dữ liệu</h2>
  <p>Phiên đăng nhập của bạn đã được tạo, nhưng hệ thống chưa xác thực được kết nối dữ liệu. Bạn có thể thử tải lại trang hoặc đăng xuất rồi đăng nhập lại.</p>
  <div className="landing-actions">
   <button className="primary ui-button ui-primary" onClick={() => window.location.reload()}>Thử lại</button>
   <SignOutButton><button className="secondary ui-button ui-secondary">Đăng xuất</button></SignOutButton>
  </div>
  <small>Nếu lỗi vẫn tiếp diễn, hãy liên hệ người quản trị ứng dụng.</small>
 </section></div>;
}

export default function App(){const {isLoaded,isSignedIn}=useAuth();if(!isLoaded)return <div className="auth-loading">Đang tải phiên đăng nhập...</div>;return <><AuthLoading><div className="auth-loading">Đang xác thực phiên đăng nhập...</div></AuthLoading><Unauthenticated>{isSignedIn?<AuthConnectionNotice/>:<div className="landing"><div className="landing-card"><div className="landing-logo"><Cloud size={32}/></div><div className="eyebrow">QUẢN LÝ CÔNG VIỆC TRỰC TUYẾN</div><h1>Công việc rõ ràng.<br/><span>Tiến độ vượt trội.</span></h1><p>Quản lý công việc cá nhân và dự án nhóm, theo dõi tiến độ và nhận nhắc hạn trong cùng một nơi.</p><div className="landing-actions"><SignUpButton mode="modal"><button className="primary ui-button ui-primary">Tạo tài khoản <Plus size={17}/></button></SignUpButton><SignInButton mode="modal"><button className="secondary ui-button ui-secondary">Đăng nhập</button></SignInButton></div><small>Công việc cá nhân · Dự án nhóm · Nhắc hạn tự động</small></div></div>}</Unauthenticated><Authenticated><ScreenErrorBoundary scope="Ứng dụng" allowReload><CloudTaskWorkspace /></ScreenErrorBoundary></Authenticated></>}


