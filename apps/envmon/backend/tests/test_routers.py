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

@pytest.mark.asyncio
async def test_list_plants():
    async def mock_sql_fn(token, sql, params=None, **kwargs):
        assert token == "fake-token"
        s = sql.strip().upper()
        if "SELECT DISTINCT PLANT_ID" in s:
            return [{"PLANT_ID": "P225"}]
        if "FROM" in s and "EM_PLANT_GEO" in s:
            return [{"plant_id": "P225", "lat": 37.4, "lon": -5.9}]
        if "FROM" in s and "GOLD_PLANT" in s:
            return [{"PLANT_ID": "P225", "PLANT_NAME": "Seville", "COUNTRY_ID": "ES", "REGION": "EMEA", "CITY": "Seville"}]
        if "WITH BASE AS" in s:
            return [{"total_locs": 100, "active_fails": 5, "warnings": 10, "pending": 2, "pass_locs": 83, "lots_tested": 50}]
        if "SELECT COUNT(*) AS N FROM" in s:
            return [{"n": 3}]
        return []

    with patch("backend.routers.plants.run_sql_async", side_effect=mock_sql_fn):
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

@pytest.mark.asyncio
async def test_list_plants_keeps_geo_when_gold_plant_query_fails():
    async def mock_sql_fn(token, sql, params=None, **kwargs):
        assert token == "fake-token"
        s = sql.strip().upper()
        if "SELECT DISTINCT" in s and "PLANT_ID" in s:
            return [{"PLANT_ID": "P225"}]
        if "FROM" in s and "EM_PLANT_GEO" in s:
            return [{"PLANT_ID": "P225", "LAT": 37.4, "LON": -5.9}]
        if "FROM" in s and "GOLD_PLANT" in s and "DISTINCT" not in s:
            raise RuntimeError("missing metadata column")
        if "WITH BASE AS" in s:
            return []
        if "SELECT COUNT(*) AS N FROM" in s:
            return [{"n": 0}]
        return []

    with patch("backend.routers.plants.run_sql_async", side_effect=mock_sql_fn):
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
    async def mock_sql_fn(token, sql, params=None, **kwargs):
        assert token == "fake-token"
        s = sql.strip().upper()
        if "SELECT DISTINCT" in s and "PLANT_ID" in s:
            return [{"plant_id": "P225"}]
        if "FROM" in s and "EM_PLANT_GEO" in s:
            return [{"plant_id": "P225", "lat": 37.4, "lon": -5.9}]
        if "FROM" in s and "GOLD_PLANT" in s:
            return []
        if "WITH BASE AS" in s:
            return []
        if "SELECT COUNT(*) AS N FROM" in s:
            return [{"n": 0}]
        return []

    with patch("backend.routers.plants.run_sql_async", side_effect=mock_sql_fn):
        response = client.get("/api/em/plants")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["plant_id"] == "P225"
        assert data[0]["lat"] == 37.4
        assert data[0]["lon"] == -5.9

@pytest.mark.asyncio
async def test_list_floors():
    async def mock_sql_fn(token, sql, params=None, **kwargs):
        assert token == "fake-token"
        s = sql.strip().upper()
        if "FLOOR_ID, FLOOR_NAME, SVG_URL" in s:
            return [{"floor_id": "F1", "floor_name": "Floor 1", "svg_url": "img1.svg", "svg_width": 100, "svg_height": 100}]
        if "COUNT(DISTINCT FUNC_LOC_ID) AS LOCATION_COUNT" in s:
            return [{"floor_id": "F1", "location_count": 5}]
        return []

    with patch("backend.routers.floors.run_sql_async", side_effect=mock_sql_fn):
        response = client.get("/api/em/floors?plant_id=P225")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["floor_id"] == "F1"
        assert data[0]["location_count"] == 5

@pytest.mark.asyncio
async def test_get_heatmap():
    async def mock_sql_fn(token, sql, params=None, **kwargs):
        assert token == "fake-token"
        s = sql.strip().upper()
        if "SELECT" in s and "LOT.INSPECTION_LOT_ID" in s:
            # Main heatmap query
            return [{"func_loc_id": "L1", "lot_id": "LOT1", "valuation": "A", "lot_date": "2024-01-01", "lot_end_date": "2024-01-02", "mic_name": "M1", "x_pos": 10.5, "y_pos": 20.0, "floor_id": "F1"}]
        if "SELECT FUNC_LOC_ID, FLOOR_ID, X_POS, Y_POS" in s:
            # Coordinate map query
            return [{"func_loc_id": "L1", "floor_id": "F1", "x_pos": 10.5, "y_pos": 20.0}]
        return []

    with patch("backend.routers.heatmap.run_sql_async", side_effect=mock_sql_fn):
        response = client.get("/api/em/heatmap?plant_id=P225&floor_id=F1")
        
        assert response.status_code == 200, response.json()
        data = response.json()
        assert data["floor_id"] == "F1"
        assert len(data["markers"]) == 1
        assert data["markers"][0]["func_loc_id"] == "L1"
        assert data["markers"][0]["status"] == "PASS"
