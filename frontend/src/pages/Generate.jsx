import React, { useState } from 'react'
import { generateData } from '../services/api'

function Generate() {
  const [template, setTemplate] = useState('users')
  const [rows, setRows] = useState(1000)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerateClick = async () => {
    setError('')
    setLoading(true)
    try {
      const payload = {
        template,
        rows: parseInt(rows, 10),
      }
      const blob = await generateData(payload)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${template}.csv`
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(link)
    } catch (err) {
      const message = err?.message || 'Не удалось сгенерировать данные'
      setError(`Ошибка API: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1 className="section-title">Генерация данных</h1>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">!</span>
          <div>{error}</div>
        </div>
      )}

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
        disabled={loading}
      >
        {loading ? 'Генерирую...' : 'Сгенерировать'}
      </button>
    </div>
  )
}

export default Generate
