import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Mail, UserMinus, Shield, Send, XCircle } from "lucide-react";
import "./members.css";

type Role = "admin" | "member" | "viewer";
const roleText = {owner:"Owner",admin:"Admin",member:"Member",viewer:"Viewer"};

export function MyInvitations() {
  const invitations = useQuery(api.invitations.mine);
  const accept = useMutation(api.invitations.accept);
  const decline = useMutation(api.invitations.decline);
  const [busy,setBusy] = useState<string | null>(null);
  const [error,setError] = useState("");
  async function act(id:Id<"workspaceInvitations">, kind:"accept"|"decline") {
    setBusy(id);setError("");
    try { if(kind==="accept") await accept({invitationId:id}); else await decline({invitationId:id}); }
    catch(e){setError(e instanceof Error ? e.message : "Có lỗi xảy ra");}
    finally{setBusy(null);}
  }
  return <section className="tm-panel"><h2><Mail size={19}/> Lời mời của tôi</h2>
    <p className="tm-muted">Chỉ hiển thị lời mời gửi đến email đã xác minh trong Clerk.</p>
    {error && <p role="alert" className="tm-error">{error}</p>}
    {invitations===undefined ? <p>Đang tải lời mời...</p> : invitations.length===0 ? <p className="tm-muted">Không có lời mời mới.</p> : invitations.map(inv=><div className="tm-line" key={inv._id}>
      <span><strong>{inv.workspaceName}</strong><small>Vai trò: {roleText[inv.role]} · Hết hạn {new Date(inv.expiresAt).toLocaleDateString("vi-VN")}</small></span>
      <span className="tm-actions"><button disabled={busy!==null} onClick={()=>void act(inv._id,"accept")}>Chấp nhận</button><button disabled={busy!==null} onClick={()=>void act(inv._id,"decline")}>Từ chối</button></span>
    </div>)}
  </section>;
}

export default function TeamMembersPanel({workspaceId,myRole}: {workspaceId:Id<"workspaces">,myRole:"owner"|"admin"|"member"|"viewer"}) {
  const members=useQuery(api.members.list,{workspaceId});
  const pending=useQuery(api.invitations.forWorkspace, (myRole==="owner"||myRole==="admin")?{workspaceId}:"skip");
  const invite=useMutation(api.invitations.create);
  const revoke=useMutation(api.invitations.revoke);
  const changeRole=useMutation(api.members.changeRole);
  const remove=useMutation(api.members.remove);
  const leave=useMutation(api.members.leave);
  const [email,setEmail]=useState("");
  const [role,setRole]=useState<Role>("member");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const isManager=myRole==="owner"||myRole==="admin";
  async function run(action:()=>Promise<unknown>,message:string){
    setBusy(true);setError("");setSuccess("");
    try{await action();setSuccess(message);}catch(e){setError(e instanceof Error?e.message:"Thao tác thất bại");}
    finally{setBusy(false);}
  }
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault(); await run(()=>invite({workspaceId,email,role}),"Đã tạo lời mời. Người nhận đăng nhập để thấy lời mời.");setEmail("");}
  return <section className="tm-panel">
    <h2><Shield size={19}/> Thành viên Workspace</h2>
    {error&&<p className="tm-error" role="alert">{error}</p>}{success&&<p className="tm-success">{success}</p>}
    {isManager&&<form className="tm-invite" onSubmit={e=>void submit(e)}>
      <label>Email người nhận<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="member@example.com"/></label>
      <label>Vai trò<select value={role} onChange={e=>setRole(e.target.value as Role)}><option value="member">Member</option><option value="viewer">Viewer</option>{myRole==="owner"&&<option value="admin">Admin</option>}</select></label>
      <button disabled={busy||!email.trim()} type="submit"><Send size={15}/> Mời thành viên</button>
    </form>}
    <div className="tm-list">{members===undefined?<p>Đang tải...</p>:members.map(member=><div className="tm-line" key={member._id}>
      <span><strong title={member.userId}>{member.userId}</strong><small>{roleText[member.role]} · {new Date(member.joinedAt).toLocaleDateString("vi-VN")}</small></span>
      {isManager&&member.role!=="owner"&&<span className="tm-actions">
        {(myRole==="owner"||member.role!=="admin")&&<select aria-label="Thay đổi vai trò" value={member.role} disabled={busy} onChange={e=>{const value=e.target.value as Role;void run(()=>changeRole({workspaceId,targetUserId:member.userId,role:value}),"Đã cập nhật quyền.");}}>
          {myRole==="owner"&&<option value="admin">Admin</option>}<option value="member">Member</option><option value="viewer">Viewer</option>
        </select>}
        {(myRole==="owner"||member.role!=="admin")&&<button type="button" disabled={busy} title="Loại thành viên" onClick={()=>{if(window.confirm("Loại thành viên này khỏi Workspace?"))void run(()=>remove({workspaceId,targetUserId:member.userId}),"Đã loại thành viên.");}}><UserMinus size={16}/></button>}
      </span>}
    </div>)}</div>
    {isManager&&<><h3>Lời mời đang chờ</h3>{pending===undefined?<p>Đang tải...</p>:pending.length===0?<p className="tm-muted">Không có lời mời đang chờ.</p>:pending.map(inv=><div className="tm-line" key={inv._id}>
      <span><strong>{inv.email}</strong><small>{roleText[inv.role]} · {inv.expiresAt<=Date.now()?"Đã hết hạn":"Còn hiệu lực"}</small></span>
      <button type="button" disabled={busy} onClick={()=>void run(()=>revoke({invitationId:inv._id}),"Đã thu hồi lời mời.")}><XCircle size={16}/> Thu hồi</button>
    </div>)}</>}
    {myRole!=="owner"&&<button type="button" className="tm-leave" disabled={busy} onClick={()=>{if(window.confirm("Rời Workspace này?"))void run(()=>leave({workspaceId}),"Đã rời Workspace.");}}>Rời Workspace</button>}
  </section>;
}
