import { NavLink, useLocation } from "react-router";
import { Home, BookOpen, GraduationCap, HelpCircle, User } from "lucide-react";

const navItems = [
  { to: "/dashboard", icon: Home, label: "Home" },
  { to: "/books", icon: BookOpen, label: "Books" },
  { to: "/study", icon: GraduationCap, label: "Study" },
  { to: "/quizzes", icon: HelpCircle, label: "Quiz" },
  { to: "/profile", icon: User, label: "Profile" },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.to ||
            (item.to === "/dashboard" && location.pathname.startsWith("/dashboard")) ||
            (item.to === "/books" && location.pathname.startsWith("/books")) ||
            (item.to === "/study" && location.pathname.startsWith("/study")) ||
            (item.to === "/quizzes" && location.pathname.startsWith("/quizzes")) ||
            (item.to === "/profile" && location.pathname.startsWith("/profile"));
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors"
            >
              <Icon
                className={`h-5 w-5 transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
