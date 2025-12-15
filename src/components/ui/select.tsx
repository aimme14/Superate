import * as React from "react"
import {
  CaretSortIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@radix-ui/react-icons"
import * as SelectPrimitive from "@radix-ui/react-select"

import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "group flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground",
      "transition-all duration-200 ease-in-out",
      "hover:border-teal-400/50 hover:shadow-md hover:shadow-teal-200/20",
      "focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400",
      "dark:hover:border-teal-500/50 dark:hover:shadow-teal-500/10",
      "dark:focus:ring-teal-500/50 dark:focus:border-teal-500",
      "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm",
      "[&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <CaretSortIcon className="h-4 w-4 opacity-50 transition-transform duration-200 group-hover:rotate-180" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUpIcon />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDownIcon />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-2xl",
        "shadow-black/10 dark:shadow-black/40",
        "backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        "data-[state=open]:duration-200 data-[state=closed]:duration-150",
        "ring-1 ring-black/5 dark:ring-white/10",
        "border-teal-200/50 dark:border-teal-800/50",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-2",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-md py-2.5 pl-3 pr-9 text-sm outline-none transition-all duration-200 ease-in-out",
      // Light mode hover and focus
      "hover:bg-gradient-to-r hover:from-teal-50/80 hover:via-blue-50/80 hover:to-cyan-50/80 hover:shadow-md hover:shadow-teal-200/30 hover:border-l-2 hover:border-teal-400",
      "focus:bg-gradient-to-r focus:from-teal-100/90 focus:via-blue-100/90 focus:to-cyan-100/90 focus:shadow-lg focus:shadow-teal-300/40 focus:border-l-2 focus:border-teal-500",
      "data-[highlighted]:bg-gradient-to-r data-[highlighted]:from-teal-100 data-[highlighted]:via-blue-100 data-[highlighted]:to-cyan-100 data-[highlighted]:shadow-lg data-[highlighted]:shadow-teal-300/50 data-[highlighted]:border-l-2 data-[highlighted]:border-teal-500",
      // Dark mode hover and focus
      "dark:hover:bg-gradient-to-r dark:hover:from-teal-950/60 dark:hover:via-blue-950/60 dark:hover:to-cyan-950/60 dark:hover:shadow-teal-500/20 dark:hover:border-teal-600",
      "dark:focus:bg-gradient-to-r dark:focus:from-teal-900/80 dark:focus:via-blue-900/80 dark:focus:to-cyan-900/80 dark:focus:shadow-teal-500/30 dark:focus:border-teal-500",
      "dark:data-[highlighted]:bg-gradient-to-r dark:data-[highlighted]:from-teal-900/90 dark:data-[highlighted]:via-blue-900/90 dark:data-[highlighted]:to-cyan-900/90 dark:data-[highlighted]:shadow-teal-500/40 dark:data-[highlighted]:border-teal-500",
      // Disabled states
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[disabled]:hover:border-l-0",
      "group/item",
      className
    )}
    {...props}
  >
    {/* Efecto de brillo animado en hover */}
    <div className="absolute inset-0 rounded-md bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover/item:opacity-100 group-hover/item:animate-shimmer transition-opacity duration-300 pointer-events-none" />
    
    {/* Borde izquierdo animado */}
    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-teal-400 via-blue-400 to-cyan-400 opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 rounded-l-md" />
    
    <span className="absolute right-2 flex h-4 w-4 items-center justify-center transition-all duration-200 group-hover/item:rotate-12">
      <SelectPrimitive.ItemIndicator className="text-teal-600 dark:text-teal-400">
        <CheckIcon className="h-4 w-4 animate-in fade-in-0 zoom-in-95 duration-200" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText className="relative z-10 transition-all duration-200 group-hover/item:text-teal-700 dark:group-hover/item:text-teal-300 group-hover/item:font-medium">
      {children}
    </SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
