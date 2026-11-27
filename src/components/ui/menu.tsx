import type { ComponentProps, ComponentType } from "react";
import { cn } from "@/lib/cn";

/** A small popover list of actions. Position it with className (it is absolutely placed). */
export function Menu({ className, ...props }: ComponentProps<"div">) {
  return <div role="menu" className={cn("absolute z-20 w-48 rounded-lg border border-line bg-surface p-1.5 shadow-pop", className)} {...props} />;
}

/** One action in a Menu. `danger` for destructive ones such as Delete. */
export function MenuItem({
  icon: Icon,
  danger = false,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[15px] hover:bg-surface-sunken/60",
        "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus",
        danger ? "text-danger" : "text-ink",
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1 border-t border-line" />;
}
