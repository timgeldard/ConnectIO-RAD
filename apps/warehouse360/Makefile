PROFILE ?= uat
TARGET  ?= uat
DEPLOY_APP ?= python3 ../../scripts/deploy_app.py --app-dir .

.PHONY: deploy build install dev render-app-config

deploy:
	$(DEPLOY_APP) --profile $(PROFILE) --target $(TARGET)

build:
	cd frontend && npm run build

render-app-config:
	$(DEPLOY_APP) --action render --profile $(PROFILE) --target $(TARGET)

install:
	pip install -r backend/requirements.txt
	cd frontend && npm install

dev:
	cd frontend && npm run dev &
	uvicorn backend.main:app --reload --port 8000
