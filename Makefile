.PHONY: install fmt lint typecheck test build smoke-backend check hooks

ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
BACKEND := $(ROOT)/backend
FRONTEND := $(ROOT)/frontend
BACKEND_PYTHON := $(BACKEND)/.venv/bin/python

install: hooks
	@echo "==> backend deps"
	cd $(BACKEND) && uv venv --python 3.11 .venv 2>/dev/null || true
	cd $(BACKEND) && uv pip install -r requirements.txt -r requirements-dev.txt
	@echo "==> frontend deps"
	cd $(FRONTEND) && npm ci
	@echo "==> install complete (run make check before push)"

hooks:
	@echo "==> git hooks (pre-commit + pre-push)"
	@command -v pre-commit >/dev/null 2>&1 || uv tool install pre-commit
	pre-commit install --hook-type pre-commit --hook-type pre-push

fmt:
	cd $(BACKEND) && $(BACKEND_PYTHON) -m ruff format .
	cd $(BACKEND) && $(BACKEND_PYTHON) -m ruff check --fix .
	cd $(FRONTEND) && npm run format

lint:
	cd $(BACKEND) && $(BACKEND_PYTHON) -m ruff check .
	cd $(FRONTEND) && npm run lint

typecheck:
	cd $(BACKEND) && $(BACKEND_PYTHON) -m mypy .
	cd $(FRONTEND) && npm run typecheck

test:
	cd $(BACKEND) && $(BACKEND_PYTHON) -m pytest tests -q
	cd $(FRONTEND) && npm run test

build:
	cd $(FRONTEND) && npm run build

smoke-backend:
	cd $(BACKEND) && $(BACKEND_PYTHON) -c "import main; import fact_check; import source_filter; import models; import prompts; import supabase_client"

check:
	BACKEND_PYTHON=$(BACKEND_PYTHON) $(ROOT)/scripts/check.sh
