import fs from 'fs/promises';

import { indentLog } from './util.js';

export default async function mainHAR(argv) {
	const filePath = argv[2];

	const filterJS = argv.find(arg => arg === '-js');
	const filterCSS = argv.find(arg => arg === '-css');
	const filterHTML = argv.find(arg => arg === '-html');
	const filterIMG = argv.find(arg => arg === '-img');
	const filterEnabled = filterJS || filterCSS || filterHTML || filterIMG;

	const text = await fs.readFile(filePath, 'utf-8');
	const json = JSON.parse(text);

	const pageURL = json.log.pages[0].title;
	const tree = {
		[pageURL]: {},
	}
	const index = {
		[pageURL]: tree[pageURL],
	}
	const props = {
		[pageURL]: {
			aggregateSize: 0,
			size: 0,
		}
	}

	const ignoredMimetypes = {};

	for (const entry of json.log.entries) {
		const {request, response} = entry;
	
		let mimeType = response.content.mimeType?.replace(/;.*/, '').trim();

		if (!mimeType) {
			console.error(`WARNING: Request for '${request.url}' returned no MIME type`);
			mimeType = '';
		}

		if (filterEnabled) {
			let filter = false;

			if (filterJS && mimeType.endsWith('/javascript')) {
				filter = true;
			}
			else if (filterCSS && mimeType.endsWith('/css')) {
				filter = true;
			}
			else if (filterHTML && mimeType.endsWith('/html')) {
				filter = true;
			}
			else if (filterIMG && mimeType.startsWith('image/')) {
				filter = true;
			}

			if (!filter) {
				if (!ignoredMimetypes[mimeType]) {
					console.warn(`ignored mimetype: ${mimeType}`);
				}

				ignoredMimetypes[mimeType] = true;
				continue;
			}
		}

		const url = request.url;

		props[url] = {
			aggregateSize: response.content.size,
			mimeType,
			size: response.content.size ?? 0,
		};

		if (url === pageURL) {
			continue;
		}

		const referer = getHeader(request.headers, 'Referer');

		const node = index[referer];

		node[url] = {};

		index[url] = node[url];
	}

	console.log(`
<html>
<head>
	<style>
		div {
			font-family: 'monospace';
		}

		.node {
			cursor: pointer;
			padding-left: 1em;
		}

		.node::before {
			content: '-';
		}

		.node.leaf {
			cursor: auto;
		}

		.node.leaf::before {
			content: '·';
		}

		.node.collapsed > * {
			display: none;
		}

		.node.collapsed::before {
			content: '+';
		}

	</style>
	<script>
		function toggle(node, event) {
			if (node.classList.contains('leaf')) {
				// ignore
			} else if (node.classList.contains('collapsed')) {
				node.classList.remove('collapsed');
			}
			else {
				node.classList.add('collapsed');
			}

			event.stopPropagation();
		}
	</script>
</head>
<body>
	`);

	printHARTree(tree, props, 0, getAggregateSize(tree, pageURL, props));

	console.log(`
</body>
</html>
	`);
}

function printHARTree(tree, props, indent, totalSize) {
	for (const url of Object.keys(tree)) {
		const {size} = props[url];
		const percent = (100 * size / totalSize).toFixed(1);
		const aggregateSize = getAggregateSize(tree, url, props);
		const aggregatePercent = (100 * aggregateSize / totalSize).toFixed(1);

		const leaf = (Object.keys(tree[url]).length === 0);
		
		indentLog(
			indent, 
			`<div class="node ${leaf ? 'leaf' : ''}" onclick="toggle(this, event)">`
		);

		indentLog(
			indent+1,
			leaf
				? `[${percent}%]`
				: `[${aggregatePercent}%(∑), ${percent}%]`,
			url,
			leaf
				? `[${size}]`
				: `[${aggregateSize}(∑), ${size}]`,
		);

		printHARTree(tree[url], props, indent+1, totalSize);

		indentLog(indent, '</div>');
	}
}

function getAggregateSize(tree, url, props) {
	let sum = props[url].size;

	for (const child of Object.keys(tree[url])) {
		sum += getAggregateSize(tree[url], child, props);
	}

	return sum;
}

function getHeader(headers, headerName) {
	// console.log(headers);
	for (const {name, value} of headers) {
		if (name === headerName) {
			return value;
		}
	}

	return undefined;
}

