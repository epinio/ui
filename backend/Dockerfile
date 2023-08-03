FROM registry.suse.com/bci/bci-micro

# default, if running outside of gorelease with a self-compiled binary
ARG DIST_BINARY=src/jetstream/jetstream
COPY ${DIST_BINARY} /epinio-ui

COPY ui /ui

ENTRYPOINT ["/epinio-ui"]
