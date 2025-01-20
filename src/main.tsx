import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import * as App from './app'

import 'tldraw/tldraw.css'
import './index.css'


ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App.App />
    </React.StrictMode>,
)
