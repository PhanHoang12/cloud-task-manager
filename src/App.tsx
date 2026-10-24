import { useMemo, useState, type FormEvent } from "react";
import { SignInButton, SignUpButton, SignOutButton, UserButton, useAuth } from "@clerk/react";
import { Authenticated, Unauthenticated, AuthLoading, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import { CheckCircle2, CircleDashed, Clock3, Plus, Search, Trash2, Pencil, X, LayoutDashboard, Cloud, ListTodo } from "lucide-react";
import WorkspaceManager from "./features/workspaces/WorkspaceManager";
type Task=Doc<"tasks">;
type Status=Task["status"];
type Priority=Task["priority"];
const blank={title:"",description:"",priority:"medium" as Priority,dueDate:"",status:"todo" as Status};
const statusNames:Record<Status,string>={todo:"Cần làm",doing:"Đang thực hiện",done:"Hoàn thành"};
const priorityNames:Record<Priority,string>={low:"Thấp",medium:"Trung bình",high:"Cao"};

function TaskDashboard(){
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
 const save=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError("");try{
   if(editing) await update({id:editing._id,title:form.title,description:form.description,priority:form.priority,dueDate:form.dueDate||undefined,status:form.status});
   else await create({title:form.title,description:form.description,priority:form.priority,dueDate:form.dueDate||undefined});
   setOpen(false);
 }catch(err){setError(err instanceof Error?err.message:"Lỗi không xác định")}finally{setBusy(false)}};
 const changeStatus=async(t:Task,s:Status)=>{try{await setStatus({id:t._id,status:s})}catch(e){alert(String(e))}};
 const deleteTask=async(t:Task)=>{if(!window.confirm(`Xóa công việc “${t.title}”?`))return;try{await remove({id:t._id})}catch(e){alert(String(e))}};
 return <div className="app-shell">
   <aside className="sidebar"><div className="brand"><span className="brand-icon"><Cloud size={22}/></span><span>Cloud<span className="brand-accent">Tasks</span><small>WORKSPACE</small></span></div>
   <div className="nav-title">KHÔNG GIAN LÀM VIỆC</div><button className="nav-item active"><LayoutDashboard size={18}/> Tổng quan</button><div className="sidebar-note"><CheckCircle2 size={18}/><p>Dữ liệu của bạn được lưu trên Convex Cloud và tự động cập nhật.</p></div><div className="sidebar-bottom"><UserButton/><span>Tài khoản của tôi</span></div></aside>
   <main className="main"><header className="topbar"><div><div className="eyebrow">CLOUD WORKSPACE / DASHBOARD</div><h1>Quản lý công việc <span className="wave">✳</span></h1><p className="subtitle">Tập trung vào những việc quan trọng, mọi lúc mọi nơi.</p></div><button className="primary" onClick={showCreate}><Plus size={18}/> Công việc mới</button></header>
   <section className="stats"><div className="stat"><span className="stat-title">Tổng công việc <ListTodo size={19}/></span><strong>{counts.all}</strong><span className="stat-foot">Tất cả đầu việc của bạn</span></div><div className="stat"><span className="stat-title">Đang thực hiện <Clock3 size={19}/></span><strong>{counts.doing}</strong><span className="stat-foot">Công việc đang tiến hành</span></div><div className="stat"><span className="stat-title">Đã hoàn thành <CheckCircle2 size={19}/></span><strong>{counts.done}</strong><span className="stat-foot">Tuyệt vời, tiếp tục nhé!</span></div><div className="stat progress-stat"><span className="stat-title">Tiến độ chung <CircleDashed size={19}/></span><strong>{completion}%</strong><div className="track"><div className="fill" style={{width:`${completion}%`}}/></div><span className="stat-foot">Tỉ lệ công việc hoàn tất</span></div></section>
   <section className="task-section"><div className="section-head"><div><h2>Danh sách công việc</h2><p>Tổ chức và theo dõi công việc hàng ngày</p></div><span className="live"><span/> Đồng bộ realtime</span></div>
   <div className="toolbar"><div className="filters">{(["all","todo","doing","done"] as const).map(f=><button key={f} className={filter===f?"filter selected":"filter"} onClick={()=>setFilter(f)}>{f==="all"?"Tất cả":statusNames[f]} <span>{counts[f]}</span></button>)}</div><label className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm công việc..." aria-label="Tìm công việc"/></label></div>
   {tasks===undefined?<p className="empty">Đang tải dữ liệu từ Convex...</p>:filtered.length===0?<div className="empty"><ListTodo size={36}/><h3>Chưa có công việc phù hợp</h3><p>Thêm công việc mới hoặc thử bộ lọc khác.</p><button className="primary" onClick={showCreate}><Plus size={16}/> Thêm công việc</button></div>:<div className="task-list">{filtered.map(t=><article className="task" key={t._id}><button className={`status-dot ${t.status}`} aria-label="Thay đổi trạng thái" title="Thay đổi trạng thái" onClick={()=>changeStatus(t,t.status==="todo"?"doing":t.status==="doing"?"done":"todo")}>{t.status==="done"?<CheckCircle2 size={22}/>:t.status==="doing"?<Clock3 size={22}/>:<CircleDashed size={22}/>}</button><div className="task-body"><div className="task-line"><h3 className={t.status==="done"?"completed":""}>{t.title}</h3><span className={`priority ${t.priority}`}>{priorityNames[t.priority]}</span></div>{t.description&&<p>{t.description}</p>}<div className="task-meta"><span className={`status-text ${t.status}`}>{statusNames[t.status]}</span><span>{t.dueDate?`Hạn: ${t.dueDate}`:"Không có hạn"}</span></div></div><div className="task-actions"><button aria-label="Sửa" onClick={()=>showEdit(t)}><Pencil size={17}/></button><button aria-label="Xóa" onClick={()=>deleteTask(t)}><Trash2 size={17}/></button></div></article>)}</div>}
   </section><footer>CloudTasks • Built with React, Convex & Vercel</footer></main>
   {open&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setOpen(false)}}><form className="modal" onSubmit={save}><div className="modal-head"><div><h2>{editing?"Chỉnh sửa công việc":"Tạo công việc mới"}</h2><p>Lưu trực tiếp vào cơ sở dữ liệu Convex.</p></div><button type="button" className="icon-btn" onClick={()=>setOpen(false)}><X size={21}/></button></div><label>Tiêu đề *<input required maxLength={120} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ví dụ: Hoàn thành báo cáo Cloud"/></label><label>Mô tả<textarea maxLength={2000} rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Ghi chú thêm..."/></label><div className="form-row"><label>Mức ưu tiên<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as Priority})}><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option></select></label><label>Hạn hoàn thành<input type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></label></div>{editing&&<label>Trạng thái<select value={form.status} onChange={e=>setForm({...form,status:e.target.value as Status})}><option value="todo">Cần làm</option><option value="doing">Đang thực hiện</option><option value="done">Hoàn thành</option></select></label>}{error&&<p className="error" role="alert">{error}</p>}<div className="modal-buttons"><button type="button" className="secondary" onClick={()=>setOpen(false)}>Hủy</button><button className="primary" disabled={busy||!form.title.trim()} type="submit">{busy?"Đang lưu...":editing?"Lưu thay đổi":"Tạo công việc"}</button></div></form></div>}
 </div>
}

function CloudTaskWorkspace() {
  const [activePage, setActivePage] = useState<
    "personal" | "workspace"
  >("workspace");

  return (
    <div>
      <nav
        style={{
          display: "flex",
          gap: 12,
          padding: "16px 24px",
          background: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <button
          type="button"
          className={activePage === "personal" ? "primary" : "secondary"}
          onClick={() => setActivePage("personal")}
        >
          Công việc cá nhân
        </button>

        <button
          type="button"
          className={activePage === "workspace" ? "primary" : "secondary"}
          onClick={() => setActivePage("workspace")}
        >
          Workspace & Projects
        </button>
      </nav>

      {activePage === "personal" ? (
        <TaskDashboard />
      ) : (
        <WorkspaceManager />
      )}
    </div>
  );
} 
function AuthConnectionNotice() {
 return <div className="landing"><section className="landing-card" aria-labelledby="auth-connection-title">
  <div className="landing-logo"><Cloud size={32}/></div>
  <h2 id="auth-connection-title">Đã đăng nhập, chưa kết nối được dữ liệu</h2>
  <p>Phiên đăng nhập của bạn đã được tạo, nhưng hệ thống chưa xác thực được kết nối dữ liệu. Bạn có thể thử tải lại trang hoặc đăng xuất rồi đăng nhập lại.</p>
  <div className="landing-actions">
   <button className="primary" onClick={() => window.location.reload()}>Thử lại</button>
   <SignOutButton><button className="secondary">Đăng xuất</button></SignOutButton>
  </div>
  <small>Nếu lỗi vẫn tiếp diễn, hãy liên hệ người quản trị ứng dụng.</small>
 </section></div>;
}

export default function App(){const {isLoaded,isSignedIn}=useAuth();if(!isLoaded)return <div className="auth-loading">Đang tải phiên đăng nhập...</div>;return <><AuthLoading><div className="auth-loading">Đang xác thực phiên đăng nhập...</div></AuthLoading><Unauthenticated>{isSignedIn?<AuthConnectionNotice/>:<div className="landing"><div className="landing-card"><div className="landing-logo"><Cloud size={32}/></div><div className="eyebrow">CLOUD TASK MANAGEMENT</div><h1>Công việc rõ ràng.<br/><span>Tiến độ vượt trội.</span></h1><p>Quản lý công việc cá nhân an toàn, đồng bộ theo thời gian thực với Convex Cloud.</p><div className="landing-actions"><SignUpButton mode="modal"><button className="primary">Tạo tài khoản <Plus size={17}/></button></SignUpButton><SignInButton mode="modal"><button className="secondary">Đăng nhập</button></SignInButton></div><small>React + Vite · Clerk Authentication · Convex Realtime · Vercel</small></div></div>}</Unauthenticated><Authenticated><CloudTaskWorkspace /></Authenticated></>}
