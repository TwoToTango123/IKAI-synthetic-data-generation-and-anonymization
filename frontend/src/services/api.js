import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

const extractErrorMessage = async (error, fallbackMessage) => {
  const data = error?.response?.data

  if (data instanceof Blob) {
    try {
      const text = await data.text()
      const json = JSON.parse(text)
      return json?.detail || fallbackMessage
    } catch {
      return fallbackMessage
    }
  }

  if (typeof data === 'object' && data !== null) {
    return data.detail || data.message || fallbackMessage
  }

  if (typeof data === 'string' && data.trim()) {
    return data
  }

  return error?.message || fallbackMessage
}

// Генерация данных
export const generateData = async ({ rows, template = 'users', countryCodes, phonePrefix, emailDomains, registeredFrom, registeredTo }) => {
  try {
    const response = await api.get('/generate', {
      params: {
        rows,
        template,
        country_codes: countryCodes,
        phone_prefix: phonePrefix,
        email_domains: emailDomains,
        registered_from: registeredFrom,
        registered_to: registeredTo,
      },
      responseType: 'blob',
    })
    return response.data
  } catch (error) {
    throw new Error(await extractErrorMessage(error, 'Не удалось сгенерировать данные'))
  }
}

// Анонимизация данных
export const anonymizeData = async (formData) => {
  try {
    const response = await api.post('/anonymize', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      responseType: 'blob',
    })
    return response.data
  } catch (error) {
    throw new Error(await extractErrorMessage(error, 'Не удалось анонимизировать данные'))
  }
}

export default api
