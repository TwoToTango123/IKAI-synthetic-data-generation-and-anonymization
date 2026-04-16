import React from 'react'
import Box from './Box'

function Header({ activeTab, setActiveTab, isHome }) {
  return (
    <header className={isHome ? 'header-home' : ''}>
      <div className="header-content">
        <div 
          className="header-title"
          onClick={() => setActiveTab('home')}
          style={{ cursor: 'pointer' }}
        >
          <span className="header-logo" aria-hidden="true">
            <Box />
          </span>
          <span>DataGen Tool</span>
        </div>
        {!isHome && (
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
        )}
      </div>
    </header>
  )
}

export default Header
