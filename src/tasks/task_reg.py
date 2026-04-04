from src.tasks.all_tasks.api_fetch_task import ApiFetchTask
from src.tasks.all_tasks.api_post_task import ApiPostTask
from src.tasks.all_tasks.backup_database_task import BackupDatabaseTask
from src.tasks.all_tasks.code_execution_task import CodeExecutionTask
from src.tasks.all_tasks.csv_processing_task import CsvProcessingTask
from src.tasks.all_tasks.data_transform_task import DataTransformTask
from src.tasks.all_tasks.file_read_task import FileReadTask
from src.tasks.all_tasks.file_search_task import FileSearchTask
from src.tasks.all_tasks.file_write_task import FileWriteTask
from src.tasks.all_tasks.image_compress_task import ImageCompressTask
from src.tasks.all_tasks.image_resize_task import ImageResizeTask
from src.tasks.all_tasks.log_analysis_task import LogAnalysisTask
from src.tasks.all_tasks.ocr_task import OcrTask
from src.tasks.all_tasks.run_command_task import RunCommandTask
from src.tasks.all_tasks.scrape_product_task import ScrapeProductTask
from src.tasks.all_tasks.scrape_website_task import ScrapeWebsiteTask
from src.tasks.all_tasks.send_email_task import SendEmailTask
from src.tasks.all_tasks.send_sms_task import SendSmsTask
from src.tasks.all_tasks.video_to_audio_task import VideoToAudioTask
from src.tasks.all_tasks.webhook_trigger_task import WebhookTriggerTask

from src.enums.job_enums import TaskType


TASK_REGISTRY = {
    TaskType.API_FETCH: ApiFetchTask,
    TaskType.API_POST: ApiPostTask,
    TaskType.DATA_TRANSFORM: DataTransformTask,
    TaskType.WEBHOOK_TRIGGER: WebhookTriggerTask,
    TaskType.FILE_SEARCH: FileSearchTask,
    TaskType.FILE_READ: FileReadTask,
    TaskType.FILE_WRITE: FileWriteTask,
    TaskType.CSV_PROCESSING: CsvProcessingTask,
    TaskType.OCR: OcrTask,
    TaskType.IMAGE_RESIZE: ImageResizeTask,
    TaskType.IMAGE_COMPRESS: ImageCompressTask,
    TaskType.VIDEO_TO_AUDIO: VideoToAudioTask,
    TaskType.SCRAPE_WEBSITE: ScrapeWebsiteTask,
    TaskType.SCRAPE_PRODUCT: ScrapeProductTask,
    TaskType.SEND_EMAIL: SendEmailTask,
    TaskType.SEND_SMS: SendSmsTask,
    TaskType.RUN_COMMAND: RunCommandTask,
    TaskType.CODE_EXECUTION: CodeExecutionTask,
    TaskType.LOG_ANALYSIS: LogAnalysisTask,
    TaskType.BACKUP_DATABASE: BackupDatabaseTask,
}
