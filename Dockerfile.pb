# VS3 Admin Panel — PocketBase Service
# Downloads the PocketBase binary and serves it with pb_hooks loaded
FROM alpine:3 AS downloader

ARG VERSION=0.22.22

RUN apk add --no-cache ca-certificates unzip wget

RUN wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/pocketbase_${VERSION}_linux_amd64.zip" \
    -O /tmp/pb.zip \
    && unzip /tmp/pb.zip pocketbase -d /tmp/ \
    && chmod +x /tmp/pocketbase \
    && rm /tmp/pb.zip

FROM alpine:3

RUN apk add --no-cache ca-certificates

COPY --from=downloader /tmp/pocketbase /usr/local/bin/pocketbase

# pb_hooks directory — contains scheduler.js and auth_hooks.js
# The host pb_hooks/ directory is COPY-ed in (or volume-mounted in docker-compose for dev)
COPY pb_hooks/ /pb_hooks/

# pb_data is a volume mount point — do NOT copy anything here
# Data lives in the Railway Volume or Docker named volume
VOLUME /pb_data

EXPOSE 8090

# --dir: where PocketBase stores SQLite data (MUST be the mounted volume)
# --hooksDir: where PocketBase loads JSVM hook files (pb_hooks/)
CMD ["/usr/local/bin/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb_data", "--hooksDir=/pb_hooks"]
