PROFILE ?= uat
TARGET  ?= uat
DEPLOY_APP ?= python3 ../../scripts/deploy_app.py --app-dir .

.PHONY: deploy build render-app-config install

deploy:
	$(DEPLOY_APP) --profile $(PROFILE) --target $(TARGET)

build:
	python3 scripts/build.py

render-app-config:
	$(DEPLOY_APP) --action render --profile $(PROFILE) --target $(TARGET)

install:
	pip install -r requirements.txt
