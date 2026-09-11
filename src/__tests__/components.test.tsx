import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import React from "react";

// Mock convex and auth dependencies
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
    user: {
      _id: "user1",
      name: "Test Student",
      email: "test@example.com",
      grade: 10,
      subject: "physics",
      curriculum: "general",
      onboardingCompleted: true,
    },
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => [],
  useMutation: () => vi.fn(),
}));

// Mock the LogoDropdown which uses useAuth
vi.mock("@/components/LogoDropdown", () => ({
  LogoDropdown: () => <div data-testid="logo-dropdown" />,
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...filterProps(props)}>{children}</div>,
    nav: ({ children, ...props }: any) => <nav {...filterProps(props)}>{children}</nav>,
    header: ({ children, ...props }: any) => <header {...filterProps(props)}>{children}</header>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

function filterProps(props: Record<string, any>) {
  const filtered: Record<string, any> = {};
  const domProps = ["className", "style", "id", "role", "tabIndex", "onClick", "onChange", "onSubmit", "type", "value", "checked", "disabled", "placeholder", "name", "htmlFor"];
  for (const key of Object.keys(props)) {
    if (domProps.includes(key) || key.startsWith("data-") || key.startsWith("aria-")) {
      filtered[key] = props[key];
    }
  }
  return filtered;
}

import { BottomNav } from "@/components/BottomNav";
import { AppLayout } from "@/components/AppLayout";

function renderWithRouter(ui: React.ReactElement, { route = "/" } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>
  );
}

describe("BottomNav", () => {
  it("renders all navigation items", () => {
    renderWithRouter(<BottomNav />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Books")).toBeInTheDocument();
    expect(screen.getByText("Study")).toBeInTheDocument();
    expect(screen.getByText("Quiz")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });

  it("renders 5 nav links", () => {
    renderWithRouter(<BottomNav />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(5);
  });

  it("links have correct destinations", () => {
    renderWithRouter(<BottomNav />);
    expect(screen.getByText("Home").closest("a")).toHaveAttribute("href", "/dashboard");
    expect(screen.getByText("Books").closest("a")).toHaveAttribute("href", "/books");
    expect(screen.getByText("Study").closest("a")).toHaveAttribute("href", "/study");
    expect(screen.getByText("Quiz").closest("a")).toHaveAttribute("href", "/quizzes");
    expect(screen.getByText("Profile").closest("a")).toHaveAttribute("href", "/profile");
  });
});

describe("AppLayout", () => {
  it("renders children content", () => {
    renderWithRouter(
      <AppLayout>
        <div data-testid="test-content">Hello World</div>
      </AppLayout>
    );
    expect(screen.getByTestId("test-content")).toBeInTheDocument();
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("renders the sidebar on desktop", () => {
    renderWithRouter(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );
    // Sidebar contains "StudyAI UAE" brand text
    expect(screen.getByText("StudyAI UAE")).toBeInTheDocument();
  });

  it("renders bottom navigation", () => {
    renderWithRouter(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("renders sidebar navigation links", () => {
    renderWithRouter(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("My Books")).toBeInTheDocument();
    expect(screen.getByText("Quizzes")).toBeInTheDocument();
    expect(screen.getByText("Exam Mode")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });
});
