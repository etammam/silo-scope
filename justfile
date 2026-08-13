# SiloScope development commands
# https://github.com/casey/just

set dotenv-load := true

### Backend commands
server subcommand *args:
    #!/usr/bin/env bash
    case "{{subcommand}}" in
        build)
            cd src/Siloscope.Core && dotnet build
            ;;
        run)
            cd src/Siloscope.Core && dotnet run
            ;;
        test)
            dotnet test
            ;;
        format)
            dotnet csharpier .
            ;;
        *)
            echo "Unknown backend subcommand: {{subcommand}}"
            echo "Available subcommands:"
            echo "  build  - Build the .NET core project"
            echo "  run    - Run the .NET core project"
            echo "  test   - Run the .NET test suite"
            echo "  format - Format code with CSharpier"
            exit 1
            ;;
    esac

### Frontend commands
client subcommand *args:
    #!/usr/bin/env bash
    case "{{subcommand}}" in
        run)
            cd src/silo-scope && npm run dev
            ;;
        build)
            cd src/silo-scope && npm run build
            ;;
        typecheck)
            cd src/silo-scope && npm run typecheck
            ;;
        start)
            cd src/silo-scope && npm run start
            ;;
        dist)
            cd src/silo-scope && npm run dist
            ;;
        install)
            cd src/silo-scope && npm install
            ;;
        *)
            echo "Unknown frontend subcommand: {{subcommand}}"
            echo "Available subcommands:"
            echo "  run       - Start the Electron app in dev/watch mode"
            echo "  build     - Build the Electron app for production"
            echo "  typecheck - Typecheck the Electron app"
            echo "  start     - Preview the built Electron app"
            echo "  dist      - Package the app for distribution"
            echo "  install   - Install dependencies"
            exit 1
            ;;
    esac

