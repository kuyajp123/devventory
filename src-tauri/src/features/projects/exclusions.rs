pub(crate) const BUILT_IN_PROJECT_EXCLUSIONS: [&str; 10] = [
    ".cache/",
    ".git/",
    ".next/",
    ".turbo/",
    "build/",
    "coverage/",
    "dist/",
    "node_modules/",
    "target/",
    "vendor/",
];

pub(crate) fn is_built_in_exclusion(value: &str) -> bool {
    let normalized = value
        .trim()
        .replace('\\', "/")
        .trim_matches('/')
        .to_ascii_lowercase();
    BUILT_IN_PROJECT_EXCLUSIONS
        .iter()
        .any(|built_in| built_in.trim_end_matches('/') == normalized)
}

pub(crate) fn is_project_path_excluded(
    relative_path: &str,
    is_directory: bool,
    custom_exclusions: &[String],
) -> bool {
    let normalized = relative_path.replace('\\', "/");
    let components = normalized
        .split('/')
        .filter(|component| !component.is_empty())
        .collect::<Vec<_>>();
    let last_index = components.len().saturating_sub(1);
    if components.iter().enumerate().any(|(index, component)| {
        BUILT_IN_PROJECT_EXCLUSIONS.iter().any(|pattern| {
            pattern
                .trim_end_matches('/')
                .eq_ignore_ascii_case(component)
                && (index < last_index || is_directory)
        })
    }) {
        return true;
    }

    custom_exclusions.iter().any(|exclusion| {
        let prefix = exclusion.trim_end_matches('/');
        path_matches(&normalized, prefix, is_directory)
    })
}

fn path_matches(relative_path: &str, prefix: &str, is_directory: bool) -> bool {
    #[cfg(windows)]
    let (relative_path, prefix) = (relative_path.to_lowercase(), prefix.to_lowercase());

    #[cfg(not(windows))]
    let (relative_path, prefix) = (relative_path.to_owned(), prefix.to_owned());

    relative_path.starts_with(&format!("{prefix}/")) || (is_directory && relative_path == prefix)
}
