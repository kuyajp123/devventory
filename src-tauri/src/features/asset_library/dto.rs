use serde::Deserialize;
use uuid::Uuid;

use crate::features::file_inventory::FileCategory;

use super::error::AssetError;
use super::model::{
    AssetMetadataUpdate, AssetOrigin, AssetQuery, AssetSortField, CollisionChoice, ImportAsset,
    QuickAction, SortDirection,
};

const MAX_PAGE_SIZE: u32 = 100;
const MAX_SEARCH_LENGTH: usize = 128;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AssetQueryInput {
    project_id: String,
    search: Option<String>,
    category: Option<FileCategory>,
    extension: Option<String>,
    tag: Option<String>,
    favorite: Option<bool>,
    origin: Option<AssetOrigin>,
    sort_by: Option<AssetSortField>,
    sort_direction: Option<SortDirection>,
    page: u32,
    page_size: u32,
}

impl TryFrom<AssetQueryInput> for AssetQuery {
    type Error = AssetError;

    fn try_from(input: AssetQueryInput) -> Result<Self, Self::Error> {
        let project_id =
            Uuid::parse_str(&input.project_id).map_err(|_| AssetError::InvalidFilter)?;
        let search = normalize_optional(input.search);
        let extension = normalize_optional(input.extension)
            .map(|value| value.trim_start_matches('.').to_ascii_lowercase());
        let tag = normalize_optional(input.tag).map(|value| value.to_lowercase());
        if input.page == 0
            || input.page_size == 0
            || input.page_size > MAX_PAGE_SIZE
            || search
                .as_ref()
                .is_some_and(|value| value.chars().count() > MAX_SEARCH_LENGTH)
            || extension.as_ref().is_some_and(|value| value.len() > 32)
            || tag.as_ref().is_some_and(|value| value.chars().count() > 40)
        {
            return Err(AssetError::InvalidFilter);
        }
        Ok(Self {
            project_id,
            search,
            category: input.category,
            extension,
            tag,
            favorite: input.favorite,
            origin: input.origin,
            sort_by: input.sort_by.unwrap_or(AssetSortField::RelativePath),
            sort_direction: input.sort_direction.unwrap_or(SortDirection::Ascending),
            page: input.page,
            page_size: input.page_size,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PreviewAssetInput {
    pub(crate) project_id: String,
    pub(crate) source_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ImportAssetInput {
    project_id: String,
    source_path: String,
    destination: String,
    filename: Option<String>,
    collision: CollisionChoice,
    #[serde(default)]
    tags: Vec<String>,
    note: Option<String>,
    #[serde(default)]
    favorite: bool,
}

impl TryFrom<ImportAssetInput> for ImportAsset {
    type Error = AssetError;

    fn try_from(input: ImportAssetInput) -> Result<Self, Self::Error> {
        Ok(Self {
            project_id: Uuid::parse_str(&input.project_id)
                .map_err(|_| AssetError::InvalidMetadata)?,
            source_path: input.source_path,
            destination: input.destination,
            filename: input.filename,
            collision: input.collision,
            tags: input.tags,
            note: input.note,
            favorite: input.favorite,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct UpdateAssetMetadataInput {
    project_id: String,
    asset_id: String,
    #[serde(default)]
    tags: Vec<String>,
    note: Option<String>,
    #[serde(default)]
    favorite: bool,
    #[serde(default)]
    variant_ids: Vec<String>,
}

impl TryFrom<UpdateAssetMetadataInput> for AssetMetadataUpdate {
    type Error = AssetError;

    fn try_from(input: UpdateAssetMetadataInput) -> Result<Self, Self::Error> {
        Ok(Self {
            project_id: parse_uuid(&input.project_id)?,
            asset_id: parse_uuid(&input.asset_id)?,
            tags: input.tags,
            note: input.note,
            favorite: input.favorite,
            variant_ids: input
                .variant_ids
                .iter()
                .map(|value| parse_uuid(value))
                .collect::<Result<_, _>>()?,
        })
    }
}

fn parse_uuid(value: &str) -> Result<Uuid, AssetError> {
    Uuid::parse_str(value).map_err(|_| AssetError::InvalidMetadata)
}

fn normalize_optional(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AssetIdInput {
    pub(crate) project_id: String,
    pub(crate) asset_id: String,
}

impl AssetIdInput {
    pub(crate) fn parse(&self) -> Result<(Uuid, Uuid), AssetError> {
        Ok((parse_uuid(&self.project_id)?, parse_uuid(&self.asset_id)?))
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AssetActionInput {
    pub(crate) project_id: String,
    pub(crate) asset_id: String,
    pub(crate) action: QuickAction,
}
