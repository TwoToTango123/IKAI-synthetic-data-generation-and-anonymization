import React from 'react'
import '../styles/Home.css'
import Box from '../components/Box'

export const Frame = ({ setActiveTab }) => {
  return (
    <div className="frame">
      <div className="rectangle" />
      <p
        className="datagen-tool"
        onClick={() => setActiveTab('home')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            setActiveTab('home')
          }
        }}
        role="button"
        tabIndex={0}
      >
        <span className="text-wrapper">DataGen</span>
        <span className="span">&nbsp;</span>
        <span className="text-wrapper-2">Tool</span>
      </p>
      <button className="div" onClick={() => setActiveTab('generate')}>
        Генерация
      </button>
      <button className="text-wrapper-3" onClick={() => setActiveTab('anonymize')}>
        Анонимизация
      </button>
      <div
        className="brand-icon"
        onClick={() => setActiveTab('home')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            setActiveTab('home')
          }
        }}
        role="button"
        tabIndex={0}
      >
        <Box />
      </div>

      <div className="text-wrapper-4">Генерация и анонимизация CSV-данных</div>
      <p className="p">
        Платформа помогает быстро создавать синтетические CSV-файлы и безопасно
        обрабатывать существующие данные.
      </p>

      <button className="rectangle-2" onClick={() => setActiveTab('generate')}>
      </button>

      <div className="text-wrapper-5">Начать генерацию</div>

      <button className="rectangle-3" onClick={() => setActiveTab('anonymize')}>
      </button>

      <div className="text-wrapper-6">Анонимизировать</div>

      <div className="text-wrapper-7">® IKAI 2026</div>

      <div className="rectangle-4" />
      <div className="rectangle-5" />
      <div className="rectangle-6" />
    </div>
  )
};

export default Frame
