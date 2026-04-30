import logging
import logging.config
import os
from logging.handlers import RotatingFileHandler


def configure_logging():
    """Configure logging for the application.

    Logs are emitted to stdout (console) and to a rotating file. In container
    environments prefer reading stdout/stderr; file logging is optional and
    controlled by the `LOG_FILE` env var.
    """
    log_file = os.getenv("LOG_FILE", "/tmp/ikai_app.log")
    log_dir = os.path.dirname(log_file)
    try:
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir, exist_ok=True)
    except Exception:
        # best-effort: if we cannot create the dir, proceed without file logging
        log_file = None

    formatter_standard = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"

    handlers = {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
            "level": "INFO",
            "stream": "ext://sys.stdout",
        }
    }

    if log_file:
        handlers["file"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "formatter": "standard",
            "level": "INFO",
            "filename": log_file,
            "maxBytes": 10 * 1024 * 1024,
            "backupCount": 5,
            "encoding": "utf-8",
        }

    config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "standard": {"format": formatter_standard},
        },
        "handlers": handlers,
        "root": {"handlers": list(handlers.keys()), "level": "INFO"},
        "loggers": {
            "uvicorn": {"level": "INFO", "handlers": list(handlers.keys()), "propagate": False},
            "uvicorn.error": {"level": "INFO", "handlers": list(handlers.keys()), "propagate": False},
            "uvicorn.access": {"level": "INFO", "handlers": list(handlers.keys()), "propagate": False},
        },
    }

    try:
        logging.config.dictConfig(config)
    except Exception:
        # fallback to basicConfig
        logging.basicConfig(level=logging.INFO)
