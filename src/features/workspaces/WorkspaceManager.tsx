
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export default function WorkspaceManager() {
  const workspaces = useQuery(api.workspaces.list);

  const createWorkspace = useMutation(api.workspaces.create);
  const createProject = useMutation(api.projects.create);

  const [selectedId, setSelectedId] =
    useState<Id<"workspaces"> | null>(null);

  const projects = useQuery(
    api.projects.list,
    selectedId ? { workspaceId: selectedId } : "skip"
  );

  const [workspaceName, setWorkspaceName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreateWorkspace() {
    setError("");
    setBusy(true);

    try {
      const id = await createWorkspace({
        name: workspaceName,
        description: "",
      });

      setSelectedId(id);
      setWorkspaceName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateProject() {
    if (!selectedId) return;

    setError("");
    setBusy(true);

    try {
      await createProject({
        workspaceId: selectedId,
        name: projectName,
        description: "",
      });

      setProjectName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ padding: 24 }}>
      <h1>Workspace & Project Management</h1>

      <h2>Tạo Workspace</h2>
      <input
        value={workspaceName}
        onChange={(e) => setWorkspaceName(e.target.value)}
        placeholder="Tên Workspace"
        maxLength={80}
      />
      <button
        onClick={handleCreateWorkspace}
        disabled={busy}
      >
        Tạo Workspace
      </button>

      {error && <p role="alert" style={{ color: "red" }}>{error}</p>}

      <h2>Danh sách Workspace</h2>
      {workspaces === undefined ? (
        <p>Đang tải...</p>
      ) : workspaces.length === 0 ? (
        <p>Chưa có Workspace nào.</p>
      ) : (
        <ul>
          {workspaces.map((workspace) => (
            <li key={workspace._id}>
              <button
                onClick={() => setSelectedId(workspace._id)}
              >
                {workspace.name} ({workspace.myRole})
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedId && (
        <>
          <h2>Tạo Project</h2>
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Tên Project"
            maxLength={100}
          />
          <button
            onClick={handleCreateProject}
            disabled={busy}
          >
            Tạo Project
          </button>

          <h2>Danh sách Project</h2>
          {projects === undefined ? (
            <p>Đang tải Project...</p>
          ) : projects.length === 0 ? (
            <p>Chưa có Project nào.</p>
          ) : (
            <ul>
              {projects.map((project) => (
                <li key={project._id}>
                  {project.name} — {project.status}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
