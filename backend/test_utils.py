# test_media_root_listing.py
import os
import json
import time
import config
from utils import file_utils

# Create a "temp" dir in current directory
output_dir = os.path.join(os.getcwd(), "temp")
os.makedirs(output_dir, exist_ok=True)
print(f"Saving output JSON files to: {output_dir}")

def save_json(data, filename):
    """Save dict to a JSON file in the temp directory."""
    path = os.path.join(output_dir, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)
    print(f"✅ Saved: {path}")

def test_list_directory_sync():
    print(f"\n=== Testing list_directory_sync('/') on MEDIA_ROOT: {config.MEDIA_ROOT} ===")
    result = file_utils.list_directory_sync("/")
    save_json(result, "list_directory_sync.json")

def test_list_directory_with_progress():
    print("\n=== Testing list_directory_with_progress_async('/') ===")
    collected_progress = []

    def progress_cb(event):
        collected_progress.append(event)

    def done_cb(result, error):
        if error:
            save_json({"error": str(error)}, "list_directory_with_progress_ERROR.json")
        else:
            save_json(result, "list_directory_with_progress_FINAL.json")
            save_json(collected_progress, "list_directory_with_progress_PROGRESS.json")

    file_utils.list_directory_with_progress_async("/", progress_cb, done_cb, batch_size=5)

if __name__ == "__main__":
    test_list_directory_sync()
    test_list_directory_with_progress()

    # Wait a bit for async progress listing to complete
    time.sleep(2)
    print("\n🎯 Test complete. Check JSON files in:", output_dir)
