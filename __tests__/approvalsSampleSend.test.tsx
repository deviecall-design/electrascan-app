import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const auth = { user: null as { id: string; email: string } | null };
const fetchSpy = vi.fn();

vi.mock("../hooks/useOptionalAuthUser", () => ({
  default: () => auth.user,
}));

vi.mock("../contexts/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("../services/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: vi.fn(),
  },
}));

import ApprovalsScreen from "../screens/ApprovalsScreen";

function renderApprovals() {
  return render(
    <MemoryRouter>
      <ApprovalsScreen />
    </MemoryRouter>,
  );
}

describe("Approvals DocuSign send", () => {
  beforeEach(() => {
    auth.user = null;
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
  });

  it("disables send and does not call DocuSign when nobody is signed in", () => {
    renderApprovals();
    const button = screen.getByRole("button", { name: /send for approval/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/sign in before sending a docusign envelope/i)).toBeInTheDocument();
    button.click();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("disables send for the sample envelope even when a user is signed in", () => {
    auth.user = { id: "user-1", email: "damien@vesh.example" };
    renderApprovals();
    const button = screen.getByRole("button", { name: /send for approval/i });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(/sample data — docusign send is disabled until a saved estimate is attached/i),
    ).toBeInTheDocument();
    button.click();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
