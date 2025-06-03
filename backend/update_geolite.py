#!/usr/bin/env python3
import os
import shutil
import tarfile
import urllib.request
from datetime import datetime
from typing import Optional

# Configuration
ACCOUNT_ID = os.getenv('MAXMIND_ACCOUNT_ID')
LICENSE_KEY = os.getenv('MAXMIND_LICENSE_KEY')
DOWNLOAD_URL = "https://download.maxmind.com/geoip/databases/GeoLite2-City/download?suffix=tar.gz"
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(OUTPUT_DIR, 'GeoLite2-City.mmdb')

def download_file(url: str, output_path: str) -> str:
    """Download a file from a URL to the specified path"""
    print(f"Downloading {url}...")
    req = urllib.request.Request(url)
    if ACCOUNT_ID and LICENSE_KEY:
        import base64
        credentials = base64.b64encode(f"{ACCOUNT_ID}:{LICENSE_KEY}".encode()).decode()
        req.add_header('Authorization', f'Basic {credentials}')
    
    with urllib.request.urlopen(req) as response, open(output_path, 'wb') as out_file:
        shutil.copyfileobj(response, out_file)
    return output_path

def extract_mmdb(tar_path: str, output_path: str) -> None:
    """Extract the .mmdb file from the downloaded tar.gz"""
    print(f"Extracting {tar_path}...")
    with tarfile.open(tar_path, 'r:gz') as tar:
        for member in tar.getmembers():
            if member.name.endswith('.mmdb'):
                member.name = os.path.basename(member.name)  # Remove directory structure
                tar.extract(member, path=os.path.dirname(output_path))
                os.rename(
                    os.path.join(os.path.dirname(output_path), member.name),
                    output_path
                )
                break

def update_geolite() -> None:
    """Update the GeoLite2 database"""
    try:
        # Create a temporary file
        temp_tar = os.path.join(OUTPUT_DIR, 'geolite_temp.tar.gz')
        
        # Download the database
        download_file(DOWNLOAD_URL, temp_tar)
        
        # Backup old database if it exists
        if os.path.exists(OUTPUT_FILE):
            backup_file = f"{OUTPUT_FILE}.bak.{datetime.now().strftime('%Y%m%d')}"
            os.rename(OUTPUT_FILE, backup_file)
            print(f"Backed up old database to {backup_file}")
        
        # Extract the new database
        extract_mmdb(temp_tar, OUTPUT_FILE)
        
        # Clean up
        os.remove(temp_tar)
        print(f"Successfully updated GeoLite2 database at {OUTPUT_FILE}")
        
    except Exception as e:
        print(f"Error updating GeoLite2 database: {str(e)}")
        raise

if __name__ == '__main__':
    update_geolite()
