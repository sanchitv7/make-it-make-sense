.PHONY: dev build stop logs

dev:
	docker compose up

build:
	docker compose build

stop:
	docker compose down

logs:
	docker compose logs -f
