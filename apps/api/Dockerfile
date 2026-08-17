FROM golang:1.26-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/server ./cmd/server

FROM scratch

COPY --from=build /out/server /usr/local/bin/server

EXPOSE 8080
ENTRYPOINT ["server"]
