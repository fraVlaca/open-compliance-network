import './index.css'
import '@xyflow/react/dist/style.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PresentationApp from './PresentationApp'

// Force dark mode for presentation
document.documentElement.classList.add('dark')

const params = new URLSearchParams(window.location.search)
const autoPlay = params.get('autoplay') === 'true'
const embed = params.get('embed') === 'true'
const hideHeader = embed || params.get('hideHeader') === 'true'
const hidePlaybackBar = embed || params.get('hidePlaybackBar') === 'true'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PresentationApp autoPlay={autoPlay} hideHeader={hideHeader} hidePlaybackBar={hidePlaybackBar} />
  </StrictMode>,
)
