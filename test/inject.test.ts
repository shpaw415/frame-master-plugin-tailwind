import { describe, expect, test } from "bun:test";
import {
	BOOTSTRAP_SCRIPT_ID,
	CSS_LINK_ID,
	PUBLIC_BOOTSTRAP_PATH,
	PUBLIC_CSS_PATH,
} from "../src/constants";
import {
	buildBootstrapScriptTag,
	buildCssLinkTag,
	injectIntoHtml,
} from "../src/inject";

describe("buildCssLinkTag", () => {
	test("uses public CSS path and stable id", () => {
		const tag = buildCssLinkTag();
		expect(tag).toContain(`href="${PUBLIC_CSS_PATH}"`);
		expect(tag).toContain(`id="${CSS_LINK_ID}"`);
		expect(tag).toContain('rel="stylesheet"');
	});
});

describe("buildBootstrapScriptTag", () => {
	test("uses public bootstrap path and stable id", () => {
		const tag = buildBootstrapScriptTag();
		expect(tag).toContain(`src="${PUBLIC_BOOTSTRAP_PATH}"`);
		expect(tag).toContain(`id="${BOOTSTRAP_SCRIPT_ID}"`);
	});
});

describe("injectIntoHtml", () => {
	const base = `<!DOCTYPE html><html><head><title>t</title></head><body></body></html>`;

	test("injects stylesheet into head", () => {
		const out = injectIntoHtml(base, { includeBootstrap: false });
		expect(out).toContain(`id="${CSS_LINK_ID}"`);
		expect(out).toContain(`href="${PUBLIC_CSS_PATH}"`);
		expect(out).not.toContain(BOOTSTRAP_SCRIPT_ID);
	});

	test("injects stylesheet and bootstrap", () => {
		const out = injectIntoHtml(base, { includeBootstrap: true });
		expect(out).toContain(CSS_LINK_ID);
		expect(out).toContain(BOOTSTRAP_SCRIPT_ID);
		expect(out).toContain(PUBLIC_BOOTSTRAP_PATH);
	});

	test("dedupes existing tailwind link", () => {
		const withDup = `<!DOCTYPE html><html><head>
			<link href="/old.css" rel="stylesheet" id="${CSS_LINK_ID}">
			<title>t</title>
		</head><body></body></html>`;
		const out = injectIntoHtml(withDup, { includeBootstrap: false });
		const matches = out.match(new RegExp(`id="${CSS_LINK_ID}"`, "g"));
		expect(matches?.length).toBe(1);
		expect(out).toContain(PUBLIC_CSS_PATH);
		expect(out).not.toContain("/old.css");
	});
});
