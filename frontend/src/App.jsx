import React, { useState } from 'react'
import './App.css'
import Header from './components/Header'
import Frame from './pages/Home'
import Generate from './pages/Generate'
import Anonymize from './pages/Anonymize'

function App() {
  const [activeTab, setActiveTab] = useState('home')

  return (
    <div className="app">
      {activeTab !== 'home' && <Header activeTab={activeTab} setActiveTab={setActiveTab} isHome={false} />}
      <main className="main-content">
        {activeTab === 'home' && <Frame setActiveTab={setActiveTab} />}
        {activeTab === 'generate' && <Generate />}
        {activeTab === 'anonymize' && <Anonymize />}
      </main>
    </div>
  )
}

export default App
