FROM alpine:3.22

CMD ["sh", "-c", "printf '%s\n' 'Use docker compose up to start Breezy through the Nginx gateway on port 3000.' && exit 1"]
