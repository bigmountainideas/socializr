REPORTER=spec

all: test docs

docs:
	@./node_modules/.bin/docco \
	lib/*.js

test:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter $(REPORTER)

test-cov:
	@NODE_ENV=test ./node_modules/.bin/istanbul cover \
	./node_modules/.bin/_mocha --report lcovonly -- \
	-R $(REPORTER) && cat ./coverage/lcov.info | \
	./node_modules/coveralls/bin/coveralls.js && \
	rm -rf ./coverage

.PHONY: all test test-cov docs
