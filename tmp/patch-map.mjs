import { readFileSync, writeFileSync } from 'fs';

const path = 'src/pages/SentinelaDashboard.tsx';
let content = readFileSync(path, 'utf8');

// Fix 1: Add try-catch around L.latLngBounds in MapController
const oldMapController = `  useEffect(() => {
    if (eventos.length === 0 && userPos) {
      map.flyTo(userPos, 11, { duration: 1.5 });
    } else if (eventos.length > 0) {
      const bounds = L.latLngBounds(
        eventos.map((e) => [e.lat, e.lon] as [number, number])
      );
      if (userPos) bounds.extend(userPos);
      map.fitBounds(bounds, { padding: [60, 60], duration: 1.2 });
    } else if (centro) {
      map.flyTo(centro, 10, { duration: 1.5 });
    }
  }, [eventos, userPos, centro, map]);`;

const newMapController = `  useEffect(() => {
    try {
      if (eventos.length === 0 && userPos) {
        map.flyTo(userPos, 11, { duration: 1.5 });
      } else if (eventos.length > 0) {
        const coords = eventos
          .map((e) => [e.lat, e.lon] as [number, number])
          .filter(([lat, lon]) => typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon));
        if (coords.length > 0) {
          const bounds = L.latLngBounds(coords);
          if (userPos) bounds.extend(userPos);
          map.fitBounds(bounds, { padding: [60, 60], duration: 1.2 });
        } else if (userPos) {
          map.flyTo(userPos, 10, { duration: 1.5 });
        }
      } else if (centro) {
        map.flyTo(centro, 10, { duration: 1.5 });
      }
    } catch (e) {
      console.warn('[MapController] Erro ao ajustar bounds do mapa:', e);
      if (userPos) map.flyTo(userPos, 10, { duration: 1 });
    }
  }, [eventos, userPos, centro, map]);`;

if (content.includes(oldMapController)) {
  content = content.replace(oldMapController, newMapController);
  console.log('✓ MapController patched');
} else {
  console.log('⚠ MapController pattern not found, searching alternatives...');
  // Try to find the pattern
  const idx = content.indexOf('L.latLngBounds');
  if (idx >= 0) {
    console.log('  L.latLngBounds found at char', idx);
    console.log('  Context:', content.substring(idx - 50, idx + 100));
  }
}

// Fix 2: Add validation to SafeCircle
const oldSafeCircle = `function SafeCircle({ center, radius }: { center: [number, number]; radius: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  if (!ready) return null;
  return (
    <Circle
      key={\`sc-\${center[0].toFixed(2)}-\${center[1].toFixed(2)}-\${radius}\`}
      center={center}
      radius={radius}
      pathOptions={{
        color: "#6366f1",
        fillColor: "#6366f1",
        fillOpacity: 0.12,
        weight: 2,
        dashArray: "6 6",
      }}
    />
  );
}`;

const newSafeCircle = `function SafeCircle({ center, radius }: { center: [number, number]; radius: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  if (!ready) return null;
  // Valida coordenadas antes de renderizar
  if (!center || !Array.isArray(center) || center.length < 2 ||
      typeof center[0] !== 'number' || typeof center[1] !== 'number' ||
      isNaN(center[0]) || isNaN(center[1])) {
    return null;
  }
  return (
    <Circle
      key={\`sc-\${Number(center[0]).toFixed(2)}-\${Number(center[1]).toFixed(2)}-\${radius}\`}
      center={[Number(center[0]), Number(center[1])]}
      radius={radius}
      pathOptions={{
        color: "#6366f1",
        fillColor: "#6366f1",
        fillOpacity: 0.12,
        weight: 2,
        dashArray: "6 6",
      }}
    />
  );
}`;

if (content.includes(oldSafeCircle)) {
  content = content.replace(oldSafeCircle, newSafeCircle);
  console.log('✓ SafeCircle patched');
} else {
  console.log('⚠ SafeCircle pattern not found');
  // Check if the function exists differently
  const idx = content.indexOf('function SafeCircle');
  if (idx >= 0) {
    console.log('  SafeCircle found at char', idx);
    console.log('  Context:', content.substring(idx, idx + 300));
  }
}

writeFileSync(path, content);
console.log('✓ File saved');
