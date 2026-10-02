import { Plugin } from "obsidian";

export default class GhostmarkPlugin extends Plugin {
	async onload() {
		console.log("Ghostmark loaded");
	}

	onunload() {}
}
