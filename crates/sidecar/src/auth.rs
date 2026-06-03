use axum::{
    body::Body,
    extract::Request,
    http::{StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde_json::json;

pub(crate) struct AuthRequired;

impl IntoResponse for AuthRequired {
    fn into_response(self) -> Response {
        (
            StatusCode::UNAUTHORIZED,
            [(header::CONTENT_TYPE, "application/json")],
            axum::Json(json!({ "error": "Missing or invalid API key" })),
        )
            .into_response()
    }
}

pub async fn require_api_key(req: Request<Body>, next: Next) -> Result<Response, AuthRequired> {
    let api_key = std::env::var("BASTION_API_KEY").unwrap_or_default();

    if api_key.is_empty() {
        return Ok(next.run(req).await);
    }

    let provided = req.headers().get("x-api-key").and_then(|v| v.to_str().ok());

    match provided {
        Some(key) if key == api_key => Ok(next.run(req).await),
        _ => Err(AuthRequired),
    }
}
