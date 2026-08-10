use std::sync::Arc;
use std::time::Duration;
use chrono::Duration as ChronoDuration;
use tauri::{AppHandle, Emitter};
use tokio::sync::watch;
use tracing::{error, info};

use super::service::AgentUsageService;

#[derive(Debug, Clone)]
pub(crate) struct AgentReminderRuntime {
    shutdown_tx: Arc<watch::Sender<bool>>,
}

impl AgentReminderRuntime {
    pub(crate) fn new() -> Self {
        let (shutdown_tx, _) = watch::channel(false);
        Self {
            shutdown_tx: Arc::new(shutdown_tx),
        }
    }

    pub(crate) fn start(&self, app: AppHandle, service: AgentUsageService) {
        let mut shutdown_rx = self.shutdown_tx.subscribe();

        tauri::async_runtime::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60));
            // First tick completes immediately, skip it to let app startup settle
            interval.tick().await;

            loop {
                tokio::select! {
                    _ = interval.tick() => {
                        Self::poll_once(&app, &service).await;
                    }
                    _ = shutdown_rx.changed() => {
                        if *shutdown_rx.borrow() {
                            info!("AgentReminderRuntime shutting down");
                            break;
                        }
                    }
                }
            }
        });
    }

    pub(crate) async fn poll_once(app: &AppHandle, service: &AgentUsageService) {
        match service.claim_due_reminders(ChronoDuration::minutes(2)).await {
            Ok(batch) => {
                if !batch.reminders.is_empty() {
                    info!(
                        batch_token = %batch.batch_token,
                        count = batch.reminders.len(),
                        "claimed due agent reminders batch"
                    );
                    if let Err(err) = app.emit("agent-reminders:due", &batch) {
                        error!(error = %err, "failed to emit agent-reminders:due event");
                    }
                }
            }
            Err(err) => {
                error!(error = %err, "failed to claim due agent reminders");
            }
        }
    }

    #[allow(dead_code)]
    pub(crate) fn shutdown(&self) {
        let _ = self.shutdown_tx.send(true);
    }
}
