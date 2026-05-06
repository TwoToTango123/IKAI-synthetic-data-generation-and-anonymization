import React, { useState } from 'react'
import './App.css'
import Frame from './pages/Home'
import Generate from './pages/Generate'
import Anonymize from './pages/Anonymize'

function App() {
  const [activeTab, setActiveTab] = useState('home')

  return (
    <div className="app">
      <main className="main-content">
        {activeTab === 'home' && <Frame setActiveTab={setActiveTab} />}
        {activeTab === 'generate' && <Generate setActiveTab={setActiveTab} />}
        {activeTab === 'anonymize' && <Anonymize setActiveTab={setActiveTab} />}
      </main>
    </div>
  )
}

export default App
