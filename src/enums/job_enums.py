from enum import Enum

class JobStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class TaskType(str, Enum):
    # API TASKS
    API_FETCH = "api_fetch"
    API_POST = "api_post"
    DATA_TRANSFORM = "data_transform"
    WEBHOOK_TRIGGER = "webhook_trigger"

    # FILE TASKS
    FILE_SEARCH = "file_search"
    FILE_READ = "file_read"
    FILE_WRITE = "file_write"
    CSV_PROCESSING = "csv_processing"

    # OCR & MEDIA
    OCR = "ocr"
    IMAGE_RESIZE = "image_resize"
    IMAGE_COMPRESS = "image_compress"
    VIDEO_TO_AUDIO = "video_to_audio"

    # SCRAPING
    SCRAPE_WEBSITE = "scrape_website"
    SCRAPE_PRODUCT = "scrape_product"

    # AUTOMATION
    SEND_EMAIL = "send_email"
    SEND_SMS = "send_sms"
    RUN_COMMAND = "run_command"

    # ADVANCED
    CODE_EXECUTION = "code_execution"
    LOG_ANALYSIS = "log_analysis"
    BACKUP_DATABASE = "backup_database"