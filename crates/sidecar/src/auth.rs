use axum::{
    body::Body,
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use std::env;

/// API key middleware. If `BASTION_API_KEY` env var is set, every request must
/// supply a matching `X-API-Key` header. If the env var is unset the sidecar
/// runs unauthenticated (development mode).
pub async fn require_api_key(req: Request<Body>, next: Next) -> Response {
    let expected = match env::var("BASTION_API_KEY") {
        Ok(k) if !k.is_empty() => k,
        // No key configured — pass through (dev mode)
        _ => return next.run(req).await,
    };

    let provided = req
        .headers()
        .get("X-API-Key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if provided != expected {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "Invalid or missing X-API-Key header" })),
        )
            .into_response();
    }

    next.run(req).await
}
