use crate::shared::runtime_profile::RuntimeProfile;

pub(crate) fn configure_context<R: tauri::Runtime>(
    context: tauri::Context<R>,
) -> tauri::Context<R> {
    configure_for_profile(context, RuntimeProfile::current())
}

fn configure_for_profile<R: tauri::Runtime>(
    mut context: tauri::Context<R>,
    profile: RuntimeProfile,
) -> tauri::Context<R> {
    if profile == RuntimeProfile::Development {
        // Resolve paths and plugin identities before building the application.
        // Do not redirect or copy installed data automatically on startup.
        context.config_mut().identifier = profile.identifier().into();
        context.config_mut().product_name = Some("Devventory Development".into());
        context.package_info_mut().name = "Devventory Development".into();
    }
    context
}

#[cfg(test)]
mod tests {
    use super::{configure_for_profile, RuntimeProfile};

    #[test]
    fn development_uses_an_isolated_tauri_data_and_single_instance_identity() {
        let context: tauri::Context<tauri::Wry> = tauri::generate_context!();
        let windows = serde_json::to_value(&context.config().app.windows).unwrap();
        let development = configure_for_profile(context, RuntimeProfile::Development);
        assert_eq!(development.config().identifier, "com.paul.devventory.dev");
        assert_eq!(
            development.config().product_name.as_deref(),
            Some("Devventory Development")
        );
        assert_eq!(development.package_info().name, "Devventory Development");
        assert_eq!(
            serde_json::to_value(&development.config().app.windows).unwrap(),
            windows
        );
    }

    #[test]
    fn installed_context_retains_its_config_and_package_identity() {
        let context: tauri::Context<tauri::Wry> = tauri::generate_context!();
        let config = serde_json::to_value(context.config()).unwrap();
        let package_name = context.package_info().name.clone();
        let installed = configure_for_profile(context, RuntimeProfile::Installed);
        assert_eq!(serde_json::to_value(installed.config()).unwrap(), config);
        assert_eq!(installed.package_info().name, package_name);
    }
}
