use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::app::state::AppState;
use crate::shared::errors::command::CommandError;

use super::actions;
use super::dto::{
    AssetActionInput, AssetIdInput, AssetQueryInput, ImportAssetInput, PreviewAssetInput,
    ResolveVariantPathInput, UpdateAssetMetadataInput, UpdateAssetVariantsInput,
    VariantCandidateQueryInput,
};
use super::model::{
    Asset, AssetPage, AssetPreview, ImportResult, VariantCandidate, VariantCandidatePage,
};

#[tauri::command]
pub(crate) async fn list_assets(
    state: State<'_, AppState>,
    input: AssetQueryInput,
) -> Result<AssetPage, CommandError> {
    state
        .asset_service()
        .query(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn get_asset(
    state: State<'_, AppState>,
    input: AssetIdInput,
) -> Result<Asset, CommandError> {
    let (project_id, asset_id) = input.parse().map_err(CommandError::from)?;
    state
        .asset_service()
        .get(project_id, asset_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn preview_asset_import(
    state: State<'_, AppState>,
    input: PreviewAssetInput,
) -> Result<AssetPreview, CommandError> {
    let project_id = Uuid::parse_str(&input.project_id)
        .map_err(|_| CommandError::invalid_input("The asset request contains invalid data."))?;
    state
        .asset_service()
        .preview(project_id, input.source_path)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn import_asset(
    state: State<'_, AppState>,
    input: ImportAssetInput,
) -> Result<ImportResult, CommandError> {
    state
        .asset_service()
        .import(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn update_asset_metadata(
    state: State<'_, AppState>,
    input: UpdateAssetMetadataInput,
) -> Result<Asset, CommandError> {
    state
        .asset_service()
        .update_metadata(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn list_asset_variant_candidates(
    state: State<'_, AppState>,
    input: VariantCandidateQueryInput,
) -> Result<VariantCandidatePage, CommandError> {
    state
        .asset_service()
        .variant_candidates(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn list_asset_variants(
    state: State<'_, AppState>,
    input: AssetIdInput,
) -> Result<Vec<VariantCandidate>, CommandError> {
    let (project_id, asset_id) = input.parse().map_err(CommandError::from)?;
    state
        .asset_service()
        .variants(project_id, asset_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn resolve_asset_variant_path(
    state: State<'_, AppState>,
    input: ResolveVariantPathInput,
) -> Result<VariantCandidate, CommandError> {
    state
        .asset_service()
        .resolve_variant_path(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn update_asset_variants(
    state: State<'_, AppState>,
    input: UpdateAssetVariantsInput,
) -> Result<Asset, CommandError> {
    state
        .asset_service()
        .update_variants(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn run_asset_action(
    app: AppHandle,
    state: State<'_, AppState>,
    input: AssetActionInput,
) -> Result<Option<String>, CommandError> {
    let project_id = Uuid::parse_str(&input.project_id)
        .map_err(|_| CommandError::invalid_input("The asset request contains invalid data."))?;
    let asset_id = Uuid::parse_str(&input.asset_id)
        .map_err(|_| CommandError::invalid_input("The asset request contains invalid data."))?;
    let target = state
        .asset_service()
        .action_target(project_id, asset_id)
        .await
        .map_err(CommandError::from)?;
    actions::execute(&app, &target, input.action).map_err(Into::into)
}
