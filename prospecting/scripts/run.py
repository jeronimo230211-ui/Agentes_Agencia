"""
Ejecuta el procesamiento de los 4 archivos descargados de Apify.
Corre desde la carpeta prospecting/:
    python run.py
"""

import subprocess
import sys
import os

FILES = [
    r"C:\Users\Jeronimo\Downloads\dataset_crawler-google-places_2026-05-23_03-05-51-680.json",
    r"C:\Users\Jeronimo\Downloads\dataset_crawler-google-places_2026-05-23_03-04-55-975.json",
    r"C:\Users\Jeronimo\Downloads\dataset_crawler-google-places_2026-05-23_03-01-17-053.json",
    r"C:\Users\Jeronimo\Downloads\dataset_crawler-google-places_2026-05-23_03-07-38-057.json",
]

script = os.path.join(os.path.dirname(__file__), "process_leads.py")

cmd = [sys.executable, script] + FILES + ["--min-rating", "3.0", "--min-reviews", "2"]
subprocess.run(cmd)
