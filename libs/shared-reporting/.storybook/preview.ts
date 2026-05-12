import React from 'react'
import type { Preview } from '@storybook/react'
import '../../../libs/shared-ui/src/styles/kerry-tokens.css'
import '../../../libs/shared-ui/src/styles/kerry-app.css'

const preview: Preview = {
  decorators: [
    (Story) =>
      React.createElement('div', { style: { padding: 24, background: 'var(--surface-0, #fff)' } },
        React.createElement(Story)
      ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
}

export default preview
