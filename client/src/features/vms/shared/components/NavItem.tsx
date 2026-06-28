import Link from 'next/link';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  active?: boolean;
  collapsed?: boolean;
  disabled?: boolean;
}

export function NavItem({
  icon: Icon,
  label,
  href,
  active,
  collapsed,
  disabled,
}: NavItemProps) {
  return (
    <Link
      href={disabled ? '#' : href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active 
          ? "bg-green-600 text-white hover:bg-green-700" 
          : "text-gray-600 hover:bg-gray-100 hover:text-black",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        collapsed && "justify-center px-0 py-2.5"
      )}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      title={collapsed ? label : undefined}
    >
      <Icon className={cn("h-5 w-5 flex-shrink-0", active ? "text-white" : "text-gray-500")} />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
