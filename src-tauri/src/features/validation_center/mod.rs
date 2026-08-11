pub(crate) mod commands;
mod domain;
mod dto;
mod error;
pub(crate) mod events;
mod filesystem;
mod model;
mod repository;
mod service;

pub(crate) use error::ValidationError;
pub(crate) use filesystem::LocalManifestFilesystem;
#[cfg(test)]
pub(crate) use model::{SaveValidationRule, ValidationRuleType, ValidationSeverity};
pub(crate) use model::{ValidationIssue, ValidationRule};
pub(crate) use repository::SqliteValidationRepository;
pub(crate) use service::ValidationService;

#[cfg(test)]
mod tests;
