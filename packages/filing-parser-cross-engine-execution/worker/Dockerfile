FROM docker.io/library/node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df

ENV LANG=C.UTF-8 LC_ALL=C.UTF-8 TZ=UTC
WORKDIR /worker
COPY --chown=0:0 --chmod=0444 worker/parser.mjs /worker/parser.mjs
COPY --chown=0:0 --chmod=0444 worker/taxonomy-v1.json /worker/taxonomy-v1.json
WORKDIR /input
USER 65532:65532
ENTRYPOINT ["node", "--disable-proto=throw", "/worker/parser.mjs"]
CMD []
