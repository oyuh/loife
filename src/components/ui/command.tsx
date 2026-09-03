import { Command as CommandPrimitive } from 'cmdk'
import { SearchIcon } from 'lucide-react'
import type * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '#/components/ui/drawer.tsx'
import { useMediaQuery } from '#/lib/use-media-query.ts'
import { cn } from '#/lib/utils.ts'

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground',
        className,
      )}
      {...props}
    />
  )
}

function CommandDialog({
  title = 'Command Palette',
  description = 'Search for a command to run...',
  children,
  className,
  showCloseButton = true,
  // Forwarded to the inner Command. Without it there is no way to turn off
  // cmdk's own filtering, which would run on top of a caller's own matching.
  commandProps,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  commandProps?: React.ComponentProps<typeof Command>
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
}) {
  const isDesktop = useMediaQuery('(min-width: 640px)')

  const command = (
    <Command
      {...commandProps}
      className="**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
      {children}
    </Command>
  )

  /*
   * A sheet on a phone, like every other dialog in this app. A centred box
   * put the field halfway up the screen with the keyboard under it, which
   * is the one place a thumb cannot comfortably reach.
   */
  if (!isDesktop) {
    return (
      <Drawer {...props}>
        {/*
          bg-popover to match the Command inside it. Left as bg-background
          the grabber's strip sat a shade darker than everything under it,
          which read as a mismatched lip across the top of the sheet.
        */}
        {/*
          Tall on purpose, and the variant has to match the one drawer.tsx
          already sets or tailwind-merge keeps both and the base wins.

          vaul resizes a sheet when the keyboard opens, and which arithmetic
          it uses turns on `drawerHeight > innerHeight * 0.8`. Under that bar
          it sizes the sheet from 26px below the top of the screen rather
          than from where the sheet actually starts, so a short sheet gets
          stretched to most of the screen and iOS then shoves it up out of
          the way of the keyboard. Measured at 375x812: the cap was 649.8px
          against a threshold of 649.6px. The add sheet is a long form and
          clears it, which is why that one has always behaved.
        */}
        <DrawerContent className="h-[92dvh] bg-popover pb-[var(--bottom-inset)] data-[vaul-drawer-direction=bottom]:max-h-[92dvh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          {/*
            The sheet is a fixed 92dvh, so whatever is inside it has to be
            told to fill that height. Left to size itself the column ended
            at the list's own cap and the sheet kept the rest as dead space
            below the last row. Scrolling belongs to the list rather than
            this wrapper, which keeps the search field pinned to the top of
            the sheet instead of letting it scroll away.
          */}
          <div className="flex min-h-0 flex-1 flex-col [&_[data-slot=command-list]]:max-h-none [&_[data-slot=command-list]]:min-h-0 [&_[data-slot=command-list]]:flex-1">
            {command}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn('overflow-hidden bg-popover p-0', className)}
        showCloseButton={showCloseButton}
      >
        {command}
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex h-9 items-center gap-2 border-b px-3"
    >
      <SearchIcon className="size-4 shrink-0 opacity-50" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          /*
           * text-base below md, matching Input and Textarea. iOS zooms the
           * page in on any field it focuses under 16px, and this was the one
           * field in the app still at 14. The zoom is also what left the
           * fixed tab row sitting high after the sheet closed: changing the
           * page scale strands position:fixed until something scrolls.
           */
          'flex h-10 w-full rounded-md bg-transparent py-3 text-base outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className,
        )}
        {...props}
      />
    </div>
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        'max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto',
        className,
      )}
      {...props}
    />
  )
}

function CommandEmpty({
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className="py-6 text-center text-sm"
      {...props}
    />
  )
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        'overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn('-mx-1 h-px bg-border', className)}
      {...props}
    />
  )
}

function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        'ml-auto text-xs tracking-widest text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
