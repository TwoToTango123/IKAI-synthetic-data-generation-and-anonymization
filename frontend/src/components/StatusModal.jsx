import React from 'react'

function StatusModal({ open, type = 'info', title, message, onClose }) {
  if (!open) {
    return null
  }

  return (
    <div className="status-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className={`status-modal status-modal-${type}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="status-modal-title"
        aria-describedby="status-modal-message"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="status-modal-header">
          <div className="status-modal-icon" aria-hidden="true">
            {type === 'success' ? '✓' : '!'}
          </div>
          <div className="status-modal-text">
            <h2 className="status-modal-title" id="status-modal-title">
              {title}
            </h2>
            <p className="status-modal-message" id="status-modal-message">
              {message}
            </p>
          </div>
        </div>

        <div className="status-modal-actions">
          <button type="button" className="status-modal-close" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}

export default StatusModal