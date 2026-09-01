'use client'

/**
 * Kibo does not ship a tooltip. Its registry has `glimpse`, which is a hover
 * card for link previews, and `relative-time`, which is a clock grid, and
 * neither is a tooltip. So this is written the way kibo writes a component:
 * thin composable wrappers over the shadcn primitive, plus the few content
 * parts that stop every call site from re-inventing the same two rows.
 *
 * Kept under kibo-ui so it sits with the rest of them and stays outside biome,
 * matching the other vendored components.
 */

import type { ComponentProps, ReactNode } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip.tsx'
import { cn } from '#/lib/utils.ts'

export type KiboTooltipProps = ComponentProps<typeof Tooltip>

export const KiboTooltip = (props: KiboTooltipProps) => <Tooltip {...props} />

export type KiboTooltipTriggerProps = ComponentProps<typeof TooltipTrigger>

export const KiboTooltipTrigger = (props: KiboTooltipTriggerProps) => (
  <TooltipTrigger {...props} />
)

export type KiboTooltipContentProps = ComponentProps<typeof TooltipContent>

export const KiboTooltipContent = ({
  className,
  ...props
}: KiboTooltipContentProps) => (
  <TooltipContent className={cn('max-w-64', className)} {...props} />
)

export type KiboTooltipProviderProps = ComponentProps<typeof TooltipProvider>

export const KiboTooltipProvider = (props: KiboTooltipProviderProps) => (
  <TooltipProvider {...props} />
)

export type KiboTooltipTitleProps = ComponentProps<'p'>

export const KiboTooltipTitle = ({
  className,
  ...props
}: KiboTooltipTitleProps) => (
  <p className={cn('font-medium text-xs', className)} {...props} />
)

export type KiboTooltipDescriptionProps = ComponentProps<'p'>

export const KiboTooltipDescription = ({
  className,
  ...props
}: KiboTooltipDescriptionProps) => (
  <p className={cn('text-[11px] text-muted-foreground', className)} {...props} />
)

export type KiboTooltipRowProps = {
  label: ReactNode
  children: ReactNode
  className?: string
}

/**
 * A labelled line. Tabular numerals so a ticking clock does not shuffle the
 * width of the panel every second.
 */
export const KiboTooltipRow = ({
  label,
  children,
  className,
}: KiboTooltipRowProps) => (
  <p
    className={cn(
      'flex items-baseline justify-between gap-4 text-[11px]',
      className
    )}
  >
    <span className="text-muted-foreground">{label}</span>
    <span className="tabular-nums">{children}</span>
  </p>
)
