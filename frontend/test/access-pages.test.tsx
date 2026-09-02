import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/login/page";
import RegisterPage from "@/app/register/page";
import { ApiError, login, registerTeam } from "@/lib/api";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    login: vi.fn(),
    registerTeam: vi.fn(),
  };
});

const mockedLogin = vi.mocked(login);
const mockedRegisterTeam = vi.mocked(registerTeam);

async function fillRegistration() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Team name"), " Null Pointers ");

  await user.type(screen.getByLabelText("Team password"), "teamsecret");

  for (let index = 1; index <= 3; index += 1) {
    await user.type(screen.getByLabelText(`Member ${index} name`), `Member ${index}`);
    await user.type(
      screen.getByLabelText(`Member ${index} email`),
      `member${index}@example.com`,
    );
  }

  return user;
}

describe("access pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an asymmetric event-branding region beside the login workspace", () => {
    render(<LoginPage />);

    const branding = screen.getByRole("region", { name: "DigiHunt event identity" });
    expect(within(branding).getAllByAltText("IETE Students' Forum logo").length).toBeGreaterThan(0);
    expect(branding).toHaveTextContent("IETE SF");
    expect(branding).toHaveTextContent("DIGIHUNT");
    expect(branding).toHaveClass("lg:col-span-5");
    expect(screen.getByRole("region", { name: "Team access workspace" })).toHaveClass(
      "lg:col-span-7",
    );
  });

  it("provides accessible login labels and preserves autocomplete attributes", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText("Email address")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });

  it("submits login from the keyboard and redirects with the existing role behavior", async () => {
    mockedLogin.mockResolvedValue({
      access_token: "token",
      token_type: "bearer",
      role: "judge",
      team_code: null,
    });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email address"), " judge@example.com ");
    await user.type(screen.getByLabelText("Password"), "secret123{Enter}");

    await waitFor(() => expect(mockedLogin).toHaveBeenCalledWith("judge@example.com", "secret123"));
    expect(push).toHaveBeenCalledWith("/judge");
  });

  it("announces invalid credentials and restores the login button", async () => {
    let rejectLogin!: (reason: unknown) => void;
    mockedLogin.mockImplementation(
      () => new Promise((_, reject) => {
        rejectLogin = reject;
      }),
    );
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email address"), "team@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-pass");
    await user.click(screen.getByRole("button", { name: "Enter the hunt" }));

    expect(screen.getByRole("button", { name: "Authenticating" })).toBeDisabled();
    rejectLogin(new ApiError(401, "Unauthorized"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Access denied. Invalid email or password.",
    );
    expect(screen.getByRole("button", { name: "Enter the hunt" })).toBeEnabled();
  });

  it("exposes unique registration labels and one shared team password", () => {
    render(<RegisterPage />);

    expect(screen.getByLabelText("Team name")).toBeInTheDocument();
    expect(screen.getByLabelText("Team password")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(screen.getByLabelText("Member 1 name")).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText("Member 2 email")).toHaveAttribute("autocomplete", "email");
    expect(screen.queryByLabelText("Member 3 password")).not.toBeInTheDocument();
  });

  it("announces registration validation feedback without calling the API", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.click(screen.getByRole("button", { name: "Register team" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Team name is required.");
    expect(mockedRegisterTeam).not.toHaveBeenCalled();
  });

  it("shows registration submitting state and preserves the request payload", async () => {
    let resolveRegistration!: (value: Awaited<ReturnType<typeof registerTeam>>) => void;
    mockedRegisterTeam.mockImplementation(
      () => new Promise((resolve) => {
        resolveRegistration = resolve;
      }),
    );
    render(<RegisterPage />);
    const user = await fillRegistration();

    await user.click(screen.getByRole("button", { name: "Register team" }));

    expect(screen.getByRole("button", { name: "Registering team" })).toBeDisabled();
    expect(mockedRegisterTeam).toHaveBeenCalledWith({
      team_name: "Null Pointers",
      team_password: "teamsecret",
      members: [
        { name: "Member 1", email: "member1@example.com" },
        { name: "Member 2", email: "member2@example.com" },
        { name: "Member 3", email: "member3@example.com" },
      ],
    });

    resolveRegistration({
      team_code: "KH-2048",
      team_name: "Null Pointers",
      members: [],
    });

    expect(await screen.findByText("KH-2048")).toBeVisible();
    expect(screen.getByRole("button", { name: "Go to login" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
