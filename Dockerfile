# syntax=docker/dockerfile:1.7
#
# GOindoor server image: the Rust game server plus the static browser client.

# --- Build -------------------------------------------------------------------
FROM rust:1-slim-bookworm@sha256:f2c004e3d2d8b547e8cf7ffbc29205385f4e71d23e53e4e383065db5e9f822cd AS builder
WORKDIR /build

# Cargo.lock is optional until it is committed; the glob keeps the build working either way.
COPY server/Cargo.toml server/Cargo.lock* server/rustfmt.toml ./
COPY server/crates ./crates

RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/build/target \
    cargo build --release --bin goindoor-server \
    && cp target/release/goindoor-server /usr/local/bin/goindoor-server

# --- Runtime -----------------------------------------------------------------
FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc AS runtime

# Which build this is (git commit and date), passed by `make up` / `make update` and CI.
ARG GOINDOOR_BUILD_SHA=dev
ARG GOINDOOR_BUILD_DATE=

RUN groupadd --system --gid 10001 goindoor \
    && useradd --system --uid 10001 --gid goindoor --no-create-home --shell /usr/sbin/nologin goindoor

COPY --from=builder /usr/local/bin/goindoor-server /usr/local/bin/goindoor-server
COPY client/public /app/client
# The client reports its own build, so a rider's cached copy can be told from the server's.
RUN printf 'export const BUILD = { sha: "%s", date: "%s" };\n' "${GOINDOOR_BUILD_SHA}" "${GOINDOOR_BUILD_DATE}" > /app/client/js/build.js
COPY routes /app/routes

ENV GOINDOOR_BIND=0.0.0.0:8080 \
    GOINDOOR_STATIC_DIR=/app/client \
    GOINDOOR_ROUTE_FILE=/app/routes/rolling-hills.json \
    GOINDOOR_ROUTES_DIR=/app/routes \
    GOINDOOR_DATA_DIR=/app/data \
    GOINDOOR_BUILD_SHA=${GOINDOOR_BUILD_SHA} \
    GOINDOOR_BUILD_DATE=${GOINDOOR_BUILD_DATE} \
    RUST_LOG=info

# Strava logins live here (a volume in docker-compose.yml); owned by the server's user.
RUN mkdir -p /app/data && chown goindoor:goindoor /app/data

# Numeric form keeps the same ids and works with orchestrators (hadolint DL3066).
USER 10001:10001
WORKDIR /app
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD ["goindoor-server", "healthcheck"]

ENTRYPOINT ["goindoor-server"]
