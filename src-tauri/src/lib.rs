//! Kanban Notizen – Desktop-Hülle.
//!
//! Die eigentliche App ist `src/index.html`. Rust kümmert sich nur um das
//! Speichern: Die Notizen liegen als JSON-Datei auf der Festplatte
//! (Standard: Dokumente\Kanban Notizen\kanban-notizen.json), und einmal pro
//! Tag wird automatisch eine Sicherung im Unterordner `Backups` angelegt.

use std::{
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

/// Wie viele Tages-Sicherungen behalten werden.
const KEEP_BACKUPS: usize = 30;

#[derive(Serialize, Deserialize, Default)]
struct Config {
    /// Vom Benutzer gewählter Speicherort. `None` = Standardpfad.
    data_path: Option<String>,
}

#[derive(Serialize)]
struct DataInfo {
    path: String,
    exists: bool,
    /// Letzte Änderung der Datei in Millisekunden (0 = unbekannt).
    mtime: u64,
    is_default: bool,
}

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

fn config_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(err)?;
    fs::create_dir_all(&dir).map_err(err)?;
    Ok(dir.join("config.json"))
}

fn read_config(app: &AppHandle) -> Config {
    config_file(app)
        .ok()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_config(app: &AppHandle, cfg: &Config) -> Result<(), String> {
    let json = serde_json::to_string_pretty(cfg).map_err(err)?;
    fs::write(config_file(app)?, json).map_err(err)
}

fn default_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .document_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(err)?;
    Ok(base.join("Kanban Notizen").join("kanban-notizen.json"))
}

fn data_path(app: &AppHandle) -> Result<(PathBuf, bool), String> {
    match read_config(app).data_path {
        Some(p) if !p.trim().is_empty() => Ok((PathBuf::from(p), false)),
        _ => Ok((default_path(app)?, true)),
    }
}

fn mtime(p: &Path) -> u64 {
    fs::metadata(p)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn info(app: &AppHandle) -> Result<DataInfo, String> {
    let (p, is_default) = data_path(app)?;
    Ok(DataInfo {
        exists: p.exists(),
        mtime: mtime(&p),
        path: p.to_string_lossy().into_owned(),
        is_default,
    })
}

/// Legt höchstens eine Sicherung pro Tag an und löscht alte Sicherungen.
fn daily_backup(p: &Path, day: &str) {
    let valid = day.len() == 10 && day.chars().all(|c| c.is_ascii_digit() || c == '-');
    if !valid || !p.exists() {
        return;
    }
    let Some(dir) = p.parent() else { return };
    let stem = p
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("kanban-notizen")
        .to_string();
    let bdir = dir.join("Backups");
    if fs::create_dir_all(&bdir).is_err() {
        return;
    }
    let target = bdir.join(format!("{stem}-{day}.json"));
    if target.exists() || fs::copy(p, &target).is_err() {
        return;
    }
    if let Ok(entries) = fs::read_dir(&bdir) {
        let mut files: Vec<PathBuf> = entries
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|f| {
                f.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.starts_with(&format!("{stem}-")) && n.ends_with(".json"))
                    .unwrap_or(false)
            })
            .collect();
        files.sort();
        while files.len() > KEEP_BACKUPS {
            let _ = fs::remove_file(files.remove(0));
        }
    }
}

#[tauri::command]
fn data_info(app: AppHandle) -> Result<DataInfo, String> {
    info(&app)
}

#[tauri::command]
fn load_data(app: AppHandle) -> Result<Option<String>, String> {
    let (p, _) = data_path(&app)?;
    if !p.exists() {
        return Ok(None);
    }
    fs::read_to_string(&p).map(Some).map_err(err)
}

/// Speichert sicher: erst in eine temporäre Datei, dann umbenennen.
#[tauri::command]
fn save_data(app: AppHandle, json: String, day: Option<String>) -> Result<u64, String> {
    let (p, _) = data_path(&app)?;
    if let Some(dir) = p.parent() {
        fs::create_dir_all(dir).map_err(err)?;
    }
    if let Some(day) = day {
        daily_backup(&p, &day);
    }
    let tmp = p.with_extension("json.tmp");
    fs::write(&tmp, json.as_bytes()).map_err(err)?;
    fs::rename(&tmp, &p).map_err(err)?;
    Ok(mtime(&p))
}

/// Setzt einen neuen Speicherort (`None` = zurück zum Standard).
#[tauri::command]
fn set_data_path(app: AppHandle, path: Option<String>) -> Result<DataInfo, String> {
    let mut cfg = read_config(&app);
    cfg.data_path = path.filter(|p| !p.trim().is_empty());
    write_config(&app, &cfg)?;
    info(&app)
}

/// Öffnet den Ordner mit der Datendatei im Explorer.
#[tauri::command]
fn reveal_data(app: AppHandle) -> Result<(), String> {
    let (p, _) = data_path(&app)?;
    let dir = p.parent().map(Path::to_path_buf).unwrap_or_default();
    fs::create_dir_all(&dir).map_err(err)?;
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&dir)
            .spawn()
            .map_err(err)?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = dir;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            data_info,
            load_data,
            save_data,
            set_data_path,
            reveal_data
        ])
        .run(tauri::generate_context!())
        .expect("Kanban Notizen konnte nicht gestartet werden");
}
