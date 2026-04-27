from __future__ import annotations

from dataclasses import asdict, dataclass
from functools import lru_cache
import json
import math
import os
import time
from typing import Any, Collection, Iterable, Mapping, Protocol, Sequence
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import pgeocode


COUNTRY_ALIASES = {
    "CHINA": "CN",
    "DEUTSCHLAND": "DE",
    "ENGLAND": "GB",
    "ESPAÑA": "ES",
    "FRANCE": "FR",
    "GERMANY": "DE",
    "GREAT BRITAIN": "GB",
    "INDONESIA": "ID",
    "IRELAND": "IE",
    "MALAYSIA": "MY",
    "NORTHERN IRELAND": "GB",
    "PORTUGAL": "PT",
    "PRC": "CN",
    "SCOTLAND": "GB",
    "SPAIN": "ES",
    "UK": "GB",
    "UNITED KINGDOM": "GB",
    "UNITED STATES": "US",
    "UNITED STATES OF AMERICA": "US",
    "USA": "US",
    "WALES": "GB",
}


@dataclass(frozen=True)
class PostalGeocodeResult:
    """Approximate postal-code centroid suitable for map previews."""

    country_code: str
    postal_code: str
    latitude: float
    longitude: float
    place_name: str | None = None
    state_name: str | None = None
    state_code: str | None = None
    county_name: str | None = None
    accuracy: int | None = None
    source: str = "pgeocode"
    is_approximate: bool = True

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


class PostalGeocoder(Protocol):
    source: str

    def supported_country_codes(self) -> Collection[str]: ...

    def geocode(self, country_code: str, postal_code: str) -> PostalGeocodeResult | None: ...


class PgeocodePostalGeocoder:
    source = "pgeocode"

    def supported_country_codes(self) -> Collection[str]:
        return pgeocode.COUNTRIES_VALID

    def geocode(self, country_code: str, postal_code: str) -> PostalGeocodeResult | None:
        try:
            row = _geocoder(country_code).query_postal_code(postal_code)
        except (KeyError, ValueError):
            return None
        latitude = _float_value(_lookup(row, "latitude"))
        longitude = _float_value(_lookup(row, "longitude"))
        if latitude is None or longitude is None:
            return None

        return PostalGeocodeResult(
            country_code=country_code,
            postal_code=postal_code,
            latitude=latitude,
            longitude=longitude,
            place_name=_str_value(_lookup(row, "place_name")),
            state_name=_str_value(_lookup(row, "state_name")),
            state_code=_str_value(_lookup(row, "state_code")),
            county_name=_str_value(_lookup(row, "county_name")),
            accuracy=_int_value(_lookup(row, "accuracy")),
            source=self.source,
        )


class NominatimPostalGeocoder:
    source = "nominatim"

    def __init__(
        self,
        *,
        endpoint: str | None = None,
        user_agent: str | None = None,
        timeout_seconds: float | None = None,
        min_interval_seconds: float | None = None,
    ) -> None:
        self.endpoint = (endpoint or os.getenv("SHARED_GEO_NOMINATIM_ENDPOINT") or "https://nominatim.openstreetmap.org/search").rstrip("?")
        self.user_agent = user_agent or os.getenv("SHARED_GEO_NOMINATIM_USER_AGENT") or "ConnectIO-RAD shared-geo/0.1"
        self.timeout_seconds = timeout_seconds or float(os.getenv("SHARED_GEO_NOMINATIM_TIMEOUT_SECONDS", "2.5"))
        self.min_interval_seconds = min_interval_seconds or float(os.getenv("SHARED_GEO_NOMINATIM_MIN_INTERVAL_SECONDS", "1.0"))
        self._last_request_at = 0.0

    def supported_country_codes(self) -> Collection[str]:
        return NOMINATIM_SUPPORTED_COUNTRY_CODES

    def geocode(self, country_code: str, postal_code: str) -> PostalGeocodeResult | None:
        sleep_seconds = self.min_interval_seconds - (time.monotonic() - self._last_request_at)
        if sleep_seconds > 0:
            time.sleep(sleep_seconds)
        self._last_request_at = time.monotonic()

        item = _nominatim_search(
            self.endpoint,
            self.user_agent,
            country_code,
            postal_code,
            self.timeout_seconds,
        )
        if item is None:
            return None

        latitude = _float_value(item.get("lat"))
        longitude = _float_value(item.get("lon"))
        if latitude is None or longitude is None:
            return None

        address = item.get("address") if isinstance(item.get("address"), dict) else {}
        return PostalGeocodeResult(
            country_code=country_code,
            postal_code=postal_code,
            latitude=latitude,
            longitude=longitude,
            place_name=_str_value(address.get("city") or address.get("town") or address.get("village") or item.get("display_name")),
            state_name=_str_value(address.get("state")),
            state_code=_str_value(address.get("ISO3166-2-lvl4")),
            county_name=_str_value(address.get("county")),
            source=self.source,
        )


NOMINATIM_SUPPORTED_COUNTRY_CODES = frozenset(
    {
        "AD",
        "AE",
        "AF",
        "AG",
        "AI",
        "AL",
        "AM",
        "AO",
        "AQ",
        "AR",
        "AS",
        "AT",
        "AU",
        "AW",
        "AX",
        "AZ",
        "BA",
        "BB",
        "BD",
        "BE",
        "BF",
        "BG",
        "BH",
        "BI",
        "BJ",
        "BL",
        "BM",
        "BN",
        "BO",
        "BQ",
        "BR",
        "BS",
        "BT",
        "BV",
        "BW",
        "BY",
        "BZ",
        "CA",
        "CC",
        "CD",
        "CF",
        "CG",
        "CH",
        "CI",
        "CK",
        "CL",
        "CM",
        "CN",
        "CO",
        "CR",
        "CU",
        "CV",
        "CW",
        "CX",
        "CY",
        "CZ",
        "DE",
        "DJ",
        "DK",
        "DM",
        "DO",
        "DZ",
        "EC",
        "EE",
        "EG",
        "EH",
        "ER",
        "ES",
        "ET",
        "FI",
        "FJ",
        "FK",
        "FM",
        "FO",
        "FR",
        "GA",
        "GB",
        "GD",
        "GE",
        "GF",
        "GG",
        "GH",
        "GI",
        "GL",
        "GM",
        "GN",
        "GP",
        "GQ",
        "GR",
        "GS",
        "GT",
        "GU",
        "GW",
        "GY",
        "HK",
        "HM",
        "HN",
        "HR",
        "HT",
        "HU",
        "ID",
        "IE",
        "IL",
        "IM",
        "IN",
        "IO",
        "IQ",
        "IR",
        "IS",
        "IT",
        "JE",
        "JM",
        "JO",
        "JP",
        "KE",
        "KG",
        "KH",
        "KI",
        "KM",
        "KN",
        "KP",
        "KR",
        "KW",
        "KY",
        "KZ",
        "LA",
        "LB",
        "LC",
        "LI",
        "LK",
        "LR",
        "LS",
        "LT",
        "LU",
        "LV",
        "LY",
        "MA",
        "MC",
        "MD",
        "ME",
        "MF",
        "MG",
        "MH",
        "MK",
        "ML",
        "MM",
        "MN",
        "MO",
        "MP",
        "MQ",
        "MR",
        "MS",
        "MT",
        "MU",
        "MV",
        "MW",
        "MX",
        "MY",
        "MZ",
        "NA",
        "NC",
        "NE",
        "NF",
        "NG",
        "NI",
        "NL",
        "NO",
        "NP",
        "NR",
        "NU",
        "NZ",
        "OM",
        "PA",
        "PE",
        "PF",
        "PG",
        "PH",
        "PK",
        "PL",
        "PM",
        "PN",
        "PR",
        "PS",
        "PT",
        "PW",
        "PY",
        "QA",
        "RE",
        "RO",
        "RS",
        "RU",
        "RW",
        "SA",
        "SB",
        "SC",
        "SD",
        "SE",
        "SG",
        "SH",
        "SI",
        "SJ",
        "SK",
        "SL",
        "SM",
        "SN",
        "SO",
        "SR",
        "SS",
        "ST",
        "SV",
        "SX",
        "SY",
        "SZ",
        "TC",
        "TD",
        "TF",
        "TG",
        "TH",
        "TJ",
        "TK",
        "TL",
        "TM",
        "TN",
        "TO",
        "TR",
        "TT",
        "TV",
        "TW",
        "TZ",
        "UA",
        "UG",
        "UM",
        "US",
        "UY",
        "UZ",
        "VA",
        "VC",
        "VE",
        "VG",
        "VI",
        "VN",
        "VU",
        "WF",
        "WS",
        "YE",
        "YT",
        "ZA",
        "ZM",
        "ZW",
    }
)

DEFAULT_POSTAL_GEOCODERS: tuple[PostalGeocoder, ...] = (PgeocodePostalGeocoder(), NominatimPostalGeocoder())


def normalize_country_code(country: str | None) -> str:
    if country is None:
        return ""
    value = " ".join(str(country).strip().upper().split())
    if not value:
        return ""
    if value in COUNTRY_ALIASES:
        return COUNTRY_ALIASES[value]
    return value if len(value) == 2 else ""


def normalize_postal_code(postal_code: str | None) -> str:
    if postal_code is None:
        return ""
    return " ".join(str(postal_code).strip().upper().split())


def geocode_postal_code(
    country: str | None,
    postal_code: str | None,
    *,
    providers: Sequence[PostalGeocoder] | None = None,
) -> PostalGeocodeResult | None:
    country_code = normalize_country_code(country)
    normalized_postal_code = normalize_postal_code(postal_code)
    if not country_code or not normalized_postal_code:
        return None

    for provider in _providers(providers):
        if country_code not in provider.supported_country_codes():
            continue
        result = provider.geocode(country_code, normalized_postal_code)
        if result is not None:
            return result
    return None


def enrich_with_postal_geocodes(
    locations: Iterable[Mapping[str, Any]],
    *,
    country_key: str = "country_code",
    postal_code_key: str = "postal_code",
    geocode_key: str = "geocode",
    providers: Sequence[PostalGeocoder] | None = None,
) -> list[dict[str, Any]]:
    enriched: list[dict[str, Any]] = []
    for location in locations:
        row = dict(location)
        geocode = geocode_postal_code(
            row.get(country_key),
            row.get(postal_code_key),
            providers=providers,
        )
        row[geocode_key] = geocode.as_dict() if geocode else None
        enriched.append(row)
    return enriched


def supported_country_codes(providers: Sequence[PostalGeocoder] | None = None) -> tuple[str, ...]:
    codes: set[str] = set()
    for provider in _providers(providers):
        codes.update(provider.supported_country_codes())
    return tuple(sorted(codes))


def is_supported_country_code(
    country: str | None,
    *,
    providers: Sequence[PostalGeocoder] | None = None,
) -> bool:
    country_code = normalize_country_code(country)
    return bool(country_code and country_code in supported_country_codes(providers))


def _providers(providers: Sequence[PostalGeocoder] | None) -> Sequence[PostalGeocoder]:
    return providers or DEFAULT_POSTAL_GEOCODERS


@lru_cache(maxsize=4096)
def _nominatim_search(
    endpoint: str,
    user_agent: str,
    country_code: str,
    postal_code: str,
    timeout_seconds: float,
) -> Mapping[str, Any] | None:
    query = urlencode(
        {
            "format": "jsonv2",
            "addressdetails": "1",
            "limit": "1",
            "countrycodes": country_code.lower(),
            "postalcode": postal_code,
        }
    )
    request = Request(
        f"{endpoint}?{query}",
        headers={
            "Accept": "application/json",
            "User-Agent": user_agent,
        },
    )
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            body = response.read()
    except (HTTPError, URLError, TimeoutError, OSError):
        return None

    try:
        data = json.loads(body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None

    if not isinstance(data, list) or not data or not isinstance(data[0], dict):
        return None
    return data[0]


@lru_cache(maxsize=64)
def _geocoder(country_code: str) -> pgeocode.Nominatim:
    return pgeocode.Nominatim(country_code)


def _lookup(row: Any, key: str) -> Any:
    try:
        return row[key]
    except (KeyError, TypeError):
        return None


def _str_value(value: Any) -> str | None:
    if _is_missing(value):
        return None
    text = str(value).strip()
    return text or None


def _float_value(value: Any) -> float | None:
    if _is_missing(value):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _int_value(value: Any) -> int | None:
    if _is_missing(value):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _is_missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    try:
        return bool(math.isnan(value))
    except (TypeError, ValueError):
        return False
