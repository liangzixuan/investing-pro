# Third-party notices

This file tracks direct runtime packages. The lockfile and automated SBOM will remain the full dependency inventory.

| Package           | Version | License    | Use                                |
| ----------------- | ------: | ---------- | ---------------------------------- |
| Next.js           |  16.3.1 | MIT        | Web framework                      |
| React / React DOM |  19.2.8 | MIT        | UI runtime                         |
| Apache ECharts    |   6.1.0 | Apache-2.0 | Analytical chart rendering         |
| Fastify           |  5.12.0 | MIT        | Demo REST API                      |
| @fastify/cors     |  11.3.0 | MIT        | Local web/API boundary             |
| @fastify/helmet   |  13.1.0 | MIT        | HTTP security headers              |
| decimal.js        |  10.6.0 | MIT        | Deterministic decimal calculations |
| node-postgres     |  8.23.0 | MIT        | Single-client PostgreSQL reads     |

Transitive content notice: `caniuse-lite` 1.0.30001809 is licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and is used by the
Next.js browser-compatibility toolchain. Project attribution:
[browserslist/caniuse-lite](https://github.com/browserslist/caniuse-lite).

No third-party financial market data, competitor content, images, fonts, or model weights are included.

## CI acceptance infrastructure

Cycle 2a uses the Docker Official Image
`python:3.12.13-slim-bookworm` only in its isolated synthetic parser acceptance
job. The exact OCI index and `linux/amd64` child-manifest digests are recorded in
`packages/filing-parser/acceptance/python-image.json`. CPython 3.12.13 uses the
Python Software Foundation License Version 2:
<https://docs.python.org/3.12/license.html>.

This notice is not a complete license inventory for the Debian Bookworm
packages contained in the image and is not production-image approval. Complete
image package/license inventory, redistribution review, counsel/procurement
approval, vulnerability admission, and production use remain pending.
