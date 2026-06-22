"use client";

import * as React from "react";
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import { ArrowRightIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { GridCard } from "@/components/ui/grid-card";

type NavItemType = {
  title: string;
  href: string;
  description?: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

function NavigationMenu({
  className,
  children,
  viewport = true,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Root> & {
  viewport?: boolean;
}) {
  return (
    <NavigationMenuPrimitive.Root
      data-slot="navigation-menu"
      data-viewport={viewport}
      className={cn("group/navigation-menu relative flex max-w-max flex-1 items-center justify-center", className)}
      {...props}
    >
      {children}
      {viewport && <NavigationMenuViewport />}
    </NavigationMenuPrimitive.Root>
  );
}

function NavigationMenuList({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.List>) {
  return (
    <NavigationMenuPrimitive.List
      data-slot="navigation-menu-list"
      className={cn("flex flex-1 list-none items-center justify-center gap-1", className)}
      {...props}
    />
  );
}

function NavigationMenuItem({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Item>) {
  return <NavigationMenuPrimitive.Item data-slot="navigation-menu-item" className={cn("relative", className)} {...props} />;
}

function NavigationMenuTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Trigger>) {
  return (
    <NavigationMenuPrimitive.Trigger
      data-slot="navigation-menu-trigger"
      className={cn(
        "group inline-flex h-9 w-max items-center justify-center rounded-full px-3 text-sm font-medium text-textSecondary outline-none transition",
        "hover:bg-elevated hover:text-textPrimary focus:bg-white/10 focus:text-textPrimary focus-visible:ring-2 focus-visible:ring-primary/60",
        "data-[state=open]:bg-white/10 data-[state=open]:text-textPrimary",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="ml-1 size-3 transition duration-200 group-data-[state=open]:rotate-180" aria-hidden="true" />
    </NavigationMenuPrimitive.Trigger>
  );
}

function NavigationMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Content>) {
  return (
    <NavigationMenuPrimitive.Content
      data-slot="navigation-menu-content"
      className={cn(
        "left-0 top-0 w-full data-[motion=from-end]:animate-[nav-slide-left_180ms_ease] data-[motion=from-start]:animate-[nav-slide-right_180ms_ease] md:absolute md:w-auto",
        "group-data-[viewport=false]/navigation-menu:top-full group-data-[viewport=false]/navigation-menu:mt-3 group-data-[viewport=false]/navigation-menu:overflow-hidden group-data-[viewport=false]/navigation-menu:rounded-2xl group-data-[viewport=false]/navigation-menu:border group-data-[viewport=false]/navigation-menu:border-border group-data-[viewport=false]/navigation-menu:bg-[var(--bg-panel)] group-data-[viewport=false]/navigation-menu:shadow-[0_24px_90px_rgba(0,0,0,0.42)] group-data-[viewport=false]/navigation-menu:backdrop-blur-2xl",
        className,
      )}
      {...props}
    />
  );
}

function NavigationMenuViewport({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Viewport>) {
  return (
    <div className="absolute left-0 top-full isolate z-50 flex justify-center">
      <NavigationMenuPrimitive.Viewport
        data-slot="navigation-menu-viewport"
        className={cn(
          "relative mt-3 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-2xl border border-border bg-[var(--bg-panel)] text-textPrimary shadow-[0_24px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl transition-[width,height] duration-200 md:w-[var(--radix-navigation-menu-viewport-width)]",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function NavigationMenuLink({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Link>) {
  return (
    <NavigationMenuPrimitive.Link
      data-slot="navigation-menu-link"
      className={cn(
        "flex flex-col justify-center gap-1 rounded-lg px-3 py-2 text-sm text-textSecondary outline-none transition hover:bg-elevated hover:text-textPrimary focus:bg-elevated focus:text-textPrimary focus-visible:ring-2 focus-visible:ring-primary/60",
        className,
      )}
      {...props}
    />
  );
}

function NavigationMenuIndicator({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Indicator>) {
  return (
    <NavigationMenuPrimitive.Indicator
      data-slot="navigation-menu-indicator"
      className={cn("top-full z-[1] flex h-2 items-end justify-center overflow-hidden", className)}
      {...props}
    >
      <div className="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm border-l border-t border-border bg-[var(--bg-panel)]" />
    </NavigationMenuPrimitive.Indicator>
  );
}

function NavGridCard({
  link,
  className,
  ...props
}: React.ComponentProps<"a"> & {
  link: NavItemType;
}) {
  return (
    <NavigationMenuPrimitive.Link asChild>
      <a href={link.href} className={cn("block", className)} {...props}>
        <GridCard>
          {link.icon ? <link.icon className="relative size-5 text-primary" /> : null}
          <div className="relative">
            <span className="text-sm font-medium text-textPrimary">{link.title}</span>
            {link.description ? <p className="mt-2 text-xs leading-relaxed text-textSecondary">{link.description}</p> : null}
          </div>
        </GridCard>
      </a>
    </NavigationMenuPrimitive.Link>
  );
}

function NavSmallItem({
  item,
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuLink> & {
  item: Omit<NavItemType, "description">;
}) {
  return (
    <NavigationMenuLink className={cn("group relative h-max flex-row items-center gap-x-3 px-2 py-2", className)} {...props}>
      {item.icon ? <item.icon /> : null}
      <p className="text-sm">{item.title}</p>
      <div className="relative ml-auto flex h-full w-4 items-center">
        <ArrowRightIcon className="size-4 -translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
      </div>
    </NavigationMenuLink>
  );
}

function NavLargeItem({
  link,
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuLink> & {
  link: NavItemType;
}) {
  return (
    <NavigationMenuLink className={cn("group relative flex flex-col justify-center border border-border bg-surface p-0", className)} {...props}>
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="space-y-1">
          <span className="text-sm font-medium leading-none text-textPrimary">{link.title}</span>
          {link.description ? <p className="line-clamp-1 text-xs text-textSecondary">{link.description}</p> : null}
        </div>
        {link.icon ? <link.icon className="size-6 text-primary" /> : null}
      </div>
    </NavigationMenuLink>
  );
}

function NavItemMobile({
  item,
  className,
  ...props
}: React.ComponentProps<"a"> & {
  item: NavItemType;
}) {
  return (
    <a
      className={cn(
        "group relative flex gap-x-2 rounded-lg p-2 text-sm outline-none transition hover:bg-elevated hover:text-textPrimary focus-visible:ring-2 focus-visible:ring-primary/60",
        className,
      )}
      {...props}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface">
        {item.icon ? <item.icon /> : null}
      </div>
      <div className="flex h-10 min-w-0 flex-col justify-center">
        <p className="text-sm text-textPrimary">{item.title}</p>
        <span className="line-clamp-1 text-xs leading-snug text-textSecondary">{item.description}</span>
      </div>
    </a>
  );
}

export {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
  NavGridCard,
  NavSmallItem,
  NavLargeItem,
  NavItemMobile,
  type NavItemType,
};
