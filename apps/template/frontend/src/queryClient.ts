import { QueryClient } from '@tanstack/react-query'
import { queryClientDefaultOptions } from '@connectio/shared-frontend-api/query'

export const queryClient = new QueryClient({ defaultOptions: queryClientDefaultOptions })
