import React from 'react'

function Header({ activeTab, setActiveTab }) {
  return (
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
  )
}

export default Header
