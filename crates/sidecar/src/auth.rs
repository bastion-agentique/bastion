use axum::{
    body::Body,
    extract::Request,
    middleware::Next,
    response::Response,
};

/// Passthrough auth middleware — all requests pass unconditionally.
/// Auth is handled by pay.sh (pre-verifies payment before proxying)
/// and x402 (MCP tool payment verification on server).
/// This module exists to preserve the middleware layer position in the router.
pub async fn require_api_key(req: Request<Body>, next: Next) -> Response {
    next.run(req).await
}
