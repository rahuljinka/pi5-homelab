"""
Current weather and 7-day forecast from Open-Meteo (free, no API key).

The location comes from WEATHER_LATITUDE / WEATHER_LONGITUDE in .env.
Results are cached for 10 minutes, so the display and panel don't call
Open-Meteo on every page load.
"""

import time

import requests
from fastapi import APIRouter

from ..settings import (
    TIMEZONE,
    WEATHER_CACHE_SECONDS,
    WEATHER_LATITUDE,
    WEATHER_LOCATION_NAME,
    WEATHER_LONGITUDE,
    WEATHER_UNITS,
)

router = APIRouter(tags=["weather"])

_cache = {"at": 0.0, "data": None}


def _fetch():
    response = requests.get(
        "https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": WEATHER_LATITUDE,
            "longitude": WEATHER_LONGITUDE,
            "current_weather": "true",
            "daily": "temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max",
            "temperature_unit": WEATHER_UNITS,
            "timezone": str(TIMEZONE),
        },
        timeout=10,
    )
    response.raise_for_status()
    data = response.json()
    daily = data["daily"]
    return {
        "location": WEATHER_LOCATION_NAME,
        "current": data["current_weather"],
        "forecast": [
            {
                "date": daily["time"][i],
                "high": daily["temperature_2m_max"][i],
                "low": daily["temperature_2m_min"][i],
                "code": daily["weathercode"][i],
                "rain_chance": daily["precipitation_probability_max"][i],
            }
            for i in range(len(daily["time"]))
        ],
    }


@router.get("/weather")
def get_weather():
    """Current conditions (WMO weather code, is_day) and the daily forecast."""
    if not (WEATHER_LATITUDE and WEATHER_LONGITUDE):
        return {"error": "Set WEATHER_LATITUDE and WEATHER_LONGITUDE in .env"}
    if _cache["data"] and time.time() - _cache["at"] < WEATHER_CACHE_SECONDS:
        return _cache["data"]
    try:
        _cache.update(data=_fetch(), at=time.time())
    except Exception as e:
        if _cache["data"]:
            return _cache["data"]  # keep showing the last good forecast
        return {"error": str(e)}
    return _cache["data"]
