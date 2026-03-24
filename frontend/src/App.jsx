import React, { useState } from 'react'
import './App.css'
import Header from './components/Header'
import Generate from './pages/Generate'

function App() {
  const [activeTab, setActiveTab] = useState('generate')

  return (
    <div className="app">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">
        {activeTab === 'generate' && <Generate />}
        {activeTab === 'anonymize' && (
          <div className="container">
            <h1 className="section-title">Анонимизация данных</h1>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
