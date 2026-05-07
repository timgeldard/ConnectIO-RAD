PROFILE ?= uat
TARGET  ?= uat
DEPLOY_APP ?= python3 ../../scripts/deploy_app.py --app-dir .

.PHONY: deploy build render-app-config install dev-install

deploy:
	$(DEPLOY_APP) --profile $(PROFILE) --target $(TARGET)

build:
	python3 scripts/build.py

render-app-config:
	$(DEPLOY_APP) --action render --profile $(PROFILE) --target $(TARGET)

# Install runtime deps from the local wheels/ directory (must run `make build` first).
install:
	pip install --find-links ./wheels -r requirements.txt

# Editable install for local development — picks up source changes immediately.
# Use this instead of `make install` when iterating on the platform locally.
dev-install:
	pip install \
	  -e ../../libs/shared-api \
	  -e ../../libs/shared-auth \
	  -e ../../libs/shared-db \
	  -e ../../libs/shared-domain \
	  -e ../../libs/shared-trace \
	  -e ../../libs/shared-geo \
	  -e ../connectedquality/backend \
	  -e ../envmon/backend \
	  -e ../processorderhistory/backend \
	  -e ../spc/backend \
	  -e ../trace2/backend \
	  -e ../warehouse360/backend \
	  fastapi uvicorn[standard] cachetools slowapi databricks-sdk databricks-sql-connector "PyJWT[crypto]"
