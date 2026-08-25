FROM docker.io/library/python:3.12.13-slim-bookworm@sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2

ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=UTC

WORKDIR /input
WORKDIR /worker

COPY --chown=0:0 --chmod=0444 worker/parser.py /worker/parser.py
COPY --chown=0:0 --chmod=0444 worker/taxonomy-v1.json /worker/taxonomy-v1.json

USER 65532:65532

ENTRYPOINT ["python", "-I", "-B", "/worker/parser.py"]
