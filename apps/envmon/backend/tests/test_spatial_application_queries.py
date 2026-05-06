import pytest

from envmon_backend.spatial_config.application import queries


@pytest.mark.asyncio
async def test_list_floors_defaults_missing_counts_and_coerces_dimensions(monkeypatch):
    """Floor query maps missing counts to zero and preserves nullable dimensions."""
    async def fake_fetch_floors(_token, _plant_id):
        return [
            {"floor_id": "F1", "floor_name": "Floor 1", "svg_url": "f1.svg", "svg_width": "100.5", "svg_height": "200"},
            {"floor_id": "F2", "floor_name": "Floor 2", "svg_url": None, "svg_width": None, "svg_height": None},
        ]

    async def fake_fetch_counts(_token, _plant_id):
        return [{"floor_id": "F1", "location_count": "3"}]

    monkeypatch.setattr(queries.floors_dal, "fetch_floors", fake_fetch_floors)
    monkeypatch.setattr(queries.floors_dal, "fetch_floor_location_counts", fake_fetch_counts)

    floors = await queries.list_floors("token", "P225")

    assert floors[0].location_count == 3
    assert floors[0].svg_width == 100.5
    assert floors[0].svg_height == 200.0
    assert floors[1].location_count == 0
    assert floors[1].svg_width is None
    assert floors[1].svg_height is None


@pytest.mark.asyncio
async def test_list_locations_preserves_filters_and_nullable_coordinates(monkeypatch):
    """Location query forwards filters and preserves null coordinate values."""
    calls = []

    async def fake_fetch_locations(token, plant_id, floor_id, mapped_only):
        calls.append((token, plant_id, floor_id, mapped_only))
        return [
            {"func_loc_id": "L1", "floor_id": "F1", "x_pos": None, "y_pos": None, "is_mapped": False},
            {"func_loc_id": "L2", "floor_id": "F1", "x_pos": "10.5", "y_pos": "20", "is_mapped": True},
        ]

    monkeypatch.setattr(queries.coordinates_dal, "fetch_locations", fake_fetch_locations)

    locations = await queries.list_locations("token", "P225", "F1", True)

    assert calls == [("token", "P225", "F1", True)]
    assert locations[0].x_pos is None
    assert locations[0].y_pos is None
    assert locations[0].is_mapped is False
    assert locations[1].x_pos == 10.5
    assert locations[1].y_pos == 20.0
    assert locations[1].is_mapped is True


@pytest.mark.asyncio
async def test_get_location_coordinate_returns_unmapped_fallback(monkeypatch):
    """Missing coordinate rows return an unmapped location metadata fallback."""
    async def fake_fetch_coordinate(_token, _plant_id, _func_loc_id):
        return []

    monkeypatch.setattr(queries.coordinates_dal, "fetch_location_coordinate", fake_fetch_coordinate)

    location = await queries.get_location_coordinate("token", "P225", "L1")

    assert location.func_loc_id == "L1"
    assert location.plant_id == "P225"
    assert location.floor_id is None
    assert location.x_pos is None
    assert location.y_pos is None
    assert location.is_mapped is False


@pytest.mark.asyncio
async def test_get_location_coordinate_allows_null_positions(monkeypatch):
    """Existing coordinate rows with null positions do not crash conversion."""
    async def fake_fetch_coordinate(_token, _plant_id, _func_loc_id):
        return [{"func_loc_id": "L1", "floor_id": "F1", "x_pos": None, "y_pos": "42.5"}]

    monkeypatch.setattr(queries.coordinates_dal, "fetch_location_coordinate", fake_fetch_coordinate)

    location = await queries.get_location_coordinate("token", "P225", "L1")

    assert location.floor_id == "F1"
    assert location.x_pos is None
    assert location.y_pos == 42.5
    assert location.is_mapped is True
