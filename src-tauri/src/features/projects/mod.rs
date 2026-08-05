pub(crate) mod commands;
mod dto;
mod error;
mod filesystem;
mod model;
mod repository;
mod service;

pub(crate) use error::{ProjectError, ProjectFileError};
pub(crate) use filesystem::LocalProjectFilesystem;
#[cfg(test)]
pub(crate) use model::{CreateProject, ProjectType, ResolvedWatchedLocation};
pub(crate) use model::{ResolvedProjectFile, ResolvedProjectScanTarget, WatchedLocationScanTarget};
pub(crate) use repository::SqliteProjectRepository;
pub(crate) use service::ProjectService;

#[cfg(test)]
mod tests;
