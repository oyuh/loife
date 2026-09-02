import { TanStackDevtools } from '@tanstack/react-devtools'
import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import appCss from '../styles.css?url'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        /*
         * No viewport-fit=cover. With it the web view runs under the home
         * indicator and the status bar, and the app owes both of them room
         * out of its own layout. That is a trade worth making for a design
         * that bleeds to the edges, and this one does not: it left a band
         * of dead page below the tab row on an installed iPhone. Without
         * it iOS keeps that area to itself, env(safe-area-inset-*) reports
         * 0, and the padding that reads it quietly falls back to its own
         * floor.
         */
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'loife',
      },
      {
        name: 'color-scheme',
        content: 'dark',
      },
      /*
       * Android Chrome paints the address bar and the task switcher card with
       * this, and iOS uses it behind the status bar once the app is installed.
       * Without it both fall back to white and the app appears to have a
       * bright band welded to the top of it.
       *
       * It matches --background rather than --card, because that is what sits
       * under the top of every screen.
       */
      {
        name: 'theme-color',
        content: '#22252a',
      },
      /*
       * Safari draws its own status bar over the page when the app is launched
       * from the home screen. `black-translucent` lets our background run
       * underneath it, which is why the shell already pads for
       * env(safe-area-inset-*).
       */
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'black-translucent',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: 'loife',
      },
      {
        name: 'mobile-web-app-capable',
        content: 'yes',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      /*
       * The svg is the one that gets used anywhere modern; the .ico is there
       * for Windows, old browsers and the crawlers that still ask for it by
       * name. iOS ignores both and wants its own png.
       */
      {
        rel: 'icon',
        href: '/favicon.svg',
        type: 'image/svg+xml',
      },
      {
        rel: 'icon',
        href: '/favicon.ico',
        sizes: '48x48',
      },
      {
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'manifest',
        href: '/manifest.webmanifest',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
