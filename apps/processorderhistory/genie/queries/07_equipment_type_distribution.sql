-- Instrument master distribution by derived equipment type
-- Answers: "How many instruments do we have by type?" / "What is the equipment breakdown?"
--
-- IMPORTANT: EQUIPMENT_TYPE does not exist as a column in vw_gold_instrument.
-- The mapping from EQUIPMENT_SUB_TYPE to a human-readable type is done here
-- via a CASE expression. This mirrors the Python _aggregate_by_type logic in
-- the equipment_insights_dal.py backend.

SELECT
  CASE
    WHEN i.EQUIPMENT_SUB_TYPE IN ('Fixed', 'Mobile', 'Mobile-FixBin', 'ZIBC')
      THEN 'Vessel'
    WHEN i.EQUIPMENT_SUB_TYPE IN ('Connected Scale', 'Manual Scale')
      THEN 'Scale'
    WHEN i.EQUIPMENT_SUB_TYPE IN ('Bucket', 'Buckets', 'CCP Screen', 'Other', 'Pump')
      THEN 'Auxiliary Equipment'
    ELSE 'Uncategorised'
  END                                                         AS equipment_type,
  COUNT(*)                                                    AS instrument_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1)         AS pct_of_total
FROM connected_plant_prod.csm_equipment_history.vw_gold_instrument i
WHERE i.PLANT_ID = :plant_id    -- remove to see all plants
GROUP BY equipment_type
ORDER BY instrument_count DESC
