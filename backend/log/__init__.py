import logging
import os
import sys
from pathlib import Path
from typing import Optional


def get_logger(
    name: Optional[str] = None,
    level: int = logging.INFO,
    log_file: Optional[str] = None,
    console_output: bool = True,
    file_output: bool = True
) -> logging.Logger:

    if os.getenv("LOG_CONSOLE") == "false":
        console_output = False
    if os.getenv("LOG_FILE") == "false":
        file_output = False
    if os.getenv("LOG_LEVEL") is not None:
        level = getattr(logging, os.getenv("LOG_LEVEL").upper(), level)
        
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
        
        file_handler = logging.FileHandler(log_file, encoding='utf-8', mode="a")
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger