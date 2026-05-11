"""Domain tests for Warehouse360 inventory management."""

from shared_domain import ValueObject, test_data
from warehouse360_backend.inventory_management.domain.plant_scope import PlantScope


def test_plant_scope_is_value_object_and_normalizes_text():
    plant = test_data.PLANTS[0]
    scope = PlantScope.from_optional(f" {plant} ")

    assert isinstance(scope, ValueObject)
    assert scope.plant_id == plant
    assert scope.is_single_plant is True


def test_plant_scope_blank_means_all_plants():
    scope = PlantScope.from_optional("  ")

    assert scope.plant_id is None
    assert scope.is_single_plant is False
