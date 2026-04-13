import React, { useCallback, useEffect, useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { useVoice } from "./hooks/useVoice";
import { api } from "./hooks/useApi";
import "./styles/sidebar.css";

import ChatPage from "./pages/ChatPage";

const TasksPage = React.lazy(() => import("./pages/TasksPage"));
const PipelinePage = React.lazy(() => import("./pages/PipelinePage"));
const KnowledgePage = React.lazy(() => import("./pages/KnowledgePage"));
const MemoryPage = React.lazy(() => import("./pages/MemoryPage"));
const CalendarPage = React.lazy(() => import("./pages/CalendarPage"));
const OfficePage = React.lazy(() => import("./pages/OfficePage"));
const CommandPage = React.lazy(() => import("./pages/CommandPage"));
const AuthorityPage = React.lazy(() => import("./pages/AuthorityPage"));
const SettingsPage = React.lazy(() => import("./pages/SettingsPage"));
const AwarenessPage = React.lazy(() => import("./pages/AwarenessPage"));
const WorkflowsPage = React.lazy(() => import("./pages/WorkflowsPage"));
const GoalsPage = React.lazy(() => import("./pages/GoalsPage"));
const DashboardPage = React.lazy(() => import("./pages/DashboardPage"));
const SitesPage = React.lazy(() => import("./pages/SitesPage"));

type Route = "dashboard" | "chat" | "tasks" | "pipeline" | "memory" | "calendar" | "office" | "knowledge" | "command" | "authority" | "awareness" | "workflows" | "goals" | "sites" | "settings";

export type SettingsSection = "general" | "profile" | "llm" | "channels" | "integrations" | "sidecar";

type DashboardAuthStatus = {
  password_enabled: boolean;
  token_enabled: boolean;
  authenticated: boolean;
  expires_at: number | null;
};

const SETTINGS_SECTIONS: SettingsSection[] = ["general", "profile", "llm", "channels", "integrations", "sidecar"];

function getRoute(): Route {
  const hash = window.location.hash.replace("#/", "");
  if (hash.startsWith("settings")) return "settings";
  if (["dashboard", "chat", "tasks", "pipeline", "memory", "calendar", "office", "knowledge", "command", "authority", "awareness", "workflows", "goals", "sites"].includes(hash)) {
    return hash as Route;
  }
  return "dashboard";
}

function getSettingsSection(): SettingsSection {
  const hash = window.location.hash.replace("#/", "");
  if (hash.startsWith("settings/")) {
    const section = hash.replace("settings/", "");
    if (SETTINGS_SECTIONS.includes(section as SettingsSection)) {
      return section as SettingsSection;
    }
  }
  return "general";
}

function FullScreenStatus({ label }: { label: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      background: "#07070A",
      color: "var(--j-text-dim)",
      fontSize: "14px",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    }}>
      {label}
    </div>
  );
}

function PageFallback() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      color: "var(--j-text-dim)",
      fontSize: "14px",
    }}>
      Loading...
    </div>
  );
}

type NavEntry = { icon: string; label: string; route: Route };

const NAV_CORE: NavEntry[] = [
  { icon: "\u25C7", label: "Dashboard", route: "dashboard" },
  { icon: "\u25CE", label: "Chat", route: "chat" },
  { icon: "\u25C6", label: "Goals", route: "goals" },
  { icon: "\u2B21", label: "Workflows", route: "workflows" },
  { icon: "\u25A0", label: "Sites", route: "sites" },
];

const NAV_INTEL: NavEntry[] = [
  { icon: "\u25B3", label: "Agents", route: "office" },
  { icon: "\u2726", label: "Tasks", route: "tasks" },
  { icon: "\u25A3", label: "Authority", route: "authority" },
  { icon: "\u25C8", label: "Memory", route: "memory" },
];

const NAV_MORE: NavEntry[] = [
  { icon: "\u25B6", label: "Pipeline", route: "pipeline" },
  { icon: "\u25A1", label: "Calendar", route: "calendar" },
  { icon: "\u25CB", label: "Knowledge", route: "knowledge" },
  { icon: "\u25A3", label: "Command", route: "command" },
  { icon: "\u25CE", label: "Awareness", route: "awareness" },
];

const SETTINGS_NAV: { section: SettingsSection; label: string }[] = [
  { section: "general", label: "General" },
  { section: "profile", label: "Profile" },
  { section: "llm", label: "LLM" },
  { section: "channels", label: "Channels" },
  { section: "integrations", label: "Integrations" },
  { section: "sidecar", label: "Sidecar" },
];

export function App() {
  const [authStatus, setAuthStatus] = useState<DashboardAuthStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshAuth = useCallback(async () => {
    setAuthLoading(true);
    try {
      const status = await api<DashboardAuthStatus>("/api/auth/session");
      setAuthStatus(status);
      setAuthError(null);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to load dashboard auth state");
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  if (authLoading && !authStatus) {
    return <FullScreenStatus label="Loading dashboard..." />;
  }

  if (!authStatus) {
    return <FullScreenStatus label={authError ?? "Dashboard unavailable"} />;
  }

  if (authStatus.password_enabled && !authStatus.authenticated) {
    return <LoginGate loading={authLoading} error={authError} onAuthenticated={refreshAuth} />;
  }

  return <AuthenticatedAppShell authStatus={authStatus} onLoggedOut={refreshAuth} />;
}

function LoginGate({
  loading,
  error,
  onAuthenticated,
}: {
  loading: boolean;
  error: string | null;
  onAuthenticated: () => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setPassword("");
      await onAuthenticated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at top, rgba(68,110,255,0.18), transparent 35%), #07070A",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      color: "var(--j-text)",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "420px",
        background: "rgba(11, 13, 20, 0.92)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "18px",
        padding: "28px",
        boxShadow: "0 24px 80px rgba(0,0,0,0.38)",
      }}>
        <div style={{ marginBottom: "20px" }}>
          <div style={{
            fontSize: "12px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--j-text-dim)",
            marginBottom: "10px",
          }}>
            J.A.R.V.I.S.
          </div>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 600 }}>Dashboard Login</h1>
          <p style={{ margin: "10px 0 0", color: "var(--j-text-dim)", lineHeight: 1.5 }}>
            This panel is protected by the admin password.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
          <label style={{ display: "grid", gap: "8px" }}>
            <span style={{ fontSize: "13px", color: "var(--j-text-dim)" }}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "var(--j-text)",
                outline: "none",
              }}
            />
          </label>

          {(formError || error) && (
            <div style={{
              padding: "10px 12px",
              borderRadius: "10px",
              background: "rgba(255, 78, 78, 0.12)",
              color: "#ffb4b4",
              fontSize: "13px",
            }}>
              {formError || error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || loading || password.trim().length === 0}
            style={{
              border: "none",
              borderRadius: "10px",
              padding: "12px 16px",
              background: submitting || loading ? "rgba(113, 132, 255, 0.55)" : "#7184ff",
              color: "#fff",
              fontWeight: 600,
              cursor: submitting || loading ? "wait" : "pointer",
            }}
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

function AuthControls({
  passwordEnabled,
  onLogout,
}: {
  passwordEnabled: boolean;
  onLogout: () => Promise<void>;
}) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!passwordEnabled) return null;

  const handleLogout = async () => {
    setLoggingOut(true);
    setError(null);
    try {
      await api("/api/auth/logout", { method: "POST" });
      await onLogout();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        style={{
          width: "100%",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          background: "rgba(255,255,255,0.03)",
          color: "var(--j-text)",
          padding: "10px 12px",
          cursor: loggingOut ? "wait" : "pointer",
        }}
      >
        {loggingOut ? "Signing out..." : "Logout"}
      </button>
      {error && (
        <div style={{ color: "#ffb4b4", fontSize: "12px", lineHeight: 1.4 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function AuthenticatedAppShell({
  authStatus,
  onLoggedOut,
}: {
  authStatus: DashboardAuthStatus | null;
  onLoggedOut: () => Promise<void>;
}) {
  const [route, setRoute] = useState<Route>(getRoute);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>(getSettingsSection);
  const ws = useWebSocket();
  const voice = useVoice({ wsRef: ws.wsRef });

  useEffect(() => {
    ws.voiceCallbacksRef.current = {
      onTTSBinary: voice.handleTTSBinary,
      onTTSStart: voice.handleTTSStart,
      onTTSEnd: voice.handleTTSEnd,
      onError: voice.handleError,
    };
  }, [voice.handleError, voice.handleTTSBinary, voice.handleTTSEnd, voice.handleTTSStart, ws.voiceCallbacksRef]);

  useEffect(() => {
    const onHashChange = () => {
      setRoute(getRoute());
      setSettingsSection(getSettingsSection());
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = "#/dashboard";
    }
  }, []);

  const navigate = (nextRoute: Route) => {
    window.location.hash = `#/${nextRoute}`;
  };

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", background: "#07070A" }}>
      <nav className="sidebar" role="navigation" aria-label="Primary navigation">
        <div className="sidebar-logo-row">
          <div
            className="sidebar-logo"
            title="JARVIS dashboard"
            role="img"
            aria-label="JARVIS logo"
            onClick={() => navigate("dashboard")}
          />
          <span className="sidebar-logo-text">J.A.R.V.I.S.</span>
        </div>
        <div className="sidebar-logo-gap" />

        <div className="sidebar-nav">
          {NAV_CORE.map((item) => (
            <SidebarNavItem
              key={item.route}
              icon={item.icon}
              label={item.label}
              active={route === item.route}
              onClick={() => navigate(item.route)}
            />
          ))}

          <div className="sidebar-group-divider" aria-hidden="true" />

          {NAV_INTEL.map((item) => (
            <SidebarNavItem
              key={item.route}
              icon={item.icon}
              label={item.label}
              active={route === item.route}
              onClick={() => navigate(item.route)}
            />
          ))}

          <div className="sidebar-group-divider" aria-hidden="true" />

          {NAV_MORE.map((item) => (
            <SidebarNavItem
              key={item.route}
              icon={item.icon}
              label={item.label}
              active={route === item.route}
              onClick={() => navigate(item.route)}
            />
          ))}

          <div className="sidebar-group-divider" aria-hidden="true" />

          <SidebarNavItem
            icon={"\u2699"}
            label="Settings"
            active={route === "settings"}
            onClick={() => {
              if (route !== "settings") {
                window.location.hash = "#/settings/general";
              }
            }}
          />

          <div className={`sidebar-settings-sub ${route === "settings" ? "open" : ""}`}>
            {SETTINGS_NAV.map(({ section, label }) => (
              <button
                key={section}
                className={`sidebar-sub-item ${settingsSection === section ? "active" : ""}`}
                onClick={() => { window.location.hash = `#/settings/${section}`; }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-health-row">
          <div
            className={`sidebar-health ${ws.isConnected ? "connected" : "disconnected"}`}
            title={ws.isConnected ? "System online" : "Disconnected"}
            aria-label={`System health: ${ws.isConnected ? "online" : "disconnected"}`}
          />
          <span className="sidebar-health-label">
            {ws.isConnected ? "Online" : "Disconnected"}
          </span>
        </div>

        <AuthControls
          passwordEnabled={Boolean(authStatus?.password_enabled)}
          onLogout={onLoggedOut}
        />
      </nav>

      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <React.Suspense fallback={<PageFallback />}>
          {route === "dashboard" && <DashboardPage messages={ws.messages} isConnected={ws.isConnected} voice={voice} agentActivity={ws.agentActivity} goalEvents={ws.goalEvents} workflowEvents={ws.workflowEvents} />}
          {route === "chat" && <ChatPage messages={ws.messages} isConnected={ws.isConnected} sendMessage={ws.sendMessage} voice={voice} />}
          {route === "tasks" && <TasksPage taskEvents={ws.taskEvents} />}
          {route === "pipeline" && <PipelinePage contentEvents={ws.contentEvents} sendMessage={ws.sendMessage} />}
          {route === "memory" && <MemoryPage />}
          {route === "calendar" && <CalendarPage taskEvents={ws.taskEvents} contentEvents={ws.contentEvents} />}
          {route === "office" && <OfficePage agentActivity={ws.agentActivity} />}
          {route === "knowledge" && <KnowledgePage />}
          {route === "command" && <CommandPage />}
          {route === "awareness" && <AwarenessPage />}
          {route === "workflows" && <WorkflowsPage workflowEvents={ws.workflowEvents} sendMessage={ws.sendMessage} />}
          {route === "goals" && <GoalsPage goalEvents={ws.goalEvents} />}
          {route === "sites" && <SitesPage sendMessage={ws.sendMessage} isConnected={ws.isConnected} messages={ws.messages} />}
          {route === "authority" && <AuthorityPage />}
          {route === "settings" && <SettingsPage section={settingsSection} />}
        </React.Suspense>
      </main>
    </div>
  );
}

function SidebarNavItem({ icon, label, active, onClick }: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`sidebar-nav-item ${active ? "active" : ""}`}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      tabIndex={0}
    >
      <span className="nav-icon" aria-hidden="true">{icon}</span>
      <span className="nav-label">{label}</span>
      <div className="nav-active-dot" aria-hidden="true" />
    </button>
  );
}
