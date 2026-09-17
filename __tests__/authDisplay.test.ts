import { describe, it, expect } from "vitest";
import { nameFromAuthUser, firstNameFromDisplay } from "../hooks/useOptionalAuthUser";
import { formatAuShortDateTime } from "../lib/dates";
import type { User } from "@supabase/supabase-js";

function fakeUser(partial: Partial<User> & { user_metadata?: Record<string, unknown> }): User {
  return {
    id: "u1",
    app_metadata: {},
    aud: "authenticated",
    created_at: "",
    ...partial,
  } as User;
}

describe("nameFromAuthUser", () => {
  it("returns null when there is no session user", () => {
    expect(nameFromAuthUser(null)).toBeNull();
  });

  it("prefers full_name over email", () => {
    expect(
      nameFromAuthUser(
        fakeUser({
          email: "damienc13@gmail.com",
          user_metadata: { full_name: "Damien Callaghan" },
        }),
      ),
    ).toBe("Damien Callaghan");
  });

  it("falls back to the email local-part", () => {
    expect(nameFromAuthUser(fakeUser({ email: "damienc13@gmail.com", user_metadata: {} }))).toBe(
      "damienc13",
    );
  });
});

describe("firstNameFromDisplay", () => {
  it("takes the first word", () => {
    expect(firstNameFromDisplay("Damien Callaghan")).toBe("Damien");
    expect(firstNameFromDisplay("Vesh")).toBe("Vesh");
  });
});

describe("formatAuShortDateTime", () => {
  it("does not invent just now for missing timestamps", () => {
    expect(formatAuShortDateTime(null)).toBe("—");
    expect(formatAuShortDateTime("not-a-date")).toBe("—");
  });

  it("formats a real ISO timestamp", () => {
    const label = formatAuShortDateTime("2026-09-16T10:00:00.000Z");
    expect(label).not.toBe("just now");
    expect(label).not.toBe("—");
  });
});
