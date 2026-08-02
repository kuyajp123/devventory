mod categorization;
pub(crate) mod commands;
mod dto;
mod error;
mod model;
mod repository;
mod scanner;
mod service;
mod watcher;

pub(crate) use error::FileInventoryError;
pub(crate) use model::ScanType;
pub(crate) use repository::SqliteFileInventoryRepository;
pub(crate) use service::FileInventoryService;
pub(crate) use watcher::InventoryRuntime;

#[cfg(test)]
mod tests;
