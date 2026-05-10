import { setupServer } from 'msw/node'
import { spcHandlers } from './spcHandlers'

/** MSW Node server pre-wired with all SPC endpoint fixtures. */
export const mswServer = setupServer(...spcHandlers)
