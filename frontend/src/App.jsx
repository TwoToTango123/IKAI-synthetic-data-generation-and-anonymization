import React, { useState } from 'react'
import './App.css'
import Header from './components/Header'
import Generate from './pages/Generate'
import Anonymize from './pages/Anonymize'

function App() {
  const [activeTab, setActiveTab] = useState('generate')

  return (
    <div className="app">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">
        {activeTab === 'generate' && <Generate />}
        {activeTab === 'anonymize' && <Anonymize />}
      </main>
    </div>
  )
}

export default App
