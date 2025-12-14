import { ImageIcon, History } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";

export function Header() {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Compress", icon: ImageIcon },
    { path: "/history", label: "History", icon: History },
  ];

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">GIF Compressor</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
