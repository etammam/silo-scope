import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "siloscope",
		identifier: "siloscope.app",
		version: "0.0.1",
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
} satisfies ElectrobunConfig;
