mod categorization;
pub(crate) mod commands;
mod dto;
mod error;
mod model;
mod repository;
mod scanner;
mod service;
mod watcher;

pub(crate) use categorization::{
    category as categorize_path, extension as path_extension, mime_type as path_mime_type,
};
pub(crate) use error::FileInventoryError;
pub(crate) use model::FileCategory;
pub(crate) use model::ScanType;
pub(crate) use repository::SqliteFileInventoryRepository;
pub(crate) use service::FileInventoryService;
pub(crate) use watcher::InventoryRuntime;

#[cfg(test)]
mod tests;
