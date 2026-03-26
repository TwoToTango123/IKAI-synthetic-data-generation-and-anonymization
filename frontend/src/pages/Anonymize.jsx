import React, { useState } from 'react'
import FileUpload from '../components/FileUpload'
import { anonymizeData } from '../services/api'

const TEMPLATE_COLUMNS = {
  users: ['full_name', 'email', 'phone'],
  orders: [],
}

const DEFAULT_SELECTION = {
  users: ['full_name', 'email', 'phone'],
  orders: [],
}

function Anonymize() {
  const [template, setTemplate] = useState('users')
  const [selectedColumns, setSelectedColumns] = useState(DEFAULT_SELECTION.users)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const columns = TEMPLATE_COLUMNS[template] || []

  const handleTemplateChange = (event) => {
    const nextTemplate = event.target.value
    setTemplate(nextTemplate)
    setSelectedColumns(DEFAULT_SELECTION[nextTemplate] || [])
    setError('')
  }

  const toggleColumn = (column) => {
    setSelectedColumns((prev) => {
      if (prev.includes(column)) {
        return prev.filter((item) => item !== column)
      }
      return [...prev, column]
    })
  }

  const handleFileUpload = (uploadedFile) => {
    setFile(uploadedFile)
    setError('')
  }

  const handleAnonymize = async () => {
    if (!file) {
      setError('Пожалуйста, загрузите CSV файл')
      return
    }

    if (template !== 'users') {
      setError('Для шаблона orders анонимизация колонок пока не настроена')
      return
    }

    if (selectedColumns.length === 0) {
      setError('Выберите хотя бы одну колонку для анонимизации')
      return
    }

    setError('')
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const emailColumns = selectedColumns.filter((col) => col === 'email')
      const phoneColumns = selectedColumns.filter((col) => col === 'phone')
      const nameColumns = selectedColumns.filter((col) => col !== 'email' && col !== 'phone')

      if (emailColumns.length > 0) {
        formData.append('email_columns', emailColumns.join(','))
      }
      if (phoneColumns.length > 0) {
        formData.append('phone_columns', phoneColumns.join(','))
      }
      if (nameColumns.length > 0) {
        formData.append('name_columns', nameColumns.join(','))
      }

      const blob = await anonymizeData(formData)

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `anon_${file.name}`
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(link)
    } catch (err) {
      const message = err?.message || 'Не удалось обработать файл'
      setError(`Ошибка API: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1 className="section-title">Анонимизация данных</h1>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">!</span>
          <div>{error}</div>
        </div>
      )}

      {!file && <FileUpload onFileUpload={handleFileUpload} />}

      <div className="form-group">
        <label className="form-label">Шаблон для выбора колонок:</label>
        <select className="form-select" value={template} onChange={handleTemplateChange}>
          <option value="users">users</option>
          <option value="orders">orders</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Колонки для анонимизации:</label>
        {columns.length === 0 ? (
          <div className="alert alert-info">
            <span className="alert-icon">i</span>
            <div>Для шаблона orders список колонок пока не настроен</div>
          </div>
        ) : (
          <div className="checkbox-group">
            {columns.map((column) => (
              <div className="checkbox-item" key={column}>
                <input
                  id={`col-${column}`}
                  type="checkbox"
                  checked={selectedColumns.includes(column)}
                  onChange={() => toggleColumn(column)}
                />
                <label htmlFor={`col-${column}`}>{column}</label>
              </div>
            ))}
          </div>
        )}
      </div>

      {file && (
        <div className="file-info">
          <span>Файл: {file.name}</span>
          <button
            className="btn btn-secondary btn-small"
            onClick={() => setFile(null)}
          >
            Загрузить другой
          </button>
        </div>
      )}

      <button
        className="btn btn-success btn-large btn-block"
        onClick={handleAnonymize}
        disabled={!file || loading}
      >
        {loading ? 'Обрабатываю...' : 'Применить'}
      </button>
    </div>
  )
}

export default Anonymize
