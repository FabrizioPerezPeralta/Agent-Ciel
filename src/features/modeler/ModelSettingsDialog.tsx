import { useState, type FormEvent } from "react";
import { KeyRound, X } from "lucide-react";
import type { ProviderSettings, ProviderSettingsDraft } from "./provider-settings";

type Props = {
  settings: ProviderSettings;
  saving: boolean;
  error: string;
  onClose: () => void;
  onClearApiKey: () => void;
  onSave: (settings: ProviderSettingsDraft, apiKey: string) => void;
};

export function ModelSettingsDialog({ settings, saving, error, onClose, onClearApiKey, onSave }: Props) {
  const [draft, setDraft] = useState<ProviderSettingsDraft>({
    provider: settings.provider,
    ollamaUrl: settings.ollamaUrl,
    ollamaModel: settings.ollamaModel,
    openaiBaseUrl: settings.openaiBaseUrl,
    openaiModel: settings.openaiModel,
  });
  const [apiKey, setApiKey] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(draft, apiKey);
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="dialog-header">
          <div><span className="inspector-kicker">MOTOR DE GENERACIÓN</span><h2 id="settings-title">Configuración de IA</h2></div>
          <button type="button" className="dialog-close" aria-label="Cerrar configuración" onClick={onClose}><X size={17} /></button>
        </header>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="provider">Proveedor</label>
          <select id="provider" className="text-field" value={draft.provider} onChange={(event) => {
            const value = event.target.value;
            if (value === "ollama" || value === "openai-compatible") {
              setDraft((current) => ({ ...current, provider: value }));
            }
          }}>
            <option value="ollama">Ollama · local</option>
            <option value="openai-compatible">API compatible con OpenAI</option>
          </select>

          {draft.provider === "ollama" ? (
            <div className="provider-fields">
              <label className="field-label" htmlFor="ollama-url">Dirección de Ollama</label>
              <input id="ollama-url" className="text-field" type="url" required value={draft.ollamaUrl} onChange={(event) => setDraft((current) => ({ ...current, ollamaUrl: event.target.value }))} />
              <label className="field-label dialog-field-label" htmlFor="ollama-model">Modelo instalado</label>
              <input id="ollama-model" className="text-field" required maxLength={160} value={draft.ollamaModel} onChange={(event) => setDraft((current) => ({ ...current, ollamaModel: event.target.value }))} />
              <p className="dialog-help">El modelo debe estar descargado en Ollama y admitir respuestas JSON.</p>
            </div>
          ) : (
            <div className="provider-fields">
              <label className="field-label" htmlFor="openai-url">URL base de la API</label>
              <input id="openai-url" className="text-field" type="url" required value={draft.openaiBaseUrl} onChange={(event) => setDraft((current) => ({ ...current, openaiBaseUrl: event.target.value }))} />
              <label className="field-label dialog-field-label" htmlFor="openai-model">Nombre del modelo</label>
              <input id="openai-model" className="text-field" required maxLength={160} value={draft.openaiModel} onChange={(event) => setDraft((current) => ({ ...current, openaiModel: event.target.value }))} />
              <label className="field-label dialog-field-label" htmlFor="openai-key">Clave API</label>
              <div className="secret-field"><KeyRound size={14} /><input id="openai-key" type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={settings.hasApiKey ? "Clave guardada · vacío para conservarla" : "Pega tu clave API"} /></div>
              {settings.credentialStoreError ? <p className="dialog-error" role="alert">{settings.credentialStoreError}</p> : <p className="dialog-help">La clave se guarda en el almacén seguro del sistema, nunca en los ajustes ni en el frontend.</p>}
              {settings.hasApiKey && <button type="button" className="clear-key-button" onClick={onClearApiKey} disabled={saving}>Eliminar clave guardada</button>}
            </div>
          )}

          {error && <p className="dialog-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="export-button" disabled={saving}>{saving ? "Guardando..." : "Guardar configuración"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
