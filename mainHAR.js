import fs from 'fs/promises';

import { indentLog } from './util.js';

export default async function mainHAR(argv) {
	const filePath = argv[2];

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
			size: 0,
		}
	}

	json.log.entries.forEach(entry => {
		const {request, response} = entry;
		
		const url = request.url;
		const referer = getHeader(request.headers, 'Referer');

		const node = index[referer];

		node[url] = {};

		index[url] = node[url];

		props[url] = {
			aggregateSize: response.content.size,
			size: response.content.size,
		};
	});

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

		if (!size) {
			indentLog(
				indent+1, 
				url, 
			);
		}
		else {
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
		}

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

