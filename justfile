# SiloScope development commands
# https://github.com/casey/just

_ELECTRON_DIR := "src" / "silo-scope"

# Run the Electron desktop app in dev/watch mode
dev:
    cd {{_ELECTRON_DIR}} && npm run dev

# Typecheck the Electron app
typecheck:
    cd {{_ELECTRON_DIR}} && npx tsc --noEmit

# Build the Electron app for production
build:
    cd {{_ELECTRON_DIR}} && npm run build

# Preview the built Electron app
preview:
    cd {{_ELECTRON_DIR}} && npm run start

# Install dependencies for the Electron app
install:
    cd {{_ELECTRON_DIR}} && npm install
