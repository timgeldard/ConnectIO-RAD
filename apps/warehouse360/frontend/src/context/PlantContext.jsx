import React from 'react';

const STORAGE_KEY = 'warehouse360:plant-id';
const FALLBACK_PLANTS = [{ plant_id: 'C061', plant_name: 'Kerry Naas' }];

const PlantContext = React.createContext({
  plants: FALLBACK_PLANTS,
  selectedPlantId: FALLBACK_PLANTS[0].plant_id,
  selectedPlant: FALLBACK_PLANTS[0],
  setSelectedPlantId: () => {},
  loading: false,
  error: null,
});

const normalisePlants = (rows) => {
  const plants = Array.isArray(rows) ? rows : [];
  return plants
    .map((plant) => ({
      plant_id: String(plant.plant_id ?? '').trim(),
      plant_name: String(plant.plant_name ?? plant.plant_id ?? '').trim(),
    }))
    .filter((plant) => plant.plant_id.length > 0);
};

const readStoredPlant = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const storePlant = (plantId) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, plantId);
  } catch {
    // Plant selection still works for this session when storage is unavailable.
  }
};

export const PlantProvider = ({ children }) => {
  const [plants, setPlants] = React.useState(FALLBACK_PLANTS);
  const [selectedPlantId, setSelectedPlantIdRaw] = React.useState(() => readStoredPlant() || FALLBACK_PLANTS[0].plant_id);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/plants')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        const nextPlants = normalisePlants(json?.plants);
        const availablePlants = nextPlants.length > 0 ? nextPlants : FALLBACK_PLANTS;
        setPlants(availablePlants);
        setSelectedPlantIdRaw((current) =>
          availablePlants.some((plant) => plant.plant_id === current)
            ? current
            : availablePlants[0].plant_id,
        );
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setPlants(FALLBACK_PLANTS);
        setSelectedPlantIdRaw((current) => current || FALLBACK_PLANTS[0].plant_id);
        setError(err.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const setSelectedPlantId = React.useCallback((plantId) => {
    setSelectedPlantIdRaw(plantId);
    storePlant(plantId);
  }, []);

  const selectedPlant = React.useMemo(
    () => plants.find((plant) => plant.plant_id === selectedPlantId) ?? plants[0] ?? FALLBACK_PLANTS[0],
    [plants, selectedPlantId],
  );

  const value = React.useMemo(() => ({
    plants,
    selectedPlantId: selectedPlant.plant_id,
    selectedPlant,
    setSelectedPlantId,
    loading,
    error,
  }), [plants, selectedPlant, setSelectedPlantId, loading, error]);

  return <PlantContext.Provider value={value}>{children}</PlantContext.Provider>;
};

export const usePlantSelection = () => React.useContext(PlantContext);
