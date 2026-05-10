.PHONY: build deploy

build:
	npx nx run template-frontend:build

deploy:
	python3 ../../scripts/deploy_app.py template --profile ${PROFILE:-uat}
