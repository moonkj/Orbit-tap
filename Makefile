.PHONY: build-extension build-flutter build-all clean test

# Build TypeScript extension sources
build-extension:
	cd safari_extension_src && npm run build

# Build Flutter app
build-flutter:
	flutter build ios --no-codesign

# Build everything
build-all: build-extension build-flutter

# Run TypeScript tests
test-extension:
	cd safari_extension_src && npm test

# Run Flutter tests
test-flutter:
	flutter test

# Run all tests
test: test-extension test-flutter

# Clean
clean:
	flutter clean
	cd safari_extension_src && rm -rf dist node_modules

# Watch TypeScript changes
watch-extension:
	cd safari_extension_src && npm run build:watch
