FROM golang:1.26.1-alpine AS builder

ENV GO111MODULE=on
WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o app .

FROM alpine:3.20

WORKDIR /app

RUN apk add --no-cache \
    bash \
    tzdata \
    docker-cli \
    docker-cli-compose \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV CHROME_PATH=/usr/bin/chromium

COPY --from=builder /app/app .

EXPOSE 9000

CMD ["./app"]