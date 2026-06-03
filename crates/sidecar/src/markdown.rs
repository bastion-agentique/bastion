use axum::{
    body::Body,
    extract::Request,
    http::{header, StatusCode},
    response::Response,
};

const INDEX_MD: &str = include_str!("../../../apps/web/public/index.md");
const DASHBOARD_MD: &str = include_str!("../../../apps/web/public/dashboard.md");
const INTEGRATE_MD: &str = include_str!("../../../apps/web/public/integrate.md");

/// Returns a markdown response if the client requests text/markdown.
pub fn negotiate_markdown(req: &Request<Body>) -> Option<Response> {
    let accept = req
        .headers()
        .get(header::ACCEPT)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if !accept.contains("text/markdown") {
        return None;
    }

    let path = req.uri().path();
    let content = match path {
        "/" | "/index.html" => INDEX_MD,
        "/dashboard" | "/dashboard.md" => DASHBOARD_MD,
        "/integrate" | "/integrate.md" => INTEGRATE_MD,
        _ => return None,
    };

    let mut response = Response::new(Body::from(content));
    *response.status_mut() = StatusCode::OK;
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        "text/markdown".parse().unwrap(),
    );
    Some(response)
}
