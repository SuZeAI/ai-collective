import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional

from backend.api.settings import settings

# Rotation defaults (overridable via config.yml › logging / .env).
_LOG_MAX_BYTES = settings.logging.log_max_bytes
_LOG_BACKUP_COUNT = settings.logging.log_backup_count
_VALID_LEVELS = {"CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG", "NOTSET"}


def get_logger(
    name: Optional[str] = None,
    level: int = logging.INFO,
    log_file: Optional[str] = None,
    console_output: bool = True,
    file_output: bool = True
) -> logging.Logger:

    if not settings.logging.log_console:
        console_output = False
    if not settings.logging.log_file:
        file_output = False
    candidate = (settings.logging.log_level or "").strip().upper()
    # Only accept real level names; ignore typos instead of resolving to a
    # random logging attribute via getattr.
    if candidate in _VALID_LEVELS:
        level = getattr(logging, candidate)

    if name is None:
        name = "ai_collective"
    
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    if logger.handlers:
        return logger
    
    formatter = logging.Formatter(
        fmt='%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    if console_output:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(level)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
    
    if file_output:
        if log_file is None:
            log_dir = Path(__file__).parent.parent.parent / "logs"
            log_dir.mkdir(exist_ok=True)
            log_file = log_dir / "ai_collective.log"
        
        file_handler = RotatingFileHandler(
            log_file,
            encoding='utf-8',
            maxBytes=_LOG_MAX_BYTES,
            backupCount=_LOG_BACKUP_COUNT,
        )
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger