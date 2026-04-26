# Environmental Monitoring (envmon) Architecture

The Environmental Monitoring (EM) application provides a spatial visualization of environmental inspection results across facility floor plans.

## 🏗️ System Design

The app follows a decoupled frontend-backend architecture, optimized for deployment on Databricks.

### Frontend
- **Framework:** React with Vite.
- **Mapping Engine:** **MapLibre GL JS** for rendering high-resolution floor plans and heatmaps.
- **State Management:** TanStack Query for caching and fetching backend data.
- **Key Components:**
    - `EnvMonGlobalMap`: The main entry point for the interactive facility map.
    - `CoordinateMapper`: An administrative tool for mapping inspection points to X/Y coordinates on the floor plan.
    - `AppShell`: Provides the overall layout and navigation.

### Backend
- **Framework:** FastAPI.
- **Data Access:** Asynchronous SQL queries against Databricks SQL Warehouse using `shared-db`.
- **Logic:**
    - `heatmap.py`: Calculates and generates heatmap data for inspection results.
    - `coordinates.py`: Manages the storage and retrieval of inspection point coordinates.
    - `floors.py`: Retrieves facility floor plan metadata and images.

## 🗺️ Mapping Strategy

The application uses a coordinate-based mapping system. Facility floor plans are stored as static images, and inspection points (represented by their location IDs) are overlaid at specific X/Y percentages. This ensures the map remains accurate regardless of screen size.

## 📊 Data Flow

1.  **Request:** The React frontend requests heatmap or trend data for a specific time range and facility.
2.  **Processing:** The FastAPI backend executes SQL queries against the `gold` schema in Unity Catalog.
3.  **Aggregation:** Data is aggregated by location and inspection type to generate the "health" score for each point.
4.  **Response:** The backend returns a JSON payload containing location IDs, coordinates, and health scores.
5.  **Visualization:** MapLibre GL JS renders the floor plan and overlays the health markers/heatmap based on the response.
