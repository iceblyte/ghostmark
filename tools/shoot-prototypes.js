// Screenshot the prototype pages for the README (docs/images).
// Usage: run via the Playwright MCP browser_run_code_unsafe tool.
async (page) => {
	const base = "file:///D:/Code/AICreate/ZCode/Ghostmark/prototype/";
	const outDir = "D:/Code/AICreate/ZCode/Ghostmark/docs/images/";
	const shots = [
		["editor-live-preview.html", ".win", "editor-inspect.png"],
		["editor-source.html", ".win", "editor-source.png"],
		["clear-all.html", ".win", "clear-all.png"],
		["clear-selection.html", ".win", "clear-selection.png"],
		["clear-block.html", ".win", "clear-block.png"],
		["pick-codepoint.html", ".win", "pick-codepoint.png"],
		["command-palette.html", ".win", "command-palette.png"],
		["settings.html", ".win", "settings.png"],
		["mobile.html", ".phones", "mobile.png"],
	];
	await page.setViewportSize({ width: 1680, height: 1050 });
	const results = [];
	for (const [file, selector, out] of shots) {
		await page.goto(base + file);
		await page.waitForTimeout(350);
		const annos = page.locator("#pb-annos");
		if (await annos.count()) {
			const txt = (await annos.textContent()) || "";
			if (txt.includes("标注 · 开") || txt.includes("Notes · On")) {
				await annos.click();
				await page.waitForTimeout(150);
			}
		}
		await page.evaluate(() => {
			const hide = (sel) =>
				document
					.querySelectorAll(sel)
					.forEach((el) => (el.style.display = "none"));
			hide(".proto-area");
			hide(".anno-panel");
		});
		await page.waitForTimeout(120);
		await page.locator(selector).first().screenshot({
			path: outDir + out,
		});
		results.push(out);
	}
	return results.join(", ");
}
