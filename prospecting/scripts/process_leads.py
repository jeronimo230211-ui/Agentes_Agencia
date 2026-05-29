"""
Procesa uno o varios outputs JSON de Apify Google Maps Scraper
y genera un CSV limpio de leads para Nexora IA.

Uso:
    python process_leads.py archivo1.json archivo2.json archivo3.json
    python process_leads.py *.json --min-rating 3.5 --min-reviews 5
"""

import json
import csv
import argparse
from datetime import datetime


COLUMNAS = [
    "nombre",
    "categoria",
    "direccion",
    "ciudad",
    "pais",
    "telefono",
    "sitio_web",
    "email",
    "rating",
    "total_reviews",
    "google_maps_url",
    "estado_horario",
    "tiene_web",
    "tiene_telefono",
    "prioridad",
]

PAISES_LATAM = {"CO", "MX", "AR"}


def calcular_prioridad(lugar: dict) -> str:
    tiene_tel = bool(lugar.get("phone"))
    tiene_web = bool(lugar.get("website"))

    if tiene_tel and not tiene_web:
        return "ALTA"
    elif tiene_tel and tiene_web:
        return "MEDIA"
    return "BAJA"


def extraer_ciudad(lugar: dict) -> str:
    city = lugar.get("city", "")
    if city:
        return city
    address = lugar.get("address", "")
    partes = [p.strip() for p in address.split(",")]
    return partes[-3] if len(partes) >= 3 else partes[0]


def extraer_direccion(lugar: dict) -> str:
    partes = [lugar.get("street", ""), lugar.get("city", ""), lugar.get("state", "")]
    return ", ".join(p for p in partes if p)


def procesar(input_files: list[str], min_rating: float, min_reviews: int) -> list[dict]:
    data = []
    for f_path in input_files:
        with open(f_path, "r", encoding="utf-8") as f:
            chunk = json.load(f)
            data.extend(chunk)
    print(f"   Total registros cargados: {len(data)}")

    leads = []
    descartados_pais = 0
    vistos = set()  # deduplicar por URL de Google Maps

    for lugar in data:
        pais = lugar.get("countryCode", "")
        if pais not in PAISES_LATAM:
            descartados_pais += 1
            continue

        url = lugar.get("url", "")
        if url in vistos:
            continue
        vistos.add(url)

        rating = lugar.get("totalScore") or 0
        reviews = lugar.get("reviewsCount") or 0

        if rating < min_rating or reviews < min_reviews:
            continue

        # Ignorar cadenas grandes (probable cadena con >500 reviews)
        if reviews > 500:
            continue

        lead = {
            "nombre": lugar.get("title", ""),
            "categoria": lugar.get("categoryName", ""),
            "direccion": extraer_direccion(lugar),
            "ciudad": extraer_ciudad(lugar),
            "pais": pais,
            "telefono": lugar.get("phone", ""),
            "sitio_web": lugar.get("website", ""),
            "email": lugar.get("email", ""),
            "rating": rating,
            "total_reviews": reviews,
            "google_maps_url": lugar.get("url", ""),
            "estado_horario": lugar.get("openingHours", [{}])[0].get("day", "") if lugar.get("openingHours") else "",
            "tiene_web": "Sí" if lugar.get("website") else "No",
            "tiene_telefono": "Sí" if lugar.get("phone") else "No",
            "prioridad": calcular_prioridad(lugar),
        }
        leads.append(lead)

    print(f"   Descartados (no LATAM): {descartados_pais}")

    leads.sort(key=lambda x: (
        0 if x["prioridad"] == "ALTA" else 1 if x["prioridad"] == "MEDIA" else 2,
        -x["total_reviews"]
    ))

    return leads


def exportar_csv(leads: list[dict], output_file: str):
    with open(output_file, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNAS)
        writer.writeheader()
        writer.writerows(leads)
    print(f"✅ {len(leads)} leads exportados a: {output_file}")


def main():
    parser = argparse.ArgumentParser(description="Procesa leads de Apify Google Maps")
    parser.add_argument("input", nargs="+", help="Archivos JSON de output de Apify (uno o varios)")
    parser.add_argument("--min-rating", type=float, default=3.0, help="Rating mínimo (default: 3.0)")
    parser.add_argument("--min-reviews", type=int, default=3, help="Reviews mínimas (default: 3)")
    args = parser.parse_args()

    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    output_file = f"leads_nexora_{timestamp}.csv"

    leads = procesar(args.input, args.min_rating, args.min_reviews)

    altas = sum(1 for l in leads if l["prioridad"] == "ALTA")
    medias = sum(1 for l in leads if l["prioridad"] == "MEDIA")
    bajas = sum(1 for l in leads if l["prioridad"] == "BAJA")

    print(f"\n📊 Resumen:")
    print(f"   Total leads: {len(leads)}")
    print(f"   🔴 Alta prioridad (sin web): {altas}")
    print(f"   🟡 Media prioridad (con web): {medias}")
    print(f"   ⚪ Baja prioridad (sin tel): {bajas}")

    exportar_csv(leads, output_file)


if __name__ == "__main__":
    main()
