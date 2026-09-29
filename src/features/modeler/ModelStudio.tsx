import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import {
  Box,
  Check,
  ChevronDown,
  Circle,
  Command,
  Cylinder,
  Download,
  Layers3,
  MessageSquareText,
  Plus,
  RotateCcw,
  Ruler,
  Settings2,
  Shapes,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { basicPromptProvider } from "./model-generator";
import { ModelSettingsDialog } from "./ModelSettingsDialog";
import {
  createFeature,
  defaultModel,
  type BooleanOperation,
  type ModelFeature,
  type ModelSpec,
  type PrimitiveShape,
} from "./model.types";
import {
  clearApiKey,
  defaultProviderSettings,
  generateModelWithProvider,
  getProviderSettings,
  isTauri,
  saveProviderSettings,
  type ProviderSettings,
  type ProviderSettingsDraft,
} from "./provider-settings";
import { buildModelGeometry, exportModelAsStl } from "./model-geometry";

const shapeOptions: { value: PrimitiveShape; label: string; icon: typeof Box }[] = [
  { value: "box", label: "Caja", icon: Box },
  { value: "cylinder", label: "Cilindro", icon: Cylinder },
  { value: "sphere", label: "Esfera", icon: Circle },
  { value: "ellipsoid", label: "Elipsoide", icon: Shapes },
  { value: "cone", label: "Cono", icon: Shapes },
  { value: "torus", label: "Toroide", icon: Shapes },
  { value: "capsule", label: "Cápsula", icon: Shapes },
];

const operationLabels: Record<BooleanOperation, string> = {
  union: "Unir",
  subtract: "Restar (corte)",
  intersect: "Intersecar",
};

function ModelPreview({ model }: { model: ModelSpec }) {
  const result = useMemo(() => {
    try {
      const geometry = buildModelGeometry(model);
      geometry.computeBoundingBox();
      return { geometry, error: "" };
    } catch (cause) {
      return {
        geometry: null,
        error: cause instanceof Error ? cause.message : "No se pudo construir la vista previa.",
      };
    }
  }, [model.features]);
  const geometry = result.geometry;

  useEffect(() => () => geometry?.dispose(), [geometry]);

  const bounds = geometry?.boundingBox;
  const center = bounds?.getCenter(new Vector3());
  const size = bounds?.getSize(new Vector3());
  const viewSize = size ? Math.max(size.x, size.y, size.z, 1) : 50;
  const gridSize = Math.max(200, Math.ceil(viewSize * 2));
  const gridDivisions = Math.min(100, Math.max(20, Math.ceil(gridSize / 10)));

  return (
    <Canvas camera={{ position: [viewSize * 2.4, viewSize * 1.8, viewSize * 2.8], fov: 38 }} dpr={[1, 2]}>
      <color attach="background" args={["#10131d"]} />
      <ambientLight intensity={1.8} />
      <directionalLight position={[70, 90, 50]} intensity={3} />
      <directionalLight position={[-50, 20, -40]} intensity={1.2} color="#6b83ff" />
      {geometry && <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color="#8886ff" roughness={0.34} metalness={0.16} /></mesh>}
      {result.error
        ? <Html center><div className="preview-error">{result.error}</div></Html>
        : <>
            <gridHelper args={[gridSize, gridDivisions, "#39415d", "#252b3d"]} position={[0, bounds?.min.y ?? 0, 0]} />
            <OrbitControls
              makeDefault
              enableDamping
              target={center ? [center.x, center.y, center.z] : [0, 0, 0]}
              minDistance={viewSize * 0.8}
              maxDistance={viewSize * 10}
            />
          </>}
    </Canvas>
  );
}

export function ModelStudio() {
  const [model, setModel] = useState<ModelSpec>(defaultModel);
  const [selectedFeatureId, setSelectedFeatureId] = useState(defaultModel.features[0].id);
  const [viewKey, setViewKey] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<ProviderSettings>(defaultProviderSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [generating, setGenerating] = useState(false);
  const desktop = isTauri();
  const selectedFeature = model.features.find((feature) => feature.id === selectedFeatureId) ?? model.features[0];

  useEffect(() => {
    if (!desktop) return;
    void getProviderSettings()
      .then(setSettings)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, [desktop]);

  const generateFromPrompt = async () => {
    const request = prompt.trim();
    if (!request || generating) return;

    try {
      setGenerating(true);
      setError("");
      const nextModel = desktop
        ? await generateModelWithProvider(request, model)
        : await basicPromptProvider.generate(request, model);
      setModel(nextModel);
      setSelectedFeatureId(nextModel.features[0]?.id ?? "");
      setStatus(desktop
        ? `Modelo generado con ${settings.provider === "ollama" ? "Ollama" : "la API configurada"}. Puedes seleccionar piezas y editar la geometría.`
        : "Modelo base actualizado. En escritorio puedes describir composiciones más avanzadas con IA.");
      setPrompt("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo interpretar la descripción.");
    } finally {
      setGenerating(false);
    }
  };

  const saveSettings = async (draft: ProviderSettingsDraft, apiKey: string) => {
    try {
      setSavingSettings(true);
      setError("");
      const saved = await saveProviderSettings(draft, apiKey);
      setSettings(saved);
      setSettingsOpen(false);
      setStatus("Configuración del proveedor guardada.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la configuración.");
    } finally {
      setSavingSettings(false);
    }
  };

  const removeApiKey = async () => {
    try {
      setSavingSettings(true);
      setError("");
      await clearApiKey();
      setSettings((current) => ({ ...current, hasApiKey: false, credentialStoreError: null }));
      setStatus("Clave API eliminada del almacén seguro.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar la clave API.");
    } finally {
      setSavingSettings(false);
    }
  };

  const addFeature = (shape: PrimitiveShape) => {
    const feature = createFeature(shape);
    if (model.features.length === 0) feature.operation = "union";
    setModel((current) => ({ ...current, features: [...current.features, feature] }));
    setSelectedFeatureId(feature.id);
    setStatus("");
  };

  const updateFeature = <K extends keyof ModelFeature>(key: K, value: ModelFeature[K]) => {
    if (!selectedFeature) return;
    if (typeof value === "number") {
      const positionKeys: (keyof ModelFeature)[] = ["x", "y", "z"];
      const rotationKeys: (keyof ModelFeature)[] = ["rotationX", "rotationY", "rotationZ"];
      if (positionKeys.includes(key) && (value < -500 || value > 500)) return;
      if (rotationKeys.includes(key) && (value < -360 || value > 360)) return;
    }
    setModel((current) => ({
      ...current,
      features: current.features.map((feature) =>
        feature.id === selectedFeature.id ? { ...feature, [key]: value } : feature,
      ),
    }));
    setStatus("");
  };

  const updateDimension = (key: "width" | "depth" | "height", value: number) => {
    const minDimension = selectedFeature?.shape === "cone" && key === "depth" ? 0 : 0.2;
    if (!Number.isFinite(value) || value < minDimension || value > 1000 || !selectedFeature) return;
    const update: Partial<ModelFeature> = { [key]: value };
    if (selectedFeature.shape === "sphere") {
      update.width = value;
      update.depth = value;
      update.height = value;
    } else if ((selectedFeature.shape === "cylinder" || selectedFeature.shape === "capsule") && key === "width") {
      update.depth = value;
      if (selectedFeature.shape === "capsule") update.height = Math.max(value, selectedFeature.height);
    } else if (selectedFeature.shape === "torus") {
      if (key === "width") {
        update.depth = Math.min(selectedFeature.depth, value - 0.2);
        update.height = update.depth;
      }
      if (key === "depth") update.height = value;
    } else if (selectedFeature.shape === "capsule" && key === "height") {
      update.height = Math.max(value, selectedFeature.width);
    }
    setModel((current) => ({
      ...current,
      features: current.features.map((feature) =>
        feature.id === selectedFeature.id ? { ...feature, ...update } : feature,
      ),
    }));
    setStatus("");
  };

  const removeFeature = () => {
    if (!selectedFeature) return;
    const features = model.features.filter((feature) => feature.id !== selectedFeature.id);
    if (features.length) features[0] = { ...features[0], operation: "union" };
    setModel((current) => ({ ...current, features }));
    setSelectedFeatureId(features[0]?.id ?? "");
    setStatus("");
  };

  const exportStl = () => {
    try {
      setError("");
      const blob = exportModelAsStl(model);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${model.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/g, "").trim() || "pieza"}.stl`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setStatus("STL exportado y orientado con la base del modelo sobre la cama del laminador.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo exportar el archivo STL.");
    }
  };

  return (
    <main className="studio-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Ciel Taller, inicio">
          <span className="brand-mark"><Sparkles size={18} /></span>
          <span className="brand-name">ciel<span>taller</span></span>
        </a>
        <div className="workspace-label">ESPACIO DE DISEÑO</div>
        <button className="side-link active"><Layers3 size={17} /><span>Modelos</span><span className="side-count">{String(model.features.length).padStart(2, "0")}</span></button>
        <button className="side-link" disabled title="La importación de mallas se añadirá más adelante"><Upload size={17} /><span>Importar modelo</span><span className="coming-soon">PRONTO</span></button>
        <div className="sidebar-bottom">
          <div className="printer-card">
            <div className="printer-icon"><Settings2 size={17} /></div>
            <div><span className="printer-label">SIGUIENTE PASO</span><strong>Abrir en tu laminador</strong></div>
            <span className="available-dot" />
          </div>
          <div className="account"><div className="account-avatar">FP</div><div><strong>Fabrizio</strong><span>Espacio personal</span></div><ChevronDown size={15} /></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumbs"><span>Taller</span><span className="crumb-divider">/</span><strong>Nuevo modelo</strong></div>
          <div className="topbar-actions">
            <button className="provider-status" onClick={() => desktop && setSettingsOpen(true)} disabled={!desktop} title={desktop ? "Configurar el proveedor de IA" : "Los proveedores de IA están disponibles en la aplicación de escritorio"}>
              <span /> {desktop ? settings.provider === "ollama" ? "Ollama local" : "API compatible" : "Generador básico local"}
              {desktop && <Settings2 size={13} />}
            </button>
            <button className="export-button" onClick={exportStl}><Download size={16} /> Exportar STL</button>
          </div>
        </header>

        <div className="studio-content">
          <section className="prompt-panel">
            <div className="prompt-heading">
              <div className="prompt-icon"><MessageSquareText size={18} /></div>
              <div><h1>Diseña sin límites.</h1><p>Describe una pieza, figura o mecanismo; Ciel lo construye con sólidos combinables.</p></div>
              <span className="local-badge"><span /> {desktop ? "IA CONFIGURABLE" : "MODO BÁSICO"}</span>
            </div>
            <div className="prompt-composer">
              <textarea
                aria-label="Describe un modelo 3D"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void generateFromPrompt();
                  }
                }}
                placeholder="Ej.: un soporte en L de 60 x 40 mm con dos agujeros para tornillos..."
                rows={2}
              />
              <div className="prompt-footer">
                <span><Command size={12} /> Intro para crear · Shift + Intro para nueva línea</span>
                <button className="generate-button" onClick={() => void generateFromPrompt()} disabled={!prompt.trim() || generating}>
                  <Sparkles size={15} /> {generating ? "Generando..." : "Crear modelo"}
                </button>
              </div>
            </div>
            <div className="prompt-hint"><span>Prueba</span><button onClick={() => setPrompt("Un soporte en L de 60 x 40 mm con dos agujeros para tornillos M5")}>Soporte con agujeros</button><button onClick={() => setPrompt("Una figura de un pequeño robot con cuerpo, cabeza, dos brazos y dos piernas articulados")}>Figura articulada</button><button onClick={() => setPrompt("Una maceta cilíndrica de 80 mm de alto con paredes de 3 mm")}>Objeto hueco</button></div>
          </section>

          <section className="model-layout">
            <div className="viewport-panel">
              <div className="viewport-toolbar">
                <div className="viewport-title"><span className="live-dot" /><strong>Vista previa</strong><span className="view-tag">3D</span><span className="component-count">{model.features.length} formas</span></div>
                <div className="viewport-actions"><span>Arrastra para orbitar · rueda para zoom</span><button aria-label="Restablecer vista" title="Restablecer vista" onClick={() => setViewKey((current) => current + 1)}><RotateCcw size={15} /></button></div>
              </div>
              <div className="viewport"><ModelPreview key={viewKey} model={model} /></div>
              <div className="viewport-footer"><span><span className="scale-dot" /> Vista en milímetros</span><span>Arrastrar · orbitar&nbsp;&nbsp; Shift + arrastrar · desplazar</span></div>
            </div>

            <aside className="inspector">
              <div className="inspector-heading"><div><span className="inspector-kicker">INSPECTOR</span><h2>Ensamblaje</h2></div><Ruler size={17} /></div>
              <label className="field-label" htmlFor="model-name">Nombre del modelo</label>
              <input id="model-name" className="text-field" maxLength={80} value={model.name} onChange={(event) => setModel((current) => ({ ...current, name: event.target.value }))} />

              <div className="feature-list-heading"><span className="field-label">Formas y operaciones</span><span>{model.features.length}/32</span></div>
              <div className="feature-list">
                {model.features.map((feature, index) => (
                  <button key={feature.id} className={`feature-row ${feature.id === selectedFeature?.id ? "selected" : ""}`} onClick={() => setSelectedFeatureId(feature.id)}>
                    <span className="feature-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="feature-row-label"><strong>{shapeOptions.find((item) => item.value === feature.shape)?.label}</strong><small>{index === 0 ? "Base" : operationLabels[feature.operation]}</small></span>
                  </button>
                ))}
              </div>
              <div className="add-feature-controls">
                <span className="field-label">Añadir forma</span>
                <div className="add-feature-grid">
                  {shapeOptions.map(({ value, label, icon: Icon }) => <button key={value} title={`Añadir ${label.toLowerCase()}`} aria-label={`Añadir ${label.toLowerCase()}`} disabled={model.features.length >= 32} onClick={() => addFeature(value)}><Plus size={11} /><Icon size={14} /></button>)}
                </div>
              </div>

              {selectedFeature && <>
                <div className="selected-feature-heading">
                  <span className="field-label">{shapeOptions.find((item) => item.value === selectedFeature.shape)?.label} · medidas</span>
                  {model.features.length > 1 && <button className="remove-feature-button" aria-label="Eliminar forma seleccionada" title="Eliminar forma" onClick={removeFeature}><Trash2 size={13} /></button>}
                </div>
                {model.features[0].id !== selectedFeature.id && (
                  <label className="field-label operation-label" htmlFor="feature-operation">Operación booleana</label>
                )}
                {model.features[0].id !== selectedFeature.id && (
                  <select id="feature-operation" className="text-field operation-select" value={selectedFeature.operation} onChange={(event) => {
                    const value = event.target.value;
                    if (value === "union" || value === "subtract" || value === "intersect") updateFeature("operation", value);
                  }}>
                    {Object.entries(operationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                )}
                <div className="dimensions-heading"><span className="field-label">Dimensiones</span><span>mm</span></div>
                <div className="dimension-fields">
                  <DimensionField label={selectedFeature.shape === "cone" ? "Base Ø" : selectedFeature.shape === "torus" ? "Exterior Ø" : selectedFeature.shape === "box" || selectedFeature.shape === "ellipsoid" ? "Ancho" : "Diámetro"} value={selectedFeature.width} onChange={(value) => updateDimension("width", value)} />
                  {["box", "ellipsoid"].includes(selectedFeature.shape) && <DimensionField label="Fondo" value={selectedFeature.depth} onChange={(value) => updateDimension("depth", value)} />}
                  {selectedFeature.shape === "cone" && <DimensionField label="Punta Ø" value={selectedFeature.depth} onChange={(value) => updateDimension("depth", value)} min={0} />}
                  {selectedFeature.shape === "torus" && <DimensionField label="Grosor" value={selectedFeature.depth} onChange={(value) => updateDimension("depth", value)} />}
                  {selectedFeature.shape !== "sphere" && selectedFeature.shape !== "torus" && <DimensionField label={selectedFeature.shape === "capsule" ? "Alto total" : "Alto"} value={selectedFeature.height} onChange={(value) => updateDimension("height", value)} />}
                </div>
                <span className="field-label transform-label">Posición · mm</span>
                <div className="dimension-fields transform-fields">
                  <DimensionField label="X" value={selectedFeature.x} onChange={(value) => updateFeature("x", value)} min={-500} max={500} />
                  <DimensionField label="Y" value={selectedFeature.y} onChange={(value) => updateFeature("y", value)} min={-500} max={500} />
                  <DimensionField label="Z" value={selectedFeature.z} onChange={(value) => updateFeature("z", value)} min={-500} max={500} />
                </div>
                <details className="rotation-details">
                  <summary>Rotación avanzada · grados</summary>
                  <div className="dimension-fields transform-fields">
                    <DimensionField label="X" value={selectedFeature.rotationX} onChange={(value) => updateFeature("rotationX", value)} min={-360} max={360} />
                    <DimensionField label="Y" value={selectedFeature.rotationY} onChange={(value) => updateFeature("rotationY", value)} min={-360} max={360} />
                    <DimensionField label="Z" value={selectedFeature.rotationZ} onChange={(value) => updateFeature("rotationZ", value)} min={-360} max={360} />
                  </div>
                </details>
              </>}

              <div className="print-summary">
                <div className="summary-heading"><span className="summary-check"><Check size={12} /></span><strong>Geometría combinada</strong></div>
                <p>Une formas, crea huecos por sustracción e interseca volúmenes para piezas funcionales u orgánicas.</p>
                <div className="summary-meta"><span>FORMAS</span><strong>{model.features.length} / 32</strong></div>
              </div>
            </aside>
          </section>

          <div className={`notice ${error ? "error" : ""}`} role={error ? "alert" : "status"}>
            {error || status || (desktop ? "Describe la forma final y la IA construirá una composición de sólidos. Selecciona piezas para ajustar posición, dimensiones y operaciones." : "Modo navegador: crea y combina formas desde el inspector. La generación con IA requiere la aplicación de escritorio.")}
          </div>
          <footer className="studio-footer"><span><span className="footer-status" /> En sesión · {desktop ? settings.provider === "openai-compatible" ? "descripción enviada a la API configurada" : "generación local mediante Ollama" : "generación básica en el navegador"}</span><span>Exporta el STL y continúa en tu laminador 3D</span></footer>
        </div>
      </section>
      {settingsOpen && <ModelSettingsDialog settings={settings} saving={savingSettings} error={error} onClose={() => setSettingsOpen(false)} onClearApiKey={() => void removeApiKey()} onSave={(draft, apiKey) => void saveSettings(draft, apiKey)} />}
    </main>
  );
}

function DimensionField({ label, value, onChange, min = 0.2, max = 1000 }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number }) {
  return (
    <label className="dimension-field">
      <span>{label}</span>
      <div><input type="number" min={min} max={max} step="0.1" value={value} onChange={(event) => onChange(Number(event.target.value))} /><span>{label.length === 1 ? "" : "mm"}</span></div>
    </label>
  );
}
