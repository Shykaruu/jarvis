import React, { useMemo, useState } from "react";
import { api, useApiData } from "../../hooks/useApi";

type DashboardSecurityConfig = {
  password_enabled: boolean;
};

export function DashboardSecurityPanel() {
  const { data, loading, error, refetch } = useApiData<DashboardSecurityConfig>("/api/config/dashboard-auth", []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const passwordsMatch = useMemo(() => {
    if (confirmPassword.length === 0) return true;
    return password === confirmPassword;
  }, [confirmPassword, password]);

  const savePassword = async () => {
    if (!password.trim()) {
      setMessage({ text: "Enter a password first.", type: "error" });
      return;
    }
    if (!passwordsMatch) {
      setMessage({ text: "Passwords do not match.", type: "error" });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await api<{ message: string }>("/api/config/dashboard-auth", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setPassword("");
      setConfirmPassword("");
      setMessage({ text: res.message, type: "success" });
      await refetch();
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Failed to save dashboard password.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const disablePassword = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await api<{ message: string }>("/api/config/dashboard-auth", {
        method: "POST",
        body: JSON.stringify({ disable: true }),
      });
      setPassword("");
      setConfirmPassword("");
      setMessage({ text: res.message, type: "success" });
      await refetch();
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Failed to disable dashboard password.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return <div style={cardStyle}><span style={mutedTextStyle}>Loading dashboard security...</span></div>;
  }

  return (
    <div style={cardStyle}>
      <div style={headerRowStyle}>
        <div>
          <h3 style={headerStyle}>Dashboard Security</h3>
          <div style={subtleStyle}>
            Protect the panel with a single admin password. Sessions are stored server-side and expire after 30 days.
          </div>
        </div>
        <span
          style={{
            ...statusBadgeStyle,
            color: data?.password_enabled ? "var(--j-warning)" : "var(--j-text-muted)",
            borderColor: data?.password_enabled ? "rgba(251, 191, 36, 0.26)" : "var(--j-border)",
            background: data?.password_enabled ? "rgba(251, 191, 36, 0.10)" : "rgba(255,255,255,0.03)",
          }}
        >
          {data?.password_enabled ? "Protected" : "Open"}
        </span>
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>
          Password
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={data?.password_enabled ? "Enter a new password" : "Set a dashboard password"}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Confirm Password
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Re-enter the password"
            style={inputStyle}
          />
        </label>

        {!passwordsMatch && (
          <div style={{ ...messageStyle, color: "var(--j-error)", borderColor: "rgba(248, 113, 113, 0.22)", background: "rgba(248, 113, 113, 0.08)" }}>
            Passwords must match before saving.
          </div>
        )}
      </div>

      {message && (
        <div style={{
          ...messageStyle,
          color: message.type === "success" ? "var(--j-success)" : "var(--j-error)",
          borderColor: message.type === "success" ? "rgba(52, 211, 153, 0.22)" : "rgba(248, 113, 113, 0.22)",
          background: message.type === "success" ? "rgba(52, 211, 153, 0.08)" : "rgba(248, 113, 113, 0.08)",
        }}>
          {message.text}
        </div>
      )}

      {error && !message && (
        <div style={{ ...messageStyle, color: "var(--j-error)", borderColor: "rgba(248, 113, 113, 0.22)", background: "rgba(248, 113, 113, 0.08)" }}>
          {error}
        </div>
      )}

      <div style={actionsStyle}>
        <button
          type="button"
          onClick={savePassword}
          disabled={saving || !password.trim() || !passwordsMatch}
          style={{
            ...primaryButtonStyle,
            opacity: saving || !password.trim() || !passwordsMatch ? 0.55 : 1,
            cursor: saving || !password.trim() || !passwordsMatch ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : data?.password_enabled ? "Update Password" : "Enable Password"}
        </button>

        <button
          type="button"
          onClick={disablePassword}
          disabled={saving || !data?.password_enabled}
          style={{
            ...secondaryButtonStyle,
            opacity: saving || !data?.password_enabled ? 0.55 : 1,
            cursor: saving || !data?.password_enabled ? "not-allowed" : "pointer",
          }}
        >
          Disable Protection
        </button>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  padding: "20px",
  background: "var(--j-surface)",
  border: "1px solid var(--j-border)",
  borderRadius: "8px",
};

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
  marginBottom: "16px",
  flexWrap: "wrap",
};

const headerStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "var(--j-text)",
  margin: 0,
};

const subtleStyle: React.CSSProperties = {
  fontSize: "12px",
  lineHeight: 1.5,
  color: "var(--j-text-muted)",
  marginTop: "6px",
  maxWidth: "560px",
};

const statusBadgeStyle: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: "999px",
  border: "1px solid var(--j-border)",
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const fieldGroupStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  marginBottom: "16px",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: "6px",
  fontSize: "12px",
  color: "var(--j-text-dim)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: "8px",
  border: "1px solid var(--j-border)",
  background: "var(--j-bg)",
  color: "var(--j-text)",
  padding: "10px 12px",
  fontSize: "13px",
  outline: "none",
};

const messageStyle: React.CSSProperties = {
  fontSize: "12px",
  border: "1px solid transparent",
  borderRadius: "8px",
  padding: "10px 12px",
  marginBottom: "16px",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(0, 212, 255, 0.28)",
  background: "rgba(0, 212, 255, 0.12)",
  color: "var(--j-accent)",
  borderRadius: "8px",
  padding: "10px 14px",
  fontSize: "13px",
  fontWeight: 600,
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid var(--j-border)",
  background: "transparent",
  color: "var(--j-text-muted)",
  borderRadius: "8px",
  padding: "10px 14px",
  fontSize: "13px",
  fontWeight: 500,
};

const mutedTextStyle: React.CSSProperties = {
  color: "var(--j-text-muted)",
  fontSize: "13px",
};
