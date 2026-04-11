import React, { useState } from 'react'
import FileUpload from '../components/FileUpload'
import { anonymizeData, getCsvHeaders } from '../services/api'

const TEMPLATE_COLUMNS = {
  users: ['full_name', 'email', 'phone', 'city'],
  orders: ['user_id', 'date', 'amount'],
}

const DEFAULT_SELECTION = {
  users: ['full_name', 'email', 'phone', 'city'],
  orders: ['user_id', 'date', 'amount'],
}

const COLUMN_TYPES = {
  users: {
    full_name: 'name',
    email: 'email',
    phone: 'phone',
    city: 'city',
  },
  orders: {
    user_id: 'digits',
    date: 'date',
    amount: 'numeric',
  },
}

const ANONYMIZATION_METHODS = {
  MASKING: 'masking',
  PSEUDONYMIZATION: 'pseudonymization',
  REMOVE: 'remove',
}

function Anonymize() {
  const [template, setTemplate] = useState('users')
  const [selectedColumns, setSelectedColumns] = useState(DEFAULT_SELECTION.users)
  const [file, setFile] = useState(null)
  const [method, setMethod] = useState(ANONYMIZATION_METHODS.MASKING)
  const [removeMode, setRemoveMode] = useState('empty')
  const [pseudonymSalt, setPseudonymSalt] = useState('')
  const [csvHeaders, setCsvHeaders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const columns = TEMPLATE_COLUMNS[template] || []

  const handleTemplateChange = (event) => {
    const nextTemplate = event.target.value
    setTemplate(nextTemplate)
    setSelectedColumns(DEFAULT_SELECTION[nextTemplate] || [])
    setError('')
  }

  const handleMethodChange = (event) => {
    const nextMethod = event.target.value
    setMethod(nextMethod)
    if (nextMethod === ANONYMIZATION_METHODS.MASKING) {
      setSelectedColumns(DEFAULT_SELECTION[template] || [])
    } else if (csvHeaders.length > 0) {
      setSelectedColumns(csvHeaders)
    } else {
      setSelectedColumns([])
    }
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

  const handleFileUpload = async (uploadedFile) => {
    setFile(uploadedFile)
    setError('')

    try {
      const headers = await getCsvHeaders(uploadedFile)
      setCsvHeaders(headers)
      if (method !== ANONYMIZATION_METHODS.MASKING) {
        setSelectedColumns(headers)
      }
    } catch (err) {
      setCsvHeaders([])
      const message = err?.message || 'Не удалось прочитать заголовки CSV'
      setError(`Ошибка API: ${message}`)
    }
  }

  const handleAnonymize = async () => {
    if (!file) {
      setError('Пожалуйста, загрузите CSV файл')
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
      formData.append('method', method)

      if (method === ANONYMIZATION_METHODS.MASKING) {
        const columnTypes = COLUMN_TYPES[template] || {}
        const emailColumns = selectedColumns.filter((col) => columnTypes[col] === 'email')
        const phoneColumns = selectedColumns.filter((col) => columnTypes[col] === 'phone')
        const nameColumns = selectedColumns.filter((col) => columnTypes[col] === 'name')
        const cityColumns = selectedColumns.filter((col) => columnTypes[col] === 'city')
        const digitsColumns = selectedColumns.filter((col) => columnTypes[col] === 'digits')
        const dateColumns = selectedColumns.filter((col) => columnTypes[col] === 'date')
        const numericColumns = selectedColumns.filter((col) => columnTypes[col] === 'numeric')

        if (emailColumns.length > 0) {
          formData.append('email_columns', emailColumns.join(','))
        }
        if (phoneColumns.length > 0) {
          formData.append('phone_columns', phoneColumns.join(','))
        }
        if (nameColumns.length > 0) {
          formData.append('name_columns', nameColumns.join(','))
        }
        if (cityColumns.length > 0) {
          formData.append('city_columns', cityColumns.join(','))
        }
        if (digitsColumns.length > 0) {
          formData.append('digits_columns', digitsColumns.join(','))
        }
        if (dateColumns.length > 0) {
          formData.append('date_columns', dateColumns.join(','))
        }
        if (numericColumns.length > 0) {
          formData.append('numeric_columns', numericColumns.join(','))
        }
      } else {
        formData.append('target_columns', selectedColumns.join(','))
        if (method === ANONYMIZATION_METHODS.PSEUDONYMIZATION && pseudonymSalt.trim()) {
          formData.append('pseudonym_salt', pseudonymSalt.trim())
        }
        if (method === ANONYMIZATION_METHODS.REMOVE) {
          formData.append('remove_mode', removeMode)
        }
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
        <label className="form-label">Способ анонимизации:</label>
        <select className="form-select" value={method} onChange={handleMethodChange}>
          <option value={ANONYMIZATION_METHODS.MASKING}>Маскирование</option>
          <option value={ANONYMIZATION_METHODS.PSEUDONYMIZATION}>Псевдонимизация</option>
          <option value={ANONYMIZATION_METHODS.REMOVE}>Удаление/замена на пустое</option>
        </select>
        <div className="alert alert-info" style={{ marginTop: '0.75rem' }}>
          <span className="alert-icon">i</span>
          <div>
            {method === ANONYMIZATION_METHODS.MASKING && 'Маскирование: частично скрывает значения по типу колонки (email/телефон/дата и т.д.).'}
            {method === ANONYMIZATION_METHODS.PSEUDONYMIZATION && 'Псевдонимизация: заменяет исходные значения на стабильные псевдонимы (одинаковые значения -> одинаковый псевдоним).'}
            {method === ANONYMIZATION_METHODS.REMOVE && 'Удаление/замена на пустое: выберите отдельные колонки из файла, затем очистите их значения или удалите полностью.'}
          </div>
        </div>
      </div>

      {method === ANONYMIZATION_METHODS.PSEUDONYMIZATION && (
        <div className="form-group">
          <label className="form-label">Секретный ключ для псевдонимизации (необязательно):</label>
          <input
            type="text"
            className="form-input"
            value={pseudonymSalt}
            onChange={(e) => setPseudonymSalt(e.target.value)}
            placeholder="Например: project-2026-secret"
          />
          <div className="form-help" style={{ marginTop: '0.5rem' }}>
            Один и тот же ключ дает одинаковые псевдонимы для одинаковых значений. Можно оставить пустым.
          </div>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Шаблон для выбора колонок:</label>
        <select
          className="form-select"
          value={template}
          onChange={handleTemplateChange}
          disabled={method !== ANONYMIZATION_METHODS.MASKING}
        >
          <option value="users">users</option>
          <option value="orders">orders</option>
        </select>
      </div>

      {method === ANONYMIZATION_METHODS.MASKING && (
        <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
          <span className="alert-icon">i</span>
          <div>
            <div><strong>Требования к CSV для маскирования:</strong></div>
            <div>1. Первая строка должна содержать заголовки колонок.</div>
            <div>2. Названия колонок должны точно совпадать с шаблоном.</div>
            <div>3. Файл должен быть в формате CSV (UTF-8 или Windows-1251).</div>
            {template === 'users' ? (
              <>
                <div>Ожидаемые колонки users: full_name, email, phone, city.</div>
                <div>Формат данных: email вида name@domain, phone строка с цифрами и/или символами.</div>
              </>
            ) : (
              <>
                <div>Ожидаемые колонки orders: order_id, user_id, date, amount, status.</div>
                <div>Формат данных: date желательно YYYY-MM-DD, amount числовое значение.</div>
              </>
            )}
          </div>
        </div>
      )}

      {method === ANONYMIZATION_METHODS.REMOVE && (
        <div className="form-group">
          <label className="form-label">Что делать с выбранными колонками:</label>
          <select className="form-select" value={removeMode} onChange={(e) => setRemoveMode(e.target.value)}>
            <option value="empty">Оставить колонку, но очистить значения</option>
            <option value="drop">Удалить колонку полностью</option>
          </select>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Колонки для анонимизации:</label>
        {method !== ANONYMIZATION_METHODS.MASKING && !file ? (
          <div className="alert alert-info">
            <span className="alert-icon">i</span>
            <div>Загрузите CSV, чтобы увидеть список колонок файла</div>
          </div>
        ) : method !== ANONYMIZATION_METHODS.MASKING && csvHeaders.length === 0 ? (
          <div className="alert alert-info">
            <span className="alert-icon">i</span>
            <div>Не удалось прочитать заголовок CSV</div>
          </div>
        ) : (method === ANONYMIZATION_METHODS.MASKING ? columns : csvHeaders).length === 0 ? (
          <div className="alert alert-info">
            <span className="alert-icon">i</span>
            <div>Нет колонок для анонимизации в этом шаблоне</div>
          </div>
        ) : (
          <div className="checkbox-group">
            {(method === ANONYMIZATION_METHODS.MASKING ? columns : csvHeaders).map((column) => (
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
