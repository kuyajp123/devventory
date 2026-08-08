use std::collections::HashSet;

use uuid::Uuid;

use super::error::SearchError;
use super::model::{
    SearchHistoryEntry, SearchHistoryRow, SearchMetadataPage, SearchMetadataRequest, SearchQuery,
};
use super::repository::SqliteSearchRepository;

const MAX_FILTER_VALUES: usize = 50;
const MAX_QUERY_CHARACTERS: usize = 256;
const MAX_PAGE_SIZE: u32 = 100;

#[derive(Debug, Clone)]
pub(crate) struct SearchService {
    repository: SqliteSearchRepository,
}

impl SearchService {
    pub(crate) fn new(repository: SqliteSearchRepository) -> Self {
        Self { repository }
    }

    pub(crate) async fn search(
        &self,
        request: SearchMetadataRequest,
    ) -> Result<SearchMetadataPage, SearchError> {
        let query = validate_request(request)?;
        self.repository.search(&query).await
    }

    pub(crate) async fn record_history(
        &self,
        mut request: SearchMetadataRequest,
    ) -> Result<Option<SearchHistoryEntry>, SearchError> {
        request.page = 1;
        let query = validate_request(request)?;
        if !is_meaningful(&query.request) {
            return Ok(None);
        }
        let request_json = serde_json::to_string(&query.request)?;
        let row = self
            .repository
            .record_history(
                Uuid::new_v4(),
                query.project_id,
                &query.request.query,
                &request_json,
            )
            .await?;
        parse_history(row).map(Some)
    }

    pub(crate) async fn history(&self) -> Result<Vec<SearchHistoryEntry>, SearchError> {
        self.repository
            .history()
            .await?
            .into_iter()
            .map(parse_history)
            .collect()
    }

    pub(crate) async fn delete_history(&self, id: String) -> Result<(), SearchError> {
        let id = Uuid::parse_str(&id).map_err(|_| SearchError::InvalidInput)?;
        if !self.repository.delete_history(id).await? {
            return Err(SearchError::HistoryNotFound);
        }
        Ok(())
    }

    pub(crate) async fn clear_history(&self) -> Result<(), SearchError> {
        self.repository.clear_history().await
    }
}

fn validate_request(mut request: SearchMetadataRequest) -> Result<SearchQuery, SearchError> {
    request.query = request.query.trim().to_owned();
    if request.query.chars().count() > MAX_QUERY_CHARACTERS
        || request.page == 0
        || request.page_size == 0
        || request.page_size > MAX_PAGE_SIZE
        || request.categories.len() > MAX_FILTER_VALUES
        || request.extensions.len() > MAX_FILTER_VALUES
        || request.tags.len() > MAX_FILTER_VALUES
        || request.environment_ids.len() > MAX_FILTER_VALUES
        || request.statuses.len() > MAX_FILTER_VALUES
        || request.origins.len() > MAX_FILTER_VALUES
        || request
            .modified_from_ms
            .zip(request.modified_to_ms)
            .is_some_and(|(from, to)| from > to)
    {
        return Err(SearchError::InvalidInput);
    }

    request.extensions = normalize_strings(request.extensions, 32, true)?;
    request.tags = normalize_strings(request.tags, 40, false)?;
    let project_id = request
        .project_id
        .as_deref()
        .map(Uuid::parse_str)
        .transpose()
        .map_err(|_| SearchError::InvalidInput)?;
    let environment_ids = request
        .environment_ids
        .iter()
        .map(|value| Uuid::parse_str(value).map_err(|_| SearchError::InvalidInput))
        .collect::<Result<Vec<_>, _>>()?;
    let unique_environment_ids = environment_ids.iter().copied().collect::<HashSet<_>>();
    if unique_environment_ids.len() != environment_ids.len() {
        return Err(SearchError::InvalidInput);
    }

    Ok(SearchQuery {
        request,
        project_id,
        environment_ids,
    })
}

fn normalize_strings(
    values: Vec<String>,
    max_characters: usize,
    trim_dot: bool,
) -> Result<Vec<String>, SearchError> {
    let mut normalized = Vec::with_capacity(values.len());
    let mut seen = HashSet::new();
    for value in values {
        let value = value.trim();
        let value = if trim_dot {
            value.trim_start_matches('.')
        } else {
            value
        };
        let value = value.to_lowercase();
        if value.is_empty() || value.chars().count() > max_characters {
            return Err(SearchError::InvalidInput);
        }
        if seen.insert(value.clone()) {
            normalized.push(value);
        }
    }
    Ok(normalized)
}

fn is_meaningful(request: &SearchMetadataRequest) -> bool {
    !request.query.is_empty()
        || request.project_id.is_some()
        || !request.categories.is_empty()
        || !request.extensions.is_empty()
        || !request.tags.is_empty()
        || !request.environment_ids.is_empty()
        || !request.statuses.is_empty()
        || !request.origins.is_empty()
        || request.modified_from_ms.is_some()
        || request.modified_to_ms.is_some()
}

fn parse_history(row: SearchHistoryRow) -> Result<SearchHistoryEntry, SearchError> {
    let request = serde_json::from_str::<SearchMetadataRequest>(&row.request_json)?;
    let request = validate_request(request)?.request;
    Ok(SearchHistoryEntry {
        id: Uuid::parse_str(&row.id).map_err(|_| SearchError::InvalidPersistedData)?,
        request,
        created_at: row.created_at,
    })
}
