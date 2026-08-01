pub(crate) fn initialize() {
    let _ = tracing_subscriber::fmt()
        .with_target(false)
        .compact()
        .try_init();
}
