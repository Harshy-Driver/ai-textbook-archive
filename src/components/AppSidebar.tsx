import { NavLink, useLocation, useNavigate } from "react-router";
import {
  Home,
  BookOpen,
  GraduationCap,
  HelpCircle,
  User,
  Settings,
  LogOut,
  Search,
  ClipboardCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";

const sidebarItems = [
  { to: "/dashboard", icon: Home, label: "Dashboard" },
  { to: "/books", icon: BookOpen, label: "My Books" },
  { to: "/study", icon: GraduationCap, label: "Study" },
  { to: "/quizzes", icon: HelpCircle, label: "Quizzes" },
  { to: "/exam", icon: ClipboardCheck, label: "Exam Mode" },
  { to: "/search", icon: Search, label: "Search" },
  { to: "/profile", icon: User, label: "Profile" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-sidebar h-screen sticky top-0 overflow-y-auto">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <img src={logo} alt="StudyAI" className="h-9 w-9 rounded-lg" />
          <div>
            <h1 className="font-serif-vintage text-lg font-bold text-foreground tracking-tight leading-none">
              StudyAI UAE
            </h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Personal Textbook Study
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {sidebarItems.map((item) => {
          const isActive =
            location.pathname === item.to ||
            (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Icon className="h-4.5 w-4.5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-border">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors w-full"
        >
          <LogOut className="h-4.5 w-4.5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
