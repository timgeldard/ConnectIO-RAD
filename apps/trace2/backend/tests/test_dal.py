import pytest
from unittest.mock import AsyncMock, patch
from shared_domain import test_data
import trace2_backend.dal.trace_dal as dal

@pytest.mark.asyncio
async def test_fetch_batch_header():
    mat_id = test_data.material_id()
    b_id = test_data.batch_id()
    po_id = test_data.process_order()
    plant = test_data.PLANTS[0]
    mock_rows = [{
        "material_id": mat_id,
        "batch_id": b_id,
        "material_name": "Mat 1",
        "material_desc40": "Mat 1 Desc",
        "process_order": po_id,
        "plant_id": plant,
        "plant_name": "Plant 1",
        "manufacture_date": "2024-01-01",
        "expiry_date": "2025-01-01",
        "days_to_expiry": 365,
        "shelf_life_status": "OK",
        "uom": "KG",
        "qty_produced": 1000.0,
        "qty_shipped": 500.0,
        "qty_consumed": 0.0,
        "qty_adjusted": 0.0,
        "current_stock": 500.0,
        "unrestricted": 500.0,
        "blocked": 0.0,
        "qi": 0.0,
        "restricted": 0.0,
        "transit": 0.0,
        "customers_affected": 5,
        "countries_affected": 2,
        "total_shipped_kg": 500.0,
        "total_deliveries": 10,
        "consuming_pos": 0,
        "batch_status": "UNRESTRICTED"
    }]
    
    with patch("trace2_backend.dal.trace_dal._trace_core_dal.run_sql_async", new_callable=AsyncMock) as mock_sql:
        mock_sql.return_value = mock_rows
        
        result = await dal.fetch_batch_header("fake-token", mat_id, b_id)
        
        assert result == mock_rows[0]
        assert mock_sql.called

@pytest.mark.asyncio
async def test_fetch_recall_readiness():
    mat_id = test_data.material_id()
    b_id = test_data.batch_id()
    async def mock_sql_fn(token, sql, params=None, **kwargs):
        if "FROM" in sql and "gold_batch_delivery_mat" in sql:
            return [{"COUNTRY_ID": "US", "name": "USA", "qty": 100.0, "deliveries": 5}]
        if "FROM" in sql and "gold_batch_lineage" in sql:
            return [{"material_id": mat_id, "batch_id": b_id, "risk": "CRITICAL"}]
        # Default header-like response
        return [{"material_id": mat_id, "batch_id": b_id}]

    with patch("trace2_backend.dal.trace_dal._trace_core_dal.run_sql_async", side_effect=mock_sql_fn):
        result = await dal.fetch_recall_readiness("fake-token", mat_id, b_id)
        
        assert "header" in result
        assert "countries" in result
        assert "exposure" in result
        assert len(result["countries"]) == 1
        assert result["countries"][0]["COUNTRY_ID"] == "US"

@pytest.mark.asyncio
async def test_fetch_coa():
    mat_id = test_data.material_id()
    b_id = test_data.batch_id()
    mic = test_data.mic_id()
    with patch("trace2_backend.dal.trace_dal._trace_core_dal.run_sql_async", new_callable=AsyncMock) as mock_sql:
        mock_sql.side_effect = [
            [{"material_id": mat_id, "batch_id": b_id}], # Header
            [{"mic_code": mic, "mic_name": "MIC 1", "actual_result": "9.5"}] # Results
        ]
        
        result = await dal.fetch_coa("fake-token", mat_id, b_id)
        
        assert result["header"]["material_id"] == mat_id
        assert len(result["results"]) == 1
        assert result["results"][0]["mic_code"] == mic
