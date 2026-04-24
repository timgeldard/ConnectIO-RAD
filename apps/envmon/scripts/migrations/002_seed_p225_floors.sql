MERGE INTO `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_plant_floor` AS t
USING (
    SELECT 'P225' AS plant_id, 'F1' AS floor_id, 'Floor1' AS floor_name, '/assets/floor1.svg' AS svg_url, 1021.6 AS svg_width, 722.48 AS svg_height, 1 AS sort_order, CURRENT_TIMESTAMP() AS created_at
    UNION ALL
    SELECT 'P225', 'F2', 'Floor2', '/assets/floor2.svg', 1021.6, 722.48, 2, CURRENT_TIMESTAMP()
    UNION ALL
    SELECT 'P225', 'F3', 'Floor3', '/assets/floor3.svg', 1021.6, 722.48, 3, CURRENT_TIMESTAMP()
) AS s
ON t.plant_id = s.plant_id AND t.floor_id = s.floor_id
WHEN NOT MATCHED THEN INSERT (plant_id, floor_id, floor_name, svg_url, svg_width, svg_height, sort_order, created_at)
    VALUES (s.plant_id, s.floor_id, s.floor_name, s.svg_url, s.svg_width, s.svg_height, s.sort_order, s.created_at)
