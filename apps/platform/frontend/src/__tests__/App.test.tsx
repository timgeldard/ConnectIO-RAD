/* eslint-disable jsdoc/require-jsdoc */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from '../App'

vi.mock('../shell/useShellState', () => ({
  useShellState: () => [{ activeModuleId: 'home', tabState: {}, ctxState: null }, { onModuleChange: vi.fn(), onTabChange: vi.fn(), onClearContext: vi.fn() }]
}))

vi.mock('../shell/usePlatformSession', () => ({
  usePlatformSession: () => ({ groups: [], name: 'Test User' })
}))

vi.mock('../shell/usePlatformRegistry', () => ({
  usePlatformRegistry: () => ({ modules: [{ moduleId: 'home', isUserSelectable: true, isMandatory: false } as any] })
}))

vi.mock('../shell/usePinnedModules', () => ({
  usePinnedModules: () => [[], vi.fn()]
}))

vi.mock('../shell/useBadgeCounts', () => ({
  useBadgeCounts: () => ({})
}))

vi.mock('@connectio/shared-ui/shell', () => ({
  PlatformShell: ({ children }: any) => <div data-testid="platform-shell">{children}</div>,
  parseCrossAppContext: () => null
}))

vi.mock('../shell/ModuleContentPanel', () => ({
  ModuleContentPanel: () => <div data-testid="module-content">Module Content</div>
}))

vi.mock('../genie/GenieDrawer', () => ({
  GenieDrawer: () => <div data-testid="genie-drawer">Genie Drawer</div>
}))

describe('App', () => {
  it('renders platform shell and content', () => {
    render(<App />)
    expect(screen.getByTestId('platform-shell')).toBeDefined()
    expect(screen.getByTestId('module-content')).toBeDefined()
    expect(screen.getByTestId('genie-drawer')).toBeDefined()
  })
})
