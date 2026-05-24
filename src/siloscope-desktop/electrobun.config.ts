import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "siloscope",
		identifier: "siloscope.app",
		version: "0.0.1",
	},
	release: {
		baseUrl: "https://github.com/etammam/silo-scope/releases/latest/download",
	},
	runtime: {
		exitOnLastWindowClosed: true,
	},
	build: {
		bun: {
			entrypoint: "src/main/index.ts",
		},
		views: {
			renderer: {
				entrypoint: "src/renderer/index.tsx",
			},
		},
		copy: {
			"src/renderer/index.html": "views/renderer/index.html",
			"src/renderer/index.css": "views/renderer/index.css",
			"resources/core": "core",
		},
		mac: {
			bundleCEF: false,
		},
		linux: {
			bundleCEF: false,
		},
		win: {
			bundleCEF: false,
		},
	},
	scripts: {
		preBuild: "./scripts/prepare-core-sidecar.ts",
	},
} satisfies ElectrobunConfig;
