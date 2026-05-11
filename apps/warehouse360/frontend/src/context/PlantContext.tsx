/* eslint-disable jsdoc/require-jsdoc */
import React from 'react'
import { PlantProvider as SharedPlantProvider, usePlantSelection as useSharedPlantSelection } from '@connectio/shared-app-context'
import type { Plant } from '@connectio/shared-app-context'
import { resolveWarehouseApiPath } from '~/api/apiBase'

export type { Plant }

/** Provides plant list, selection state, and setter to the component tree. 
 * Re-exports from @connectio/shared-app-context but specialized for Warehouse360.
 */
export const PlantProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <SharedPlantProvider 
      appName="warehouse360" 
      apiEndpoint={resolveWarehouseApiPath('/api/plants')}
    >
      {children}
    </SharedPlantProvider>
  )
}

/** Hook to access the plant selection context. */
export const usePlantSelection = useSharedPlantSelection
