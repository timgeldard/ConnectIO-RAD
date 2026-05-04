# DDD Aggregate Walkthrough — Complex Domain Models

This document is the Phase 4 substitute for an in-person code review session. It walks through the most complex aggregates and value objects in the codebase, explains the invariant decisions, and highlights patterns to follow when adding new domain logic.

---

## 1. `Batch` Aggregate Root (`libs/shared-trace`)

**File:** `libs/shared-trace/src/shared_trace/domain/models.py`

### Why it is an Aggregate Root, not just a value object

`Batch` has a mutable lifecycle — its `release_status` changes over time as quality decisions are made. An aggregate root is the right pattern here because:

- It has a stable identity (`BatchIdentity`) that persists across status changes.
- It protects a consistency boundary: the invariant "an expired batch cannot be released without override" must be enforced on every status transition, regardless of which caller triggers it.
- It owns domain events (via `AggregateRoot.register_event`) if a future phase adds event-sourced audit trails.

### The composite identity pattern

```python
@dataclass(frozen=True)
class BatchIdentity(ValueObject):
    material_id: MaterialId
    batch_id: BatchId
```

`BatchIdentity` is a value object used as the identity type parameter for `Batch(AggregateRoot[BatchIdentity])`. This lets the identity itself carry validation — `MaterialId` and `BatchId` both enforce non-blank, max-length constraints in `__new__`, so an invalid identity cannot be constructed.

Consequence: code that constructs a `BatchIdentity` from raw strings gets validation for free without any caller needing to remember to call a validate function:

```python
# This raises BusinessRuleValidationException immediately if either string is blank or too long
identity = BatchIdentity.from_strings(material_id=row["MATNR"], batch_id=row["CHARG"])
```

### The expiry guard in `update_status`

```python
def update_status(self, new_status: str) -> None:
    if self.is_expired and new_status.upper() in ["RELEASED", "ACCEPTED"]:
        raise BusinessRuleValidationException("Cannot release an expired batch without override")
    self._release_status = new_status
```

Two subtle points:

1. `new_status.upper()` is called inside the guard, not at storage time. The stored `_release_status` preserves whatever casing the upstream system uses. The guard is case-insensitive; the stored value is not normalized. This is intentional — the source system (SAP) uses its own status codes, and forcing normalization would break round-trip fidelity.

2. The expiry check uses `datetime.now(self.expiration_date.tzinfo)` when the stored expiry is timezone-aware, and `datetime.now()` (naive) when it is not. This handles both SAP systems that include timezone offsets and those that store dates in local plant time without UTC offset. Mixing aware and naive datetimes in Python raises a `TypeError`, so this guard prevents a runtime crash.

### What is deliberately NOT in the Batch aggregate

- No plant name, description, or metadata — those belong to lookup tables, not the aggregate.
- No lineage — batch-to-batch relationships are a read-model concern, not an aggregate invariant.
- No quality results — those are in a separate `InspectionLot` aggregate within the `inspection_analysis` context.

---

## 2. `LocationCoordinate` Value Object (`apps/envmon`)

**File:** `apps/envmon/backend/spatial_config/domain/coordinate.py`

### Why percentage coordinates, not pixel coordinates

Floor plan SVGs are displayed at different sizes on different screens and zoom levels. Storing pixel coordinates would require recalculation every time the display size changes. Storing X/Y as percentages of the SVG viewport dimensions makes the mapping resolution-independent:

```
pixel_x = x_pct × svg_width / 100
pixel_y = y_pct × svg_height / 100
```

The frontend performs this calculation; the backend stores and validates only percentages.

### Why the invariant is enforced at construction, not at the router

```python
def __post_init__(self) -> None:
    if not (0.0 <= self.x_pct <= 100.0):
        raise ValueError(f"x_pct must be 0–100, got {self.x_pct}")
```

The router constructs a `LocationCoordinate` from the request body before calling any application service:

```python
# In spatial_config/router.py
coord = LocationCoordinate(
    func_loc_id=body.func_loc_id,
    floor_id=body.floor_id,
    x_pct=body.x_pct,
    y_pct=body.y_pct,
)
# FastAPI maps ValueError → 422 Unprocessable Entity automatically
```

This means the DAL never receives invalid coordinates. The SQL `UPDATE` never runs. The database never needs to store a constraint for this rule. And the test for the invariant is a pure unit test with no database or HTTP stack:

```python
with pytest.raises(ValueError, match="x_pct must be 0–100"):
    LocationCoordinate(func_loc_id="X", floor_id="F1", x_pct=101.0, y_pct=50.0)
```

### Value-based equality

Because `LocationCoordinate` is a frozen dataclass inheriting from `ValueObject`, two coordinates with the same fields are equal:

```python
a = LocationCoordinate(func_loc_id="X", floor_id="F1", x_pct=50.0, y_pct=25.0)
b = LocationCoordinate(func_loc_id="X", floor_id="F1", x_pct=50.0, y_pct=25.0)
assert a == b  # True — same attributes, same value
```

This allows coordinates to be compared in tests and used in sets without any custom `__eq__`.

---

## 3. `Entity.__eq__` — The Symmetry Requirement

**File:** `libs/shared-domain/src/shared_domain/models.py`

### The bug that was fixed (and why it matters)

The original implementation used `isinstance`:

```python
# Before — asymmetric across inheritance hierarchies
def __eq__(self, other: Any) -> bool:
    if not isinstance(other, type(self)):
        return False
    return self._identity == other.identity
```

The problem: `isinstance(other, type(self))` is asymmetric when one class inherits from the other.

```python
class Animal(Entity[str]): pass
class Dog(Animal): pass

dog = Dog("rex")
animal = Animal("rex")

dog == animal   # isinstance(animal, Dog) → False ✓
animal == dog   # isinstance(dog, Animal) → True ✗ — different result!
```

Python's data model requires `a == b` to give the same result as `b == a`. Violating this breaks sets and dicts silently: `{dog, animal}` may have 1 or 2 elements depending on insertion order.

The fix uses strict type identity:

```python
# After — symmetric
def __eq__(self, other: Any) -> bool:
    if type(other) is not type(self):
        return False
    return self._identity == other.identity
```

Now `dog == animal` and `animal == dog` both return `False`, and `dog == dog` returns `True`. The equality contract holds.

### When to use `isinstance` vs `type(x) is`

- Use `isinstance` for capability checks: "does this object support this interface?" For example, `isinstance(x, Iterable)` in application code that handles multiple input types.
- Use `type(x) is` for identity checks: "are these two objects the same kind of thing?" In `__eq__`, you want strict type identity so that equality is symmetric across the class hierarchy.

---

## 4. Write Path Invariant Enforcement — The General Pattern

All write paths in the migrated apps follow the same sequence:

```
Router receives request body (Pydantic model)
  → Constructs domain value object (raises ValueError on invalid input)
  → FastAPI maps ValueError → 422 before any application code runs
  → Application service receives validated domain object
  → DAL receives validated data, executes SQL
```

The key insight is that validation is **structural**, not procedural. You do not call a `validate()` method after construction — you make invalid states unrepresentable by putting invariants in `__init__` or `__post_init__`. If a `LocationCoordinate` exists at all, its coordinates are valid. If a `BatchId` exists at all, it is non-blank and within length.

This pattern means:
- Application services and DAL functions can trust their inputs without defensive checks.
- Tests for business rules are pure unit tests: no mocking, no HTTP client, no database.
- Invariant violations surface at the outermost layer (the router) with a clear 422 before any SQL executes.

---

## 5. Bounded Context Cross-Talk — The Approved Pattern

`envmon/inspection_analysis` needs location coordinate data owned by `spatial_config`. The approved cross-context pattern:

```python
# In inspection_analysis/application/queries.py
from backend.spatial_config.application import queries as spatial_queries

async def get_location_summary(token, plant_id, func_loc_id, reference_date):
    meta, mic_rows, lot_rows = await asyncio.gather(
        spatial_queries.get_location_coordinate(token, plant_id, func_loc_id),
        ...
    )
```

What is NOT allowed:

```python
# Forbidden — cross-context DAL access
from backend.spatial_config.dal import coordinates as coord_dal
rows = await coord_dal.fetch_coordinate(token, plant_id, func_loc_id)
```

The rule is: **one context's application layer may call another context's application layer, never its DAL**. This keeps SQL ownership in the owning context. If `spatial_config` changes its SQL schema, only `spatial_config/dal` and `spatial_config/application` need to change — `inspection_analysis` is shielded.
