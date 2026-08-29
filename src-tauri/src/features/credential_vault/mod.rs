pub(crate) mod commands;
mod dto;
pub(crate) mod env_parser;
mod error;
mod model;
mod repository;
mod secret_store;
mod service;

pub(crate) use repository::SqliteCredentialVaultRepository;
pub(crate) use service::CredentialVaultService;

#[cfg(test)]
pub(crate) use model::{
    CreateCredentials, CredentialEnvironmentLink, NewCredential, NewCredentialSource,
};

#[cfg(test)]
mod tests;
