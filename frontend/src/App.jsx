import React, { useState } from 'react'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('generate')

  return (
    <div className="app">
      <header>
        <div className="header-content">
          <div className="header-title">
            <span>DataGen Tool</span>
          </div>
          <nav className="nav-tabs">
            <button
              className={`nav-tab ${activeTab === 'generate' ? 'active' : ''}`}
              onClick={() => setActiveTab('generate')}
            >
              Генерация данных
            </button>
            <button
              className={`nav-tab ${activeTab === 'anonymize' ? 'active' : ''}`}
              onClick={() => setActiveTab('anonymize')}
            >
              Анонимизация данных
            </button>
          </nav>
        </div>
      </header>
      <main className="main-content">
        <div className="container">
          <h1 className="section-title">Frontend initialized</h1>
          <p>
            Активная вкладка: {activeTab === 'generate' ? 'Генерация данных' : 'Анонимизация данных'}
          </p>
        </div>
      </main>
    </div>
  )
}

export default App
