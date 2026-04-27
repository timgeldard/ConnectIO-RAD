from __future__ import annotations

import math

import pytest

from shared_geo import (
    NominatimPostalGeocoder,
    PostalGeocodeResult,
    enrich_with_postal_geocodes,
    geocode_postal_code,
    is_supported_country_code,
    normalize_country_code,
    normalize_postal_code,
    supported_country_codes,
)
from shared_geo import postcodes


REAL_NOMINATIM_SEARCH = postcodes._nominatim_search


@pytest.fixture(autouse=True)
def disable_nominatim_network(monkeypatch):
    REAL_NOMINATIM_SEARCH.cache_clear()

    def fake_search(*args):
        return None

    fake_search.cache_clear = lambda: None
    monkeypatch.setattr(postcodes, "_nominatim_search", fake_search)


class FakeNominatim:
    calls: list[str] = []

    def __init__(self, country_code: str) -> None:
        self.country_code = country_code
        self.calls.append(country_code)

    def query_postal_code(self, postal_code: str) -> dict[str, object]:
        if postal_code == "MISSING":
            return {"latitude": math.nan, "longitude": math.nan}
        return {
            "latitude": 53.3498,
            "longitude": -6.2603,
            "place_name": "Dublin",
            "state_name": "Leinster",
            "state_code": "L",
            "county_name": "Dublin City",
            "accuracy": 4.0,
        }


class ChinaPostalGeocoder:
    source = "fixture-cn"

    def supported_country_codes(self) -> set[str]:
        return {"CN"}

    def geocode(self, country_code: str, postal_code: str) -> PostalGeocodeResult | None:
        if country_code == "CN" and postal_code == "100000":
            return PostalGeocodeResult(
                country_code=country_code,
                postal_code=postal_code,
                latitude=39.9042,
                longitude=116.4074,
                place_name="Beijing",
                source=self.source,
            )
        return None


def setup_function() -> None:
    postcodes._geocoder.cache_clear()
    FakeNominatim.calls.clear()


def test_normalizes_country_and_postal_codes() -> None:
    assert normalize_country_code(" United Kingdom ") == "GB"
    assert normalize_country_code("usa") == "US"
    assert normalize_country_code("ie") == "IE"
    assert normalize_country_code("unknown country") == ""
    assert normalize_postal_code(" sw1a   1aa ") == "SW1A 1AA"
    assert is_supported_country_code("IE") is True
    assert is_supported_country_code("China") is True
    assert is_supported_country_code("China", providers=[postcodes.PgeocodePostalGeocoder()]) is False
    assert is_supported_country_code("China", providers=[ChinaPostalGeocoder()]) is True
    assert "IE" in supported_country_codes()
    assert "CN" in supported_country_codes([ChinaPostalGeocoder()])


def test_geocodes_postal_code_with_cached_country_geocoder(monkeypatch) -> None:
    monkeypatch.setattr(postcodes.pgeocode, "Nominatim", FakeNominatim)

    first = geocode_postal_code("Ireland", "d02 x285")
    second = geocode_postal_code("IE", "D02 X285")

    assert first is not None
    assert second is not None
    assert first.country_code == "IE"
    assert first.postal_code == "D02 X285"
    assert first.latitude == 53.3498
    assert first.longitude == -6.2603
    assert first.place_name == "Dublin"
    assert first.accuracy == 4
    assert first.is_approximate is True
    assert FakeNominatim.calls == ["IE"]


def test_returns_none_when_postal_code_cannot_be_resolved(monkeypatch) -> None:
    monkeypatch.setattr(postcodes.pgeocode, "Nominatim", FakeNominatim)

    assert geocode_postal_code("IE", "missing") is None
    assert geocode_postal_code(None, "D02 X285") is None
    assert geocode_postal_code("IE", None) is None
    assert geocode_postal_code("unknown country", "D02 X285") is None
    assert geocode_postal_code("China", "100000") is None


def test_falls_back_to_nominatim_when_pgeocode_has_no_result(monkeypatch) -> None:
    monkeypatch.setattr(postcodes.pgeocode, "Nominatim", FakeNominatim)
    monkeypatch.setattr(
        postcodes,
        "_nominatim_search",
        lambda *args: {
            "lat": "39.9042",
            "lon": "116.4074",
            "display_name": "Beijing, China",
            "address": {
                "city": "Beijing",
                "state": "Beijing",
                "ISO3166-2-lvl4": "CN-BJ",
            },
        },
    )

    result = geocode_postal_code("China", "100000")

    assert result is not None
    assert result.country_code == "CN"
    assert result.postal_code == "100000"
    assert result.latitude == 39.9042
    assert result.longitude == 116.4074
    assert result.place_name == "Beijing"
    assert result.state_code == "CN-BJ"
    assert result.source == "nominatim"


def test_nominatim_provider_uses_configured_endpoint_and_user_agent(monkeypatch) -> None:
    requests: list[tuple[str, dict[str, str], float]] = []

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def read(self) -> bytes:
            return b'[{"lat":"53.3498","lon":"-6.2603","address":{"city":"Dublin"}}]'

    def fake_urlopen(request, timeout):
        requests.append((request.full_url, dict(request.header_items()), timeout))
        return Response()

    monkeypatch.setattr(postcodes, "_nominatim_search", REAL_NOMINATIM_SEARCH)
    REAL_NOMINATIM_SEARCH.cache_clear()
    monkeypatch.setattr(postcodes, "urlopen", fake_urlopen)
    geocoder = NominatimPostalGeocoder(
        endpoint="https://example.test/search",
        user_agent="ConnectIO test",
        timeout_seconds=1.25,
        min_interval_seconds=0,
    )

    result = geocoder.geocode("IE", "D02 X285")

    assert result is not None
    assert result.place_name == "Dublin"
    assert requests[0][0].startswith("https://example.test/search?")
    assert "countrycodes=ie" in requests[0][0]
    assert "postalcode=D02+X285" in requests[0][0]
    assert requests[0][1]["User-agent"] == "ConnectIO test"
    assert requests[0][2] == 1.25


def test_can_geocode_with_future_provider_for_unsupported_default_country() -> None:
    result = geocode_postal_code("China", "100000", providers=[ChinaPostalGeocoder()])

    assert result is not None
    assert result.country_code == "CN"
    assert result.postal_code == "100000"
    assert result.place_name == "Beijing"
    assert result.source == "fixture-cn"


def test_enriches_location_records_without_dropping_source_fields(monkeypatch) -> None:
    monkeypatch.setattr(postcodes.pgeocode, "Nominatim", FakeNominatim)

    rows = enrich_with_postal_geocodes(
        [
            {"ship_to": "A100", "country": "IE", "postal": "D02 X285"},
            {"ship_to": "A200", "country": "IE", "postal": "missing"},
        ],
        country_key="country",
        postal_code_key="postal",
    )

    assert rows[0]["ship_to"] == "A100"
    assert rows[0]["geocode"]["source"] == "pgeocode"
    assert rows[0]["geocode"]["is_approximate"] is True
    assert rows[1]["ship_to"] == "A200"
    assert rows[1]["geocode"] is None
