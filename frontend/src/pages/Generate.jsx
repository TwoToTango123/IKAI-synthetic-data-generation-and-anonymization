import React, { useState } from 'react'

function Generate() {
  const [template, setTemplate] = useState('users')
  const [rows, setRows] = useState(1000)

  const handleGenerateClick = () => {
    console.log('Generate clicked:', { template, rows: parseInt(rows, 10) })
  }

  return (
    <div className="container">
      <h1 className="section-title">Генерация данных</h1>

      <div className="form-group">
        <label className="form-label">Выберите шаблон:</label>
        <select
          className="form-select"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
        >
          <option value="users">Пользователи (users.csv)</option>
          <option value="orders">Заказы (orders.csv)</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Количество строк:</label>
        <input
          type="number"
          className="form-input"
          value={rows}
          onChange={(e) => setRows(e.target.value)}
          min="1"
          max="1000000"
        />
      </div>

      <button
        className="btn btn-success btn-large btn-block"
        onClick={handleGenerateClick}
      >
        Сгенерировать
      </button>
    </div>
  )
}

export default Generate
