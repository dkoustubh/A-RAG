import os
import shutil
from app.config import settings

class NASSyncService:
    @staticmethod
    def sync_to_nas(filename: str, file_bytes: bytes) -> str:
        """
        Saves file permanently to the configured external NAS storage location.
        """
        # Ensure directories exist
        os.makedirs(settings.NAS_MOUNT_PATH, exist_ok=True)
        nas_file_path = os.path.join(settings.NAS_MOUNT_PATH, filename)
        
        with open(nas_file_path, "wb") as f:
            f.write(file_bytes)
        
        return nas_file_path

    @staticmethod
    def cache_hot_data(filename: str, file_bytes: bytes) -> str:
        """
        Saves file to local hot storage cache.
        """
        os.makedirs(settings.LOCAL_HOT_PATH, exist_ok=True)
        local_file_path = os.path.join(settings.LOCAL_HOT_PATH, filename)
        
        with open(local_file_path, "wb") as f:
            f.write(file_bytes)
            
        return local_file_path

    @staticmethod
    def rehydrate_from_nas(filename: str) -> bytes:
        """
        Loads archived historical data back from NAS to local hot cache.
        """
        nas_file_path = os.path.join(settings.NAS_MOUNT_PATH, filename)
        if not os.path.exists(nas_file_path):
            raise FileNotFoundError(f"File {filename} does not exist on NAS storage.")
            
        with open(nas_file_path, "rb") as f:
            file_bytes = f.read()
            
        # Write to hot cache
        os.makedirs(settings.LOCAL_HOT_PATH, exist_ok=True)
        local_path = os.path.join(settings.LOCAL_HOT_PATH, filename)
        with open(local_path, "wb") as local_f:
            local_f.write(file_bytes)
            
        return file_bytes

    @staticmethod
    def cleanup_hot_cache(max_files: int = 100):
        """
        Keeps local hot cache footprint low by deleting oldest cached files.
        """
        if not os.path.exists(settings.LOCAL_HOT_PATH):
            return
        
        files = [os.path.join(settings.LOCAL_HOT_PATH, f) for f in os.listdir(settings.LOCAL_HOT_PATH)]
        if len(files) > max_files:
            # Sort by modified time
            files.sort(key=os.path.getmtime)
            # Remove oldest
            for f in files[:-max_files]:
                try:
                    os.remove(f)
                except Exception:
                    pass

nas_sync_service = NASSyncService()
