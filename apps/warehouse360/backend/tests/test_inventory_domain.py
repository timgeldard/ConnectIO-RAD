"""Domain tests for Warehouse360 inventory management."""

from shared_domain import ValueObject

from backend.inventory_management.domain.plant_scope import PlantScope


def test_plant_scope_is_value_object_and_normalizes_text():
    scope = PlantScope.from_optional(" IE01 ")

    assert isinstance(scope, ValueObject)
    assert scope.plant_id == "IE01"
    assert scope.is_single_plant is True


def test_plant_scope_blank_means_all_plants():
    scope = PlantScope.from_optional("  ")

    assert scope.plant_id is None
    assert scope.is_single_plant is False
