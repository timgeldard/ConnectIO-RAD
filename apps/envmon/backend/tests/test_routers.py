import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from backend.main import app
from shared_auth import UserIdentity, require_proxy_user

client = TestClient(app)


@pytest.fixture(autouse=True)
def mock_auth():
    async def mock_user():
        return UserIdentity(user_id="test", raw_token="fake-token")
    app.dependency_overrides[require_proxy_user] = mock_user
    yield
    app.dependency_overrides.pop(require_proxy_user, None)


# ---------------------------------------------------------------------------
# Plants
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_plants():
    """Portfolio endpoint returns enriched plant data from geo, metadata, KPI, and floor queries."""
    async def mock_sql(token, sql, params=None, **kwargs):
        assert token == "fake-token"
        s = sql.strip().upper()
        if "SELECT DISTINCT" in s and "PLANT_ID" in s:
            return [{"PLANT_ID": "P225"}]
        if "EM_PLANT_GEO" in s:
            return [{"plant_id": "P225", "lat": 37.4, "lon": -5.9}]
        if "GOLD_PLANT" in s:
            return [{"PLANT_ID": "P225", "PLANT_NAME": "Seville", "COUNTRY_ID": "ES", "CITY": "Seville"}]
        if "WITH BASE AS" in s:
            return [{"total_locs": 100, "active_fails": 5, "warnings": 10, "pending": 2, "pass_locs": 83, "lots_tested": 50, "lots_planned": 75}]
        if "COUNT(*) AS N" in s:
            return [{"n": 3}]
        return []

    with patch("backend.inspection_analysis.dal.plants.run_sql_async", side_effect=mock_sql):
        response = client.get("/api/em/plants")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["plant_id"] == "P225"
    assert data[0]["plant_name"] == "Seville"
    assert data[0]["lat"] == 37.4
    assert data[0]["lon"] == -5.9
    assert data[0]["floors"] == 3
    assert data[0]["kpis"]["pass_rate"] == 83.0
    assert data[0]["kpis"]["lots_tested"] == 50
    assert data[0]["kpis"]["lots_planned"] == 75


@pytest.mark.asyncio
async def test_list_plants_keeps_geo_when_gold_plant_query_fails():
    """Plant list still returns lat/lon map pins even if the gold_plant metadata query fails."""
    async def mock_sql(token, sql, params=None, **kwargs):
        assert token == "fake-token"
        s = sql.strip().upper()
        if "SELECT DISTINCT" in s and "PLANT_ID" in s:
            return [{"PLANT_ID": "P225"}]
        if "EM_PLANT_GEO" in s:
            return [{"plant_id": "P225", "lat": 37.4, "lon": -5.9}]
        if "GOLD_PLANT" in s:
            raise RuntimeError("missing metadata column")
        if "WITH BASE AS" in s:
            return []
        if "COUNT(*) AS N" in s:
            return [{"n": 0}]
        return []

    with patch("backend.inspection_analysis.dal.plants.run_sql_async", side_effect=mock_sql):
        response = client.get("/api/em/plants")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["plant_id"] == "P225"
    assert data[0]["plant_name"] == "P225"
    assert data[0]["lat"] == 37.4
    assert data[0]["lon"] == -5.9


@pytest.mark.asyncio
async def test_list_plants_accepts_lowercase_plant_id_rows():
    """Plant ID lookup tolerates lowercase column keys from Databricks result sets."""
    async def mock_sql(token, sql, params=None, **kwargs):
        assert token == "fake-token"
        s = sql.strip().upper()
        if "SELECT DISTINCT" in s and "PLANT_ID" in s:
            return [{"plant_id": "P225"}]
        if "EM_PLANT_GEO" in s:
            return [{"plant_id": "P225", "lat": 37.4, "lon": -5.9}]
        if "GOLD_PLANT" in s:
            return []
        if "WITH BASE AS" in s:
            return []
        if "COUNT(*) AS N" in s:
            return [{"n": 0}]
        return []

    with patch("backend.inspection_analysis.dal.plants.run_sql_async", side_effect=mock_sql):
        response = client.get("/api/em/plants")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["plant_id"] == "P225"
    assert data[0]["lat"] == 37.4
    assert data[0]["lon"] == -5.9


# ---------------------------------------------------------------------------
# Floors
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_floors():
    """Floor list returns metadata and mapped location counts per floor."""
    async def mock_sql(token, sql, params=None, **kwargs):
        assert token == "fake-token"
        s = sql.strip().upper()
        if "FLOOR_ID, FLOOR_NAME, SVG_URL" in s:
            return [{"floor_id": "F1", "floor_name": "Floor 1", "svg_url": "img1.svg", "svg_width": 100, "svg_height": 100}]
        if "COUNT(DISTINCT FUNC_LOC_ID) AS LOCATION_COUNT" in s:
            return [{"floor_id": "F1", "location_count": 5}]
        return []

    with patch("backend.spatial_config.dal.floors.run_sql_async", side_effect=mock_sql):
        response = client.get("/api/em/floors?plant_id=P225")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["floor_id"] == "F1"
    assert data[0]["location_count"] == 5


# ---------------------------------------------------------------------------
# Heatmap
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_heatmap():
    """Heatmap returns markers with correct status derived from inspection results."""
    async def mock_sql(token, sql, params=None, **kwargs):
        assert token == "fake-token"
        return [
            {
                "func_loc_id": "L1", "floor_id": "F1", "x_pos": 10.5, "y_pos": 20.0,
                "lot_id": "LOT1", "valuation": "A", "mic_name": "ATP",
                "quantitative_result": None, "lot_date": "2024-01-01",
            }
        ]

    with patch("backend.inspection_analysis.dal.heatmap.run_sql_async", side_effect=mock_sql):
        response = client.get("/api/em/heatmap?plant_id=P225&floor_id=F1")

    assert response.status_code == 200, response.json()
    data = response.json()
    assert data["floor_id"] == "F1"
    assert len(data["markers"]) == 1
    assert data["markers"][0]["func_loc_id"] == "L1"
    assert data["markers"][0]["status"] == "PASS"


# ---------------------------------------------------------------------------
# Domain — unit tests (no HTTP, no DAL)
# ---------------------------------------------------------------------------

def test_risk_score_zero_for_pass_results():
    """Passing valuations contribute zero to the risk score."""
    from datetime import date
    from backend.inspection_analysis.domain.risk import calculate_risk_score

    rows = [{"valuation": "A", "mic_name": "ATP", "lot_date": "2024-01-01"}]
    score = calculate_risk_score(rows, date(2024, 1, 10), 0.1)
    assert score == 0.0


def test_risk_score_positive_for_fail_results():
    """Failing valuations produce a positive risk score."""
    from datetime import date
    from backend.inspection_analysis.domain.risk import calculate_risk_score

    rows = [{"valuation": "R", "mic_name": "ATP", "lot_date": "2024-01-01"}]
    score = calculate_risk_score(rows, date(2024, 1, 1), 0.1)
    assert score == pytest.approx(10.0)


def test_risk_score_uses_mic_specific_decay_rates():
    """MIC-specific decay rates override the default decay lambda."""
    from datetime import date
    import math
    from backend.inspection_analysis.domain.risk import calculate_risk_score

    rows = [{"valuation": "R", "mic_name": "atp", "lot_date": "2024-01-01"}]
    score = calculate_risk_score(rows, date(2024, 1, 2), 0.1, {"ATP": 0.5})
    assert score == pytest.approx(10.0 * math.exp(-0.5))


def test_risk_score_normalizes_decay_rate_keys():
    """Lowercase MIC-specific decay keys match normalized MIC names."""
    from datetime import date
    import math
    from backend.inspection_analysis.domain.risk import calculate_risk_score

    rows = [{"valuation": "R", "mic_name": "ATP", "lot_date": "2024-01-01"}]
    score = calculate_risk_score(rows, date(2024, 1, 2), 0.1, {"atp": 0.5})
    assert score == pytest.approx(10.0 * math.exp(-0.5))


def test_spc_no_warning_fewer_than_3_results():
    """Early warning requires at least 3 quantitative results."""
    from backend.inspection_analysis.domain.spc import detect_early_warning

    assert detect_early_warning([]) is False
    assert detect_early_warning([{"quantitative_result": "1.0"}]) is False
    assert detect_early_warning([{"quantitative_result": "1.0"}, {"quantitative_result": "2.0"}]) is False


def test_spc_detects_monotonic_increase():
    """Three strictly increasing values trigger an early warning."""
    from backend.inspection_analysis.domain.spc import detect_early_warning

    rows = [
        {"quantitative_result": "1.0"},
        {"quantitative_result": "2.0"},
        {"quantitative_result": "3.0"},
    ]
    assert detect_early_warning(rows) is True


def test_spc_no_warning_on_flat_values():
    """Equal values do not trigger an early warning."""
    from backend.inspection_analysis.domain.spc import detect_early_warning

    rows = [
        {"quantitative_result": "2.0"},
        {"quantitative_result": "2.0"},
        {"quantitative_result": "2.0"},
    ]
    assert detect_early_warning(rows) is False


def test_derive_status_deterministic_pass():
    """Deterministic mode: accepting valuation → PASS."""
    from backend.inspection_analysis.domain.status import derive_location_status

    rows = [{"valuation": "A"}]
    assert derive_location_status(rows, risk=0.0, continuous_mode=False, early_warning=False) == "PASS"


def test_derive_status_deterministic_fail():
    """Deterministic mode: rejecting valuation → FAIL."""
    from backend.inspection_analysis.domain.status import derive_location_status

    rows = [{"valuation": "R"}]
    assert derive_location_status(rows, risk=0.0, continuous_mode=False, early_warning=False) == "FAIL"


def test_derive_status_spc_escalates_pass_to_warning():
    """Early warning flag escalates PASS to WARNING in both modes."""
    from backend.inspection_analysis.domain.status import derive_location_status

    rows = [{"valuation": "A"}]
    assert derive_location_status(rows, risk=0.0, continuous_mode=False, early_warning=True) == "WARNING"


def test_lot_status_pending_when_no_end_date():
    """Lot without an end date is PENDING regardless of valuation."""
    from backend.inspection_analysis.domain.status import lot_status

    assert lot_status("A", None) == "PENDING"
    assert lot_status("R", None) == "PENDING"


def test_lot_status_pass_and_fail():
    """Lot status maps A → PASS and R → FAIL when end date is present."""
    from backend.inspection_analysis.domain.status import lot_status

    assert lot_status("A", "2024-01-01") == "PASS"
    assert lot_status("R", "2024-01-01") == "FAIL"


# ---------------------------------------------------------------------------
# Spatial Config — domain value object tests
# ---------------------------------------------------------------------------

def test_location_coordinate_valid():
    """Valid coordinate values construct without error."""
    from backend.spatial_config.domain.coordinate import LocationCoordinate

    coord = LocationCoordinate(func_loc_id="LOC1", floor_id="F1", x_pct=50.0, y_pct=25.0)
    assert coord.x_pct == 50.0


def test_location_coordinate_rejects_out_of_bounds():
    """Coordinate percentages outside 0–100 raise ValueError at construction."""
    import pytest
    from backend.spatial_config.domain.coordinate import LocationCoordinate

    with pytest.raises(ValueError, match="x_pct"):
        LocationCoordinate(func_loc_id="LOC1", floor_id="F1", x_pct=101.0, y_pct=50.0)
    with pytest.raises(ValueError, match="y_pct"):
        LocationCoordinate(func_loc_id="LOC1", floor_id="F1", x_pct=50.0, y_pct=-1.0)


def test_plant_geo_valid():
    """Valid lat/lon construct PlantGeo without error."""
    from backend.spatial_config.domain.plant_geo import PlantGeo

    geo = PlantGeo(plant_id="P225", lat=37.4, lon=-5.9)
    assert geo.lat == 37.4


def test_plant_geo_rejects_invalid_bounds():
    """Latitude outside -90–90 or longitude outside -180–180 raises ValueError."""
    import pytest
    from backend.spatial_config.domain.plant_geo import PlantGeo

    with pytest.raises(ValueError, match="lat"):
        PlantGeo(plant_id="P225", lat=91.0, lon=0.0)
    with pytest.raises(ValueError, match="lon"):
        PlantGeo(plant_id="P225", lat=0.0, lon=181.0)
