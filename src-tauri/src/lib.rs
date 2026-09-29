#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use keyring::Entry;
use reqwest::{header, Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{collections::HashSet, fs, path::PathBuf, time::Duration};
use tauri::Manager;

const KEYRING_SERVICE: &str = "dev.ciel.desktop";
const KEYRING_USER: &str = "openai-compatible-api-key";
const MAX_MODEL_DIMENSION_MM: f64 = 1000.0;

#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
enum ModelProvider {
    Ollama,
    OpenAiCompatible,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ProviderSettings {
    provider: ModelProvider,
    ollama_url: String,
    ollama_model: String,
    openai_base_url: String,
    openai_model: String,
}

impl Default for ProviderSettings {
    fn default() -> Self {
        Self {
            provider: ModelProvider::Ollama,
            ollama_url: "http://localhost:11434".into(),
            ollama_model: "qwen2.5:7b".into(),
            openai_base_url: "https://api.openai.com/v1".into(),
            openai_model: "gpt-4o-mini".into(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderSettingsResponse {
    #[serde(flatten)]
    settings: ProviderSettings,
    has_api_key: bool,
    credential_store_error: Option<String>,
}

#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum PrimitiveShape {
    Box,
    Cylinder,
    Sphere,
    Ellipsoid,
    Cone,
    Torus,
    Capsule,
}

#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum BooleanOperation {
    Union,
    Subtract,
    Intersect,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ModelFeature {
    id: String,
    shape: PrimitiveShape,
    operation: BooleanOperation,
    width: f64,
    depth: f64,
    height: f64,
    x: f64,
    y: f64,
    z: f64,
    rotation_x: f64,
    rotation_y: f64,
    rotation_z: f64,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ModelSpec {
    name: String,
    features: Vec<ModelFeature>,
}

#[derive(Deserialize)]
struct OllamaChatResponse {
    message: OllamaMessage,
}

#[derive(Deserialize)]
struct OllamaMessage {
    content: String,
}

#[derive(Deserialize)]
struct OpenAiChatResponse {
    choices: Vec<OpenAiChoice>,
}

#[derive(Deserialize)]
struct OpenAiChoice {
    message: OpenAiMessage,
}

#[derive(Deserialize)]
struct OpenAiMessage {
    content: Option<String>,
}

#[tauri::command]
fn toggle_compact_window(window: tauri::Window) -> Result<(), String> {
    let is_decorated = window.is_decorated().map_err(|error| error.to_string())?;
    window
        .set_decorations(!is_decorated)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_always_on_top(window: tauri::Window, enabled: bool) -> Result<(), String> {
    window
        .set_always_on_top(enabled)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_provider_settings(app: tauri::AppHandle) -> Result<ProviderSettingsResponse, String> {
    let settings = read_provider_settings(&app)?;
    let (has_api_key, credential_store_error) = match read_api_key() {
        Ok(key) => (key.is_some(), None),
        Err(error) => (false, Some(error)),
    };

    Ok(ProviderSettingsResponse {
        settings,
        has_api_key,
        credential_store_error,
    })
}

#[tauri::command]
fn save_provider_settings(
    app: tauri::AppHandle,
    settings: ProviderSettings,
    api_key: Option<String>,
) -> Result<ProviderSettingsResponse, String> {
    validate_provider_settings(&settings)?;
    if let Some(key) = api_key.filter(|value| !value.trim().is_empty()) {
        credential_entry()?.set_password(&key).map_err(|error| {
            format!("No se pudo guardar la clave en el almacén seguro del sistema: {error}")
        })?;
    }

    let path = settings_path(&app)?;
    let directory = path
        .parent()
        .ok_or_else(|| "No se pudo determinar la carpeta de configuración.".to_string())?;
    fs::create_dir_all(directory)
        .map_err(|error| format!("No se pudo crear la carpeta de configuración: {error}"))?;
    let serialized = serde_json::to_vec_pretty(&settings)
        .map_err(|error| format!("No se pudo serializar la configuración: {error}"))?;
    fs::write(path, serialized)
        .map_err(|error| format!("No se pudo guardar la configuración: {error}"))?;

    get_provider_settings(app)
}

#[tauri::command]
fn clear_api_key() -> Result<(), String> {
    match credential_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!(
            "No se pudo eliminar la clave del almacén seguro del sistema: {error}"
        )),
    }
}

#[tauri::command]
async fn generate_model(
    app: tauri::AppHandle,
    prompt: String,
    current_model: ModelSpec,
) -> Result<ModelSpec, String> {
    let prompt = prompt.trim();
    if prompt.is_empty() {
        return Err("Escribe una descripción para generar el modelo.".into());
    }
    if prompt.chars().count() > 4000 {
        return Err("La descripción no puede superar los 4000 caracteres.".into());
    }
    validate_model(&current_model)?;

    let settings = read_provider_settings(&app)?;
    let client = Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|error| format!("No se pudo preparar la conexión con el proveedor: {error}"))?;

    let generated = match settings.provider {
        ModelProvider::Ollama => generate_with_ollama(&client, &settings, prompt).await?,
        ModelProvider::OpenAiCompatible => {
            generate_with_openai_compatible(&client, &settings, prompt).await?
        }
    };
    validate_model(&generated)?;
    Ok(generated)
}

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("No se pudo localizar la carpeta de configuración: {error}"))?;
    Ok(directory.join("provider-settings.json"))
}

fn read_provider_settings(app: &tauri::AppHandle) -> Result<ProviderSettings, String> {
    let path = settings_path(app)?;
    let contents = match fs::read(path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(ProviderSettings::default());
        }
        Err(error) => return Err(format!("No se pudo leer la configuración: {error}")),
    };
    let settings: ProviderSettings = serde_json::from_slice(&contents)
        .map_err(|error| format!("La configuración guardada no es válida: {error}"))?;
    validate_provider_settings(&settings)?;
    Ok(settings)
}

fn validate_provider_settings(settings: &ProviderSettings) -> Result<(), String> {
    validate_endpoint(&settings.ollama_url, "La dirección de Ollama")?;
    validate_endpoint(&settings.openai_base_url, "La dirección de la API")?;
    validate_model_name(&settings.ollama_model, "El modelo de Ollama")?;
    validate_model_name(&settings.openai_model, "El modelo de la API")
}

fn validate_endpoint(value: &str, label: &str) -> Result<(), String> {
    let endpoint = Url::parse(value.trim())
        .map_err(|_| format!("{label} debe ser una URL HTTP o HTTPS válida."))?;
    if !matches!(endpoint.scheme(), "http" | "https")
        || endpoint.host_str().is_none()
        || !endpoint.username().is_empty()
        || endpoint.password().is_some()
        || endpoint.query().is_some()
        || endpoint.fragment().is_some()
    {
        return Err(format!(
            "{label} debe usar HTTP/HTTPS y no incluir credenciales, parámetros ni fragmentos."
        ));
    }
    Ok(())
}

fn validate_model_name(value: &str, label: &str) -> Result<(), String> {
    let name = value.trim();
    if name.is_empty() || name.chars().count() > 160 {
        return Err(format!("{label} debe tener entre 1 y 160 caracteres."));
    }
    Ok(())
}

fn credential_entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|error| format!("No se pudo abrir el almacén seguro del sistema: {error}"))
}

fn read_api_key() -> Result<Option<String>, String> {
    match credential_entry()?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!(
            "No se pudo acceder al almacén seguro del sistema: {error}"
        )),
    }
}

async fn generate_with_ollama(
    client: &Client,
    settings: &ProviderSettings,
    prompt: &str,
) -> Result<ModelSpec, String> {
    let endpoint = format!("{}/api/chat", settings.ollama_url.trim_end_matches('/'));
    let response = client
        .post(endpoint)
        .json(&json!({
            "model": settings.ollama_model,
            "stream": false,
            "format": "json",
            "messages": [
                { "role": "system", "content": model_system_prompt() },
                { "role": "user", "content": prompt }
            ]
        }))
        .send()
        .await
        .map_err(|error| format!("No se pudo conectar con Ollama: {error}"))?;
    ensure_success(response.status().as_u16(), "Ollama")?;
    let result = response
        .json::<OllamaChatResponse>()
        .await
        .map_err(|error| format!("Ollama devolvió una respuesta JSON inválida: {error}"))?;
    parse_model_response(&result.message.content)
}

async fn generate_with_openai_compatible(
    client: &Client,
    settings: &ProviderSettings,
    prompt: &str,
) -> Result<ModelSpec, String> {
    let endpoint = format!(
        "{}/chat/completions",
        settings.openai_base_url.trim_end_matches('/')
    );
    let mut request = client
        .post(endpoint)
        .header(header::CONTENT_TYPE, "application/json")
        .json(&json!({
            "model": settings.openai_model,
            "stream": false,
            "response_format": { "type": "json_object" },
            "messages": [
                { "role": "system", "content": model_system_prompt() },
                { "role": "user", "content": prompt }
            ]
        }));

    if let Some(api_key) = read_api_key()? {
        request = request.bearer_auth(api_key);
    }

    let response = request.send().await.map_err(|error| {
        format!("No se pudo conectar con la API compatible con OpenAI: {error}")
    })?;
    ensure_success(response.status().as_u16(), "La API")?;
    let result = response
        .json::<OpenAiChatResponse>()
        .await
        .map_err(|error| format!("La API devolvió una respuesta JSON inválida: {error}"))?;
    let content = result
        .choices
        .first()
        .and_then(|choice| choice.message.content.as_deref())
        .ok_or_else(|| "La API no devolvió contenido para el modelo.".to_string())?;
    parse_model_response(content)
}

fn ensure_success(status: u16, provider: &str) -> Result<(), String> {
    if (200..300).contains(&status) {
        return Ok(());
    }
    Err(format!(
        "{provider} respondió con HTTP {status}. Revisa la conexión, el modelo y la clave configurados."
    ))
}

fn model_system_prompt() -> &'static str {
    r#"Eres un diseñador CAD que convierte descripciones en sólidos imprimibles. Responde solo
con un objeto JSON {"name":"nombre breve","features":[...]} con entre 1 y 32 sólidos ordenados.
Cada sólido debe tener exactamente id (texto único), shape (box, cylinder, sphere, ellipsoid,
cone, torus o capsule), operation (union, subtract o intersect), width, depth, height, x, y, z,
rotationX, rotationY y rotationZ. Las dimensiones son milímetros hasta 1000 (siempre positivas,
salvo el diámetro superior del cono, que puede ser cero); las posiciones son milímetros en XYZ
y las rotaciones son grados. La primera forma es la base y
siempre usa operation union. Cada forma siguiente se une, se resta para crear agujeros/huecos
o se interseca con el resultado anterior. Caja: width/depth/height. Cilindro: width=depth=diámetro,
height=alto. Esfera: las tres dimensiones son el diámetro. Elipsoide: ancho, fondo y alto
independientes. Cono: width es el diámetro de la base, depth el diámetro superior (puede ser 0),
height el alto. Toroide: width es diámetro exterior, depth es grosor del tubo y height=depth.
Cápsula: width=depth=diámetro y height es alto total, al menos el diámetro. Orienta las piezas
por el centro y usa operaciones subtract para detalles funcionales como agujeros. Para formas
orgánicas combina esferas, elipsoides, cápsulas, conos y cajas como piezas separadas mediante
union; colócalas para que formen una figura conectada. Usa nombres descriptivos para cada id.
Limita el detalle a una composición imprimible y compacta. No incluyas propiedades adicionales,
texto ni Markdown."#
}

fn parse_model_response(content: &str) -> Result<ModelSpec, String> {
    let model: ModelSpec = serde_json::from_str(content.trim())
        .map_err(|error| format!("El proveedor no devolvió la geometría esperada: {error}"))?;
    validate_model(&model)?;
    Ok(model)
}

fn validate_model(model: &ModelSpec) -> Result<(), String> {
    if model.name.trim().is_empty() || model.name.chars().count() > 80 {
        return Err("El nombre del modelo debe tener entre 1 y 80 caracteres.".into());
    }
    if !(1..=32).contains(&model.features.len()) {
        return Err("El modelo debe contener entre 1 y 32 formas.".into());
    }

    let mut ids = HashSet::with_capacity(model.features.len());
    for (index, feature) in model.features.iter().enumerate() {
        if feature.id.trim().is_empty()
            || feature.id.chars().count() > 40
            || !ids.insert(&feature.id)
        {
            return Err(
                "Cada forma debe tener un identificador único de hasta 40 caracteres.".into(),
            );
        }
        if index == 0 && !matches!(feature.operation, BooleanOperation::Union) {
            return Err(
                "La primera forma del modelo debe ser la base y usar la operación union.".into(),
            );
        }

        for (label, dimension) in [
            ("ancho", feature.width),
            ("fondo", feature.depth),
            ("alto", feature.height),
        ] {
            let min_dimension = if matches!(feature.shape, PrimitiveShape::Cone) && label == "fondo"
            {
                0.0
            } else {
                0.2
            };
            if !dimension.is_finite()
                || !(min_dimension..=MAX_MODEL_DIMENSION_MM).contains(&dimension)
            {
                return Err(format!(
                    "La dimensión de {label} debe estar entre {min_dimension} y {MAX_MODEL_DIMENSION_MM} mm."
                ));
            }
        }
        for (label, coordinate) in [("X", feature.x), ("Y", feature.y), ("Z", feature.z)] {
            if !coordinate.is_finite() || !(-500.0..=500.0).contains(&coordinate) {
                return Err(format!(
                    "La posición {label} debe estar entre -500 y 500 mm."
                ));
            }
        }
        for (label, rotation) in [
            ("X", feature.rotation_x),
            ("Y", feature.rotation_y),
            ("Z", feature.rotation_z),
        ] {
            if !rotation.is_finite() || !(-360.0..=360.0).contains(&rotation) {
                return Err(format!(
                    "La rotación {label} debe estar entre -360 y 360 grados."
                ));
            }
        }

        match feature.shape {
            PrimitiveShape::Sphere
                if !approximately_equal(feature.width, feature.depth, feature.height) =>
            {
                return Err("Las tres dimensiones de una esfera deben ser iguales.".into());
            }
            PrimitiveShape::Cylinder | PrimitiveShape::Capsule
                if !approximately_equal(feature.width, feature.depth, feature.width) =>
            {
                return Err("El ancho y el fondo deben coincidir en cilindros y cápsulas.".into());
            }
            PrimitiveShape::Capsule if feature.height < feature.width => {
                return Err(
                    "La altura total de la cápsula debe ser al menos igual a su diámetro.".into(),
                );
            }
            PrimitiveShape::Cone if feature.depth > feature.width || feature.depth < 0.0 => {
                return Err(
                    "El diámetro superior del cono debe estar entre cero y su diámetro de base."
                        .into(),
                );
            }
            PrimitiveShape::Torus
                if feature.depth >= feature.width
                    || !approximately_equal(feature.height, feature.depth, feature.depth) =>
            {
                return Err(
                    "El grosor del toroide debe ser menor que su diámetro exterior.".into(),
                );
            }
            _ => {}
        }
    }
    Ok(())
}

fn approximately_equal(first: f64, second: f64, third: f64) -> bool {
    let tolerance = 0.01;
    (first - second).abs() <= tolerance && (first - third).abs() <= tolerance
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            toggle_compact_window,
            set_always_on_top,
            get_provider_settings,
            save_provider_settings,
            clear_api_key,
            generate_model
        ])
        .run(tauri::generate_context!())
        .expect("error while running Ciel");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_valid_model_json() {
        let model = parse_model_response(
            r#"{"name":"Soporte","features":[{"id":"base","shape":"box","operation":"union","width":40,"depth":30,"height":12,"x":0,"y":0,"z":0,"rotationX":0,"rotationY":0,"rotationZ":0},{"id":"hole","shape":"cylinder","operation":"subtract","width":5,"depth":5,"height":12,"x":10,"y":0,"z":0,"rotationX":0,"rotationY":0,"rotationZ":0}]}"#,
        )
        .expect("valid multi-feature JSON should parse");
        assert_eq!(model.name, "Soporte");
        assert_eq!(model.features.len(), 2);
    }

    #[test]
    fn rejects_non_printable_dimensions() {
        let model = ModelSpec {
            name: "Pieza".into(),
            features: vec![ModelFeature {
                id: "base".into(),
                shape: PrimitiveShape::Box,
                operation: BooleanOperation::Union,
                width: 0.0,
                depth: 30.0,
                height: 12.0,
                x: 0.0,
                y: 0.0,
                z: 0.0,
                rotation_x: 0.0,
                rotation_y: 0.0,
                rotation_z: 0.0,
            }],
        };
        assert!(validate_model(&model).is_err());
    }

    #[test]
    fn rejects_non_uniform_spheres() {
        let model = ModelSpec {
            name: "Esfera".into(),
            features: vec![ModelFeature {
                id: "base".into(),
                shape: PrimitiveShape::Sphere,
                operation: BooleanOperation::Union,
                width: 30.0,
                depth: 29.0,
                height: 30.0,
                x: 0.0,
                y: 0.0,
                z: 0.0,
                rotation_x: 0.0,
                rotation_y: 0.0,
                rotation_z: 0.0,
            }],
        };
        assert!(validate_model(&model).is_err());
    }

    #[test]
    fn rejects_csg_operation_before_base_solid() {
        let model = ModelSpec {
            name: "Incorrecto".into(),
            features: vec![ModelFeature {
                id: "corte".into(),
                shape: PrimitiveShape::Cylinder,
                operation: BooleanOperation::Subtract,
                width: 5.0,
                depth: 5.0,
                height: 10.0,
                x: 0.0,
                y: 0.0,
                z: 0.0,
                rotation_x: 0.0,
                rotation_y: 0.0,
                rotation_z: 0.0,
            }],
        };
        assert!(validate_model(&model).is_err());
    }

    #[test]
    fn rejects_api_urls_with_embedded_credentials() {
        assert!(validate_endpoint(
            "https://user:password@example.com/v1",
            "La dirección de la API"
        )
        .is_err());
    }
}
