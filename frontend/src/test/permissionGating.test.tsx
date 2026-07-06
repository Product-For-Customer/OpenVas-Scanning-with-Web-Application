import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import type { MeResponse } from "../services/auth";

// This mirrors the exact gating pattern used across the real pages (e.g.
// ScanManagement, ThreatConfig, RoleManagement): `const canManage = can(category,
// "manage"); return canManage ? <button/> : null;` — a role with View but not
// Manage must see zero write controls, not just get backend-rejected on click.
vi.mock("../services/auth", () => ({
  GetMe: vi.fn(),
  Logout: vi.fn(),
}));

import { GetMe } from "../services/auth";

const userWith = (permissions: MeResponse["permissions"]): MeResponse => ({
  id: 1,
  email: "u@example.com",
  first_name: "U",
  last_name: "Ser",
  profile: "",
  phone_number: "",
  location: "",
  position: "",
  role: "custom",
  role_id: 9,
  permissions,
});

const ScanManagementActionsStandIn: React.FC = () => {
  const { can } = useAuth();
  const canManage = can("threat_intel", "manage");
  return (
    <div>
      <span>task-row</span>
      {canManage ? <button>Delete Task</button> : null}
    </div>
  );
};

describe("write-control gating (View-only must render zero write controls)", () => {
  beforeEach(() => {
    vi.mocked(GetMe).mockReset();
  });

  it("hides the write control for a View-only role", async () => {
    vi.mocked(GetMe).mockResolvedValue(
      userWith({ threat_intel: { view: true, manage: false } })
    );

    render(
      <AuthProvider>
        <ScanManagementActionsStandIn />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText("task-row")).toBeInTheDocument());
    expect(screen.queryByText("Delete Task")).not.toBeInTheDocument();
  });

  it("shows the write control for a Manage role", async () => {
    vi.mocked(GetMe).mockResolvedValue(
      userWith({ threat_intel: { view: true, manage: true } })
    );

    render(
      <AuthProvider>
        <ScanManagementActionsStandIn />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText("Delete Task")).toBeInTheDocument());
  });

  it("hides the write control when the category is entirely absent from the role", async () => {
    vi.mocked(GetMe).mockResolvedValue(userWith({}));

    render(
      <AuthProvider>
        <ScanManagementActionsStandIn />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText("task-row")).toBeInTheDocument());
    expect(screen.queryByText("Delete Task")).not.toBeInTheDocument();
  });
});
