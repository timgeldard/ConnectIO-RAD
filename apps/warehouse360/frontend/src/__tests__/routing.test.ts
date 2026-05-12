/* eslint-disable jsdoc/require-jsdoc */
import { describe, expect, it } from 'vitest'

import { moduleToRoute, routeToModule } from '~/routing'

describe('routing helpers', () => {
  describe('moduleToRoute', () => {
    it.each([
      ['home', 'today'],
      ['wh-cockpit', 'staging'],
      ['deliveries', 'outbound'],
      ['inbound', 'inbound'],
      ['inventory', 'inventory'],
      ['imwm', 'imwm'],
      ['dispensary', 'dispensary'],
      ['exceptions', 'exceptions'],
      ['performance', 'performance'],
    ])('maps moduleId %s to route %s', (moduleId, expected) => {
      expect(moduleToRoute(moduleId)).toBe(expected)
    })

    it('falls through to the moduleId itself when no mapping is registered', () => {
      // Pinning the contract: an unknown moduleId should not silently
      // fall back to a different page. The page-switch in App.tsx
      // expects this passthrough so legacy callers can hand a literal
      // route string straight through.
      expect(moduleToRoute('something-new')).toBe('something-new')
    })
  })

  describe('routeToModule', () => {
    it.each([
      ['today', 'home'],
      ['staging', 'wh-cockpit'],
      ['outbound', 'deliveries'],
      ['inbound', 'inbound'],
      ['inventory', 'inventory'],
      ['imwm', 'imwm'],
      ['dispensary', 'dispensary'],
      ['exceptions', 'exceptions'],
      ['performance', 'performance'],
    ])('maps route %s back to moduleId %s', (route, expected) => {
      expect(routeToModule(route)).toBe(expected)
    })

    it('maps the internal "docs" route back to home so the rail stays in sync', () => {
      expect(routeToModule('docs')).toBe('home')
    })

    it('falls back to home for any unknown route', () => {
      expect(routeToModule('totally-unknown')).toBe('home')
    })
  })

  describe('round-trip consistency', () => {
    // Adding a new module means appending to BOTH maps; this test pins
    // that contract for every module ID that has a forward mapping.
    it.each([
      'home', 'wh-cockpit', 'deliveries', 'inbound', 'inventory',
      'imwm', 'dispensary', 'exceptions', 'performance',
    ])('moduleId %s round-trips through moduleToRoute -> routeToModule', (moduleId) => {
      expect(routeToModule(moduleToRoute(moduleId))).toBe(moduleId)
    })
  })
})
