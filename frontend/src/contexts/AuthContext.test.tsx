import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./AuthContext";
import type { MeResponse } from "../services/auth";

// AuthContext is the source of truth for `can(category, level)`, the gate
// every page in the app uses to hide Create/Edit/Delete controls from
// View-only roles. A regression here silently exposes write actions to
// roles that should only be able to view — exactly the class of bug flagged
// in past audits as having zero test coverage.
vi.mock("../services/auth", () => ({
  GetMe: vi.fn(),
  Logout: vi.fn(),
}));

import { GetMe, Logout } from "../services/auth";

const baseUser: MeResponse = {
  id: 1,
  email: "analyst@example.com",
  first_name: "Ana",
  last_name: "Lyst",
  profile: "",
  phone_number: "",
  location: "",
  position: "",
  role: "custom",
  role_id: 7,
  permissions: {
    dashboard: { view: true, manage: false },
    threat_intel: { view: true, manage: true },
    user_management: { view: false, manage: false },
  },
};

// Renders every field/derivation the rest of the app relies on, so a single
// test can assert on all of them via plain text content.
const Probe: React.FC = () => {
  const { isLoading, isAuthed, isAdmin, can } = useAuth();
  if (isLoading) return <div>loading</div>;
  return (
    <div>
      <div data-testid="authed">{String(isAuthed)}</div>
      <div data-testid="admin">{String(isAdmin)}</div>
      <div data-testid="dashboard-view">{String(can("dashboard", "view"))}</div>
      <div data-testid="dashboard-manage">{String(can("dashboard", "manage"))}</div>
      <div data-testid="threat-manage">{String(can("threat_intel", "manage"))}</div>
      <div data-testid="unknown-category">{String(can("does_not_exist", "view"))}</div>
    </div>
  );
};

const renderProbe = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );

describe("AuthContext.can()", () => {
  beforeEach(() => {
    vi.mocked(GetMe).mockReset();
    vi.mocked(Logout).mockReset();
  });

  it("grants view but withholds manage for a View-only category", async () => {
    vi.mocked(GetMe).mockResolvedValue(baseUser);
    renderProbe();

    await waitFor(() => expect(screen.getByTestId("authed")).toHaveTextContent("true"));

    expect(screen.getByTestId("dashboard-view")).toHaveTextContent("true");
    expect(screen.getByTestId("dashboard-manage")).toHaveTextContent("false");
  });

  it("grants manage when the role's permission row says so", async () => {
    vi.mocked(GetMe).mockResolvedValue(baseUser);
    renderProbe();

    await waitFor(() => expect(screen.getByTestId("authed")).toHaveTextContent("true"));
    expect(screen.getByTestId("threat-manage")).toHaveTextContent("true");
  });

  it("fails closed (false) for a category the role has no permission row for at all", async () => {
    vi.mocked(GetMe).mockResolvedValue(baseUser);
    renderProbe();

    await waitFor(() => expect(screen.getByTestId("authed")).toHaveTextContent("true"));
    expect(screen.getByTestId("unknown-category")).toHaveTextContent("false");
  });

  it("derives isAdmin strictly from user_management manage, not from role name", async () => {
    vi.mocked(GetMe).mockResolvedValue(baseUser); // role: "custom", user_management.manage: false
    renderProbe();

    await waitFor(() => expect(screen.getByTestId("authed")).toHaveTextContent("true"));
    expect(screen.getByTestId("admin")).toHaveTextContent("false");
  });

  it("treats a failed /auth/me as logged out rather than throwing", async () => {
    vi.mocked(GetMe).mockResolvedValue(null);
    renderProbe();

    await waitFor(() => expect(screen.getByTestId("authed")).toHaveTextContent("false"));
    // No permission should ever evaluate true for an unauthenticated user.
    expect(screen.getByTestId("dashboard-view")).toHaveTextContent("false");
  });

  it("clears the user on logout even if the backend call fails", async () => {
    vi.mocked(GetMe).mockResolvedValue(baseUser);
    vi.mocked(Logout).mockRejectedValue(new Error("network error"));

    const LogoutProbe: React.FC = () => {
      const { isAuthed, logout } = useAuth();
      return (
        <div>
          <div data-testid="authed">{String(isAuthed)}</div>
          <button onClick={() => void logout()}>sign out</button>
        </div>
      );
    };

    render(
      <AuthProvider>
        <LogoutProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("authed")).toHaveTextContent("true"));

    await userEvent.click(screen.getByText("sign out"));

    await waitFor(() => expect(screen.getByTestId("authed")).toHaveTextContent("false"));
  });
});
