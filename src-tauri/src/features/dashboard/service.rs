use uuid::Uuid;

use super::error::DashboardError;
use super::model::ProjectDashboard;
use super::repository::SqliteDashboardRepository;

#[derive(Debug, Clone)]
pub(crate) struct DashboardService {
    repository: SqliteDashboardRepository,
}

impl DashboardService {
    pub(crate) fn new(repository: SqliteDashboardRepository) -> Self {
        Self { repository }
    }

    pub(crate) async fn get(&self, project_id: String) -> Result<ProjectDashboard, DashboardError> {
        let project_id = Uuid::parse_str(&project_id).map_err(|_| DashboardError::InvalidInput)?;
        self.repository.get(project_id).await
    }
}
