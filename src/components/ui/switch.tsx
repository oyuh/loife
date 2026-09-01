import { Switch as SwitchPrimitive } from 'radix-ui'
import type * as React from 'react'

import { cn } from '#/lib/utils.ts'

/**
 * Kumo's switch, on radix's primitive instead of base-ui's.
 *
 * The shape is the whole point of it. The thumb is a full-height square rather
 * than a circle inset in a track, so the control reads as one solid chip
 * sliding end to end, and both track and thumb are squircles — a superellipse,
 * not a rounded rectangle — wherever `corner-shape` is supported. Browsers
 * without it fall back to a 5px radius, which is the closest a plain radius
 * gets to the same silhouette at this size.
 *
 * The thumb stays dark in both states and only the track changes colour. Kumo
 * inverts this on its dark theme because its track is a dark blue; ours is a
 * light purple, so the contrast has to sit the other way round.
 */
/*
 * The slid position is spelled out in full rather than composed from the
 * variant, because tailwind only sees class names that appear literally in the
 * source and would emit nothing for a string built at runtime.
 */
const SIZES = {
  sm: { track: 'h-4 w-8', thumb: 'w-4', slide: 'data-[state=checked]:left-4' },
  base: {
    track: 'h-4.5 w-9',
    thumb: 'w-4.5',
    slide: 'data-[state=checked]:left-4.5',
  },
  lg: { track: 'h-5 w-10', thumb: 'w-5', slide: 'data-[state=checked]:left-5' },
} as const

/* Squircle where it exists, closest plain radius where it does not. */
const SQUIRCLE =
  'rounded-[5px] supports-[corner-shape:squircle]:rounded-[10px] [corner-shape:squircle]'

function Switch({
  className,
  size = 'base',
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: keyof typeof SIZES
}) {
  const s = SIZES[size]

  return (
    <SwitchPrimitive.Root
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center border-none p-0 ring outline-none',
        /*
         * The track tops out at 18px tall, under the 24px WCAG 2.2 target
         * minimum and well under a thumb. A pseudo-element pads the hit area
         * out to 44 square without moving the control in the layout.
         */
        "before:absolute before:-inset-x-1 before:-inset-y-[13px] before:content-['']",
        'transition-colors duration-150 ease-out motion-reduce:transition-none',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'bg-secondary ring-border',
        'data-[state=checked]:bg-primary data-[state=checked]:ring-(--primary-edge)',
        s.track,
        SQUIRCLE,
        className,
      )}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'absolute top-0 bottom-0 left-0 bg-background shadow-[0_1px_2px_rgba(0,0,0,0.4)]',
          'transition-all duration-150 ease-out motion-reduce:transition-none',
          s.thumb,
          SQUIRCLE,
          s.slide,
        )}
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
