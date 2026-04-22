# trace2 - build & deploy
#
# Always use `make deploy` instead of `databricks bundle deploy` directly.
# The deploy target:
#   1. Verifies Databricks CLI auth
#   2. Builds the frontend (ensures dist is fresh before upload)
#   3. Runs databricks bundle deploy
#   4. Explicitly triggers a new app deployment (bundle deploy alone does not
#      always snapshot untracked files such as frontend/dist)
#   5. Re-applies user_api_scopes: ["sql"] (reset by every bundle deploy)

PROFILE ?= uat
APP_NAME ?= trace2
BUNDLE_NAME ?= trace2
APP_CONFIG_TEMPLATE ?= app.template.yaml
APP_CONFIG_OUTPUT ?= app.yaml
WAREHOUSE_HTTP_PATH_DEFAULT ?= /sql/1.0/warehouses/e76480b94bea6ed5
TRACE_CATALOG_DEFAULT ?= connected_plant_uat
TRACE_SCHEMA_DEFAULT ?= gold
DEPLOY_APP ?= python3 ../../scripts/deploy_app.py --app-dir .

.PHONY: build check-env deploy dev render-app-config

check-env:
	@databricks current-user me --profile $(PROFILE) -o json > /dev/null 2>&1 || \
	  (echo "ERROR: Cannot authenticate with Databricks. Run: databricks configure --profile $(PROFILE)" && exit 1)
	@echo "✓ Databricks auth OK (profile: $(PROFILE))"

build:
	cd frontend && npm run build

dev:
	@echo "Starting backend + frontend dev servers..."
	@bash scripts/dev.sh

render-app-config:
	$(DEPLOY_APP) --action render --profile $(PROFILE)

deploy:
	$(DEPLOY_APP) --profile $(PROFILE) --app-name $(APP_NAME) --bundle-name $(BUNDLE_NAME)
