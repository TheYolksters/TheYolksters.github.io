import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/lib/utils";

/**
 * Slide-out panel built on Radix Dialog — focus trap, Escape-to-close,
 * scroll lock and `aria-modal` all come from the primitive.
 *
 * Enter/exit animations live in global.css, keyed off the `data-slot` and
 * `data-state` attributes below (this project has no tailwindcss-animate).
 */

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

function SheetOverlay({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-cosmos/80 backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-6 border-nebula-edge bg-cosmos p-6 shadow-[0_0_60px_-12px_rgb(0_0_0/0.9)]",
          side === "right" && "inset-y-0 right-0 h-full w-80 max-w-[85vw] border-l",
          side === "left" && "inset-y-0 left-0 h-full w-80 max-w-[85vw] border-r",
          side === "top" && "inset-x-0 top-0 w-full border-b",
          side === "bottom" && "inset-x-0 bottom-0 w-full border-t",
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          aria-label="Close menu"
          className="absolute right-4 top-4 rounded-lg p-2 text-dust transition-colors hover:bg-nebula hover:text-star focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            className="size-5"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-display text-lg font-extrabold tracking-wide text-star",
        className,
      )}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
};
