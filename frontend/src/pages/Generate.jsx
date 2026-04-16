import React, { useState } from 'react'
import { generateData } from '../services/api'
import { parseCsvPreview } from '../utils/csvPreview'

const ALLOWED_DOMAINS = ['gmail.com', 'rambler.ru', 'mail.ru', 'yandex.ru', 'microsoft.com']
const ORDER_STATUS_OPTIONS = ['new', 'paid', 'processing', 'completed', 'cancelled']
const COUNTRY_CODE_OPTIONS = [
  { value: '1', label: '+1 (US/CA)' },
  { value: '7', label: '+7 (RU/KZ)' },
  { value: '20', label: '+20 (EG)' },
  { value: '27', label: '+27 (ZA)' },
  { value: '30', label: '+30 (GR)' },
  { value: '33', label: '+33 (FR)' },
  { value: '34', label: '+34 (ES)' },
  { value: '39', label: '+39 (IT)' },
  { value: '44', label: '+44 (UK)' },
  { value: '49', label: '+49 (DE)' },
  { value: '52', label: '+52 (MX)' },
  { value: '54', label: '+54 (AR)' },
  { value: '55', label: '+55 (BR)' },
  { value: '61', label: '+61 (AU)' },
  { value: '62', label: '+62 (ID)' },
  { value: '63', label: '+63 (PH)' },
  { value: '64', label: '+64 (NZ)' },
  { value: '65', label: '+65 (SG)' },
  { value: '66', label: '+66 (TH)' },
  { value: '82', label: '+82 (KR)' },
  { value: '81', label: '+81 (JP)' },
  { value: '86', label: '+86 (CN)' },
  { value: '90', label: '+90 (TR)' },
  { value: '91', label: '+91 (IN)' },
  { value: '92', label: '+92 (PK)' },
  { value: '98', label: '+98 (IR)' },
  { value: '212', label: '+212 (MA)' },
  { value: '234', label: '+234 (NG)' },
  { value: '351', label: '+351 (PT)' },
  { value: '358', label: '+358 (FI)' },
  { value: '380', label: '+380 (UA)' },
  { value: '420', label: '+420 (CZ)' },
  { value: '972', label: '+972 (IL)' },
  { value: '971', label: '+971 (AE)' },
]

const PREVIEW_ROW_LIMIT = 5

function Generate() {
  const [template, setTemplate] = useState('users')
  const [rows, setRows] = useState(1000)
  const [selectedDomains, setSelectedDomains] = useState(ALLOWED_DOMAINS)
  const [registrationMode, setRegistrationMode] = useState('any')
  const [registeredFrom, setRegisteredFrom] = useState('')
  const [registeredTo, setRegisteredTo] = useState('')
  const [selectedCountryCodes, setSelectedCountryCodes] = useState(['7'])
  const [phonePrefix, setPhonePrefix] = useState('')
  const [orderDateMode, setOrderDateMode] = useState('any')
  const [orderDateFrom, setOrderDateFrom] = useState('')
  const [orderDateTo, setOrderDateTo] = useState('')
  const [amountMode, setAmountMode] = useState('any')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState(ORDER_STATUS_OPTIONS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)

  const toggleDomain = (domain) => {
    setSelectedDomains((prev) => {
      if (prev.includes(domain)) {
        return prev.filter((item) => item !== domain)
      }
      return [...prev, domain]
    })
  }

  const toggleCountryCode = (code) => {
    setSelectedCountryCodes((prev) => {
      if (prev.includes(code)) {
        return prev.filter((item) => item !== code)
      }
      return [...prev, code]
    })
  }

  const selectAllCountryCodes = () => {
    setSelectedCountryCodes(COUNTRY_CODE_OPTIONS.map((option) => option.value))
  }

  const clearAllCountryCodes = () => {
    setSelectedCountryCodes([])
  }

  const toggleStatus = (status) => {
    setSelectedStatuses((prev) => {
      if (prev.includes(status)) {
        return prev.filter((item) => item !== status)
      }
      return [...prev, status]
    })
  }

  const handleGenerateClick = async () => {
    if (template === 'users') {
      if (selectedDomains.length === 0) {
        setError('Выберите хотя бы один домен электронной почты')
        return
      }
      if (phonePrefix && !/^\d{1,3}$/.test(phonePrefix)) {
        setError('Префикс телефона должен содержать от 1 до 3 цифр')
        return
      }
      if (selectedCountryCodes.length === 0) {
        setError('Выберите хотя бы один код страны')
        return
      }
      if (registrationMode === 'range' && (!registeredFrom || !registeredTo)) {
        setError('Выберите обе даты: с и по')
        return
      }
      if (registrationMode === 'range' && registeredFrom > registeredTo) {
        setError('Дата "с" не может быть больше даты "по"')
        return
      }
    }

    if (template === 'orders') {
      if (selectedStatuses.length === 0) {
        setError('Выберите хотя бы один статус')
        return
      }
      if (orderDateMode === 'range' && (!orderDateFrom || !orderDateTo)) {
        setError('Выберите обе даты заказа: с и по')
        return
      }
      if (orderDateMode === 'range' && orderDateFrom > orderDateTo) {
        setError('Дата заказа "с" не может быть больше даты "по"')
        return
      }
      if (amountMode === 'range' && (amountMin === '' || amountMax === '')) {
        setError('Укажите минимальную и максимальную сумму')
        return
      }
      if (amountMode === 'range') {
        const min = Number(amountMin)
        const max = Number(amountMax)
        if (Number.isNaN(min) || Number.isNaN(max)) {
          setError('Диапазон суммы должен содержать числа')
          return
        }
        if (min < 0) {
          setError('Минимальная сумма не может быть отрицательной')
          return
        }
        if (max <= 0) {
          setError('Максимальная сумма должна быть больше 0')
          return
        }
        if (min > max) {
          setError('Минимальная сумма не может быть больше максимальной')
          return
        }
      }
    }

    setError('')
    setLoading(true)
    try {
      const blob = await generateData({
        template,
        rows: parseInt(rows, 10),
        countryCodes: template === 'users' ? selectedCountryCodes.join(',') : undefined,
        phonePrefix: template === 'users' && phonePrefix ? phonePrefix : undefined,
        emailDomains: template === 'users' ? selectedDomains.join(',') : undefined,
        registeredFrom: template === 'users' && registrationMode === 'range' ? registeredFrom : undefined,
        registeredTo: template === 'users' && registrationMode === 'range' ? registeredTo : undefined,
        orderDateFrom: template === 'orders' && orderDateMode === 'range' ? orderDateFrom : undefined,
        orderDateTo: template === 'orders' && orderDateMode === 'range' ? orderDateTo : undefined,
        amountMin: template === 'orders' && amountMode === 'range' ? amountMin : undefined,
        amountMax: template === 'orders' && amountMode === 'range' ? amountMax : undefined,
        statuses: template === 'orders' ? selectedStatuses.join(',') : undefined,
      })

      const previewText = await blob.text()
      const parsedPreview = parseCsvPreview(previewText, PREVIEW_ROW_LIMIT)
      setPreview({
        fileName: `${template}.csv`,
        headers: parsedPreview.headers,
        rows: parsedPreview.rows,
      })

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
        <label className="form-label">Шаблон:</label>
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

      {template === 'users' && (
        <>
          <div className="form-group">
            <label className="form-label">Домены email:</label>
            <div className="checkbox-group">
              {ALLOWED_DOMAINS.map((domain) => (
                <div className="checkbox-item" key={domain}>
                  <input
                    id={`domain-${domain}`}
                    type="checkbox"
                    checked={selectedDomains.includes(domain)}
                    onChange={() => toggleDomain(domain)}
                  />
                  <label htmlFor={`domain-${domain}`}>{domain}</label>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Коды страны:</label>
            <div className="button-group" style={{ marginBottom: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={selectAllCountryCodes}
              >
                Выбрать все
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={clearAllCountryCodes}
              >
                Снять все
              </button>
            </div>
            <div className="checkbox-group">
              {COUNTRY_CODE_OPTIONS.map((option) => (
                <div className="checkbox-item" key={option.value}>
                  <input
                    id={`country-${option.value}`}
                    type="checkbox"
                    checked={selectedCountryCodes.includes(option.value)}
                    onChange={() => toggleCountryCode(option.value)}
                  />
                  <label htmlFor={`country-${option.value}`}>{option.label}</label>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Префикс телефона (1-3 цифры после выбранного кода страны, необязательно):</label>
            <input
              type="text"
              className="form-input"
              value={phonePrefix}
              onChange={(e) => setPhonePrefix(e.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder="Например: 916 (или оставьте пустым)"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Дата регистрации:</label>
            <div className="radio-group">
              <div className="radio-item">
                <input
                  id="reg-any"
                  type="radio"
                  name="reg-mode"
                  checked={registrationMode === 'any'}
                  onChange={() => setRegistrationMode('any')}
                />
                <label htmlFor="reg-any">Любая</label>
              </div>
              <div className="radio-item">
                <input
                  id="reg-range"
                  type="radio"
                  name="reg-mode"
                  checked={registrationMode === 'range'}
                  onChange={() => setRegistrationMode('range')}
                />
                <label htmlFor="reg-range">Диапазон (с даты по дату)</label>
              </div>
            </div>
            {registrationMode === 'range' && (
              <div className="grid grid-2" style={{ marginTop: '0.75rem' }}>
                <div>
                  <label className="form-label">С даты:</label>
                  <input
                    type="date"
                    className="form-input"
                    value={registeredFrom}
                    onChange={(e) => setRegisteredFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">По дату:</label>
                  <input
                    type="date"
                    className="form-input"
                    value={registeredTo}
                    onChange={(e) => setRegisteredTo(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {template === 'orders' && (
        <>
          <div className="form-group">
            <label className="form-label">Дата заказа:</label>
            <div className="radio-group">
              <div className="radio-item">
                <input
                  id="order-date-any"
                  type="radio"
                  name="order-date-mode"
                  checked={orderDateMode === 'any'}
                  onChange={() => setOrderDateMode('any')}
                />
                <label htmlFor="order-date-any">Любая</label>
              </div>
              <div className="radio-item">
                <input
                  id="order-date-range"
                  type="radio"
                  name="order-date-mode"
                  checked={orderDateMode === 'range'}
                  onChange={() => setOrderDateMode('range')}
                />
                <label htmlFor="order-date-range">Диапазон (с даты по дату)</label>
              </div>
            </div>
            {orderDateMode === 'range' && (
              <div className="grid grid-2" style={{ marginTop: '0.75rem' }}>
                <div>
                  <label className="form-label">С даты:</label>
                  <input
                    type="date"
                    className="form-input"
                    value={orderDateFrom}
                    onChange={(e) => setOrderDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">По дату:</label>
                  <input
                    type="date"
                    className="form-input"
                    value={orderDateTo}
                    onChange={(e) => setOrderDateTo(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Сумма:</label>
            <div className="radio-group">
              <div className="radio-item">
                <input
                  id="amount-any"
                  type="radio"
                  name="amount-mode"
                  checked={amountMode === 'any'}
                  onChange={() => setAmountMode('any')}
                />
                <label htmlFor="amount-any">Любая</label>
              </div>
              <div className="radio-item">
                <input
                  id="amount-range"
                  type="radio"
                  name="amount-mode"
                  checked={amountMode === 'range'}
                  onChange={() => setAmountMode('range')}
                />
                <label htmlFor="amount-range">Диапазон</label>
              </div>
            </div>
            {amountMode === 'range' && (
              <div className="grid grid-2" style={{ marginTop: '0.75rem' }}>
                <div>
                  <label className="form-label">Минимум:</label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    step="0.01"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Максимум:</label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    step="0.01"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Статусы:</label>
            <div className="checkbox-group">
              {ORDER_STATUS_OPTIONS.map((status) => (
                <div className="checkbox-item" key={status}>
                  <input
                    id={`status-${status}`}
                    type="checkbox"
                    checked={selectedStatuses.includes(status)}
                    onChange={() => toggleStatus(status)}
                  />
                  <label htmlFor={`status-${status}`}>{status}</label>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <button
        className="btn btn-success btn-large btn-block"
        onClick={handleGenerateClick}
        disabled={loading}
      >
        {loading ? 'Генерирую...' : 'Сгенерировать'}
      </button>

      {preview && (
        <section className="preview-section">
          <div className="card">
            <div className="card-title">Предпросмотр результата</div>
            <div className="preview-meta">
              Файл {preview.fileName}. Показаны первые {preview.rows.length} строк.
            </div>

            {preview.headers.length > 0 && preview.rows.length > 0 ? (
              <div className="table-preview preview-table">
                <table>
                  <thead>
                    <tr>
                      {preview.headers.map((header) => (
                        <th key={header}>{header || '—'}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, rowIndex) => (
                      <tr key={`${preview.fileName}-${rowIndex}`}>
                        {preview.headers.map((_, cellIndex) => (
                          <td key={`${preview.fileName}-${rowIndex}-${cellIndex}`}>
                            {row[cellIndex] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="preview-empty">Не удалось разобрать CSV для предпросмотра.</div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

export default Generate
