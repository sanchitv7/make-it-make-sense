.PHONY: install fmt lint typecheck test build smoke-backend check hooks sync-main dev-backend

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

# Update local main to origin/main before starting a new task/worktree/branch.
sync-main:
	@echo "==> sync main from origin"
	git fetch origin main
	@current="$$(git branch --show-current 2>/dev/null || true)"; \
	if [[ "$$current" == "main" ]]; then \
	  git pull --ff-only origin main; \
	else \
	  git branch -f main origin/main; \
	  echo "Updated local main to origin/main (checked out branch: $$current)."; \
	  echo "Create the new branch/worktree from main, e.g.: git switch main && git switch -c <branch>"; \
	fi

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
	cd $(FRONTEND) && NEXT_PUBLIC_BACKEND_URL=$${NEXT_PUBLIC_BACKEND_URL:-http://localhost:8000} NEXT_PUBLIC_SUPABASE_URL=$${NEXT_PUBLIC_SUPABASE_URL:-https://example.supabase.co} NEXT_PUBLIC_SUPABASE_ANON_KEY=$${NEXT_PUBLIC_SUPABASE_ANON_KEY:-public-anon-key} npm run build

smoke-backend:
	cd $(BACKEND) && $(BACKEND_PYTHON) -c "import main; import fact_check; import source_filter; import models; import prompts; import supabase_client"

# Local API with a short reload drain so WatchFiles cannot wedge on Gemini tasks.
dev-backend:
	cd $(BACKEND) && .venv/bin/uvicorn main:app --reload --host 127.0.0.1 --port 8000 --timeout-graceful-shutdown 1

check:
	BACKEND_PYTHON=$(BACKEND_PYTHON) $(ROOT)/scripts/check.sh
