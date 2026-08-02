use std::process::Command;

use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use super::error::AssetError;
use super::model::{ActionTarget, QuickAction};

pub(super) fn execute(
    app: &AppHandle,
    target: &ActionTarget,
    action: QuickAction,
) -> Result<Option<String>, AssetError> {
    match action {
        QuickAction::CopyRelativePath => Ok(Some(target.relative_path.clone())),
        QuickAction::CopyAbsolutePath => Ok(Some(display_path(&target.absolute_path)?)),
        QuickAction::Open => {
            app.opener()
                .open_path(display_path(&target.absolute_path)?, None::<String>)
                .map_err(|_| AssetError::ActionUnavailable)?;
            Ok(None)
        }
        QuickAction::Reveal => {
            app.opener()
                .reveal_item_in_dir(&target.absolute_path)
                .map_err(|_| AssetError::ActionUnavailable)?;
            Ok(None)
        }
        QuickAction::OpenInVscode => {
            Command::new(vscode_executable().ok_or(AssetError::ActionUnavailable)?)
                .arg(&target.absolute_path)
                .spawn()
                .map_err(|_| AssetError::ActionUnavailable)?;
            Ok(None)
        }
    }
}

fn vscode_executable() -> Option<std::ffi::OsString> {
    #[cfg(windows)]
    {
        let candidates = [
            std::env::var_os("LOCALAPPDATA")
                .map(std::path::PathBuf::from)
                .map(|path| path.join("Programs/Microsoft VS Code/Code.exe")),
            std::env::var_os("PROGRAMFILES")
                .map(std::path::PathBuf::from)
                .map(|path| path.join("Microsoft VS Code/Code.exe")),
            std::env::var_os("PROGRAMFILES(X86)")
                .map(std::path::PathBuf::from)
                .map(|path| path.join("Microsoft VS Code/Code.exe")),
        ];
        candidates
            .into_iter()
            .flatten()
            .find(|path| path.is_file())
            .map(std::path::PathBuf::into_os_string)
    }
    #[cfg(not(windows))]
    {
        Some(std::ffi::OsString::from("code"))
    }
}

fn display_path(path: &std::path::Path) -> Result<String, AssetError> {
    path.to_str()
        .map(ToOwned::to_owned)
        .ok_or(AssetError::ActionUnavailable)
}
