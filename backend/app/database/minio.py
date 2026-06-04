from minio import Minio
from app.config import settings
import io

class MinIOConnector:
    def __init__(self):
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE
        )
        self.bucket_name = settings.MINIO_BUCKET_NAME
        self.init_bucket()

    def init_bucket(self):
        try:
            if not self.client.bucket_exists(self.bucket_name):
                self.client.make_bucket(self.bucket_name)
        except Exception as e:
            print(f"Error creating MinIO bucket: {e}")

    def upload_file(self, object_name: str, file_data: bytes, content_length: int, content_type: str = "application/octet-stream"):
        return self.client.put_object(
            self.bucket_name,
            object_name,
            io.BytesIO(file_data),
            content_length,
            content_type=content_type
        )

    def download_file(self, object_name: str) -> bytes:
        try:
            response = self.client.get_object(self.bucket_name, object_name)
            return response.read()
        except Exception as e:
            print(f"Error downloading file {object_name} from MinIO: {e}")
            raise e

    def get_presigned_url(self, object_name: str, expires_seconds: int = 3600) -> str:
        try:
            return self.client.get_presigned_url(
                "GET",
                self.bucket_name,
                object_name,
                expires=expires_seconds
            )
        except Exception:
            # Fallback to local access if DNS fails in container network
            return f"http://{settings.MINIO_ENDPOINT}/{self.bucket_name}/{object_name}"

minio_client = MinIOConnector()
