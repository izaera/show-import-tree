import {parse} from 'acorn';
import estraverse from 'estraverse';

main(process.argv).catch(console.error);

async function main(argv) {
	if (argv.length < 3) {
		console.error('Usage: show-import-tree <url> [<JSESSIONID cookie>] [-d]');
		process.exit(2);
	}

	const url = argv[2];
	const dedupe = !!argv.find(item => item === '-d');

	let jsessionid = null;

	if (argv.length > 3 && !argv[3].startsWith('-')) {
		jsessionid = argv[3];
	}

	if (dedupe) {
		const modules = {};

		const progress = '||||||||////////--------\\\\\\\\\\\\\\\\';
		let i = 0;

		process.stderr.write('Working hard ⚒️  ' + progress[0] + ' ');

		await visitImportTree(url, jsessionid, (level, url, size) => {
			const {level: oldLevel} = modules[url] || {level: Number.MAX_VALUE};

			if (oldLevel > level) {
				modules[url] = {
					level,
					size
				};
			}

			process.stderr.write('\b\b');
			process.stderr.write(progress[i++ % progress.length] + ' ');
		});

		process.stderr.write('\b\bDONE! 🎉\n');

		let nothingFound = false;

		for(let i=0; !nothingFound; i++) {
			nothingFound = true;

			for (const [url, {level, size}] of Object.entries(modules)) {
				if (level == i) {
					console.log(`[${level}]`, url, size);
					nothingFound = false;
				}
			}
		}
	}
	else {
		await visitImportTree(url, jsessionid, (level, url, size) => {
			indentLog(level, `[${level}]`, url, size);
		});
	}
}

async function visitImportTree(url, jsessionid, visit, indent=0) {
	const headers = {};

	if (jsessionid) {
		headers['Cookie'] = `JSESSIONID=${jsessionid}`
	}

	const res = await fetch(url, {headers});
	const contentType = res.headers.get('content-type');
    const source = await res.text();

	let importModules = [];

	// JAVASCRIPT /////////////////////////////////////////////////////////////
	if (contentType.startsWith('application/javascript')) {
		const ast = parse(source, {ecmaVersion: 'latest', sourceType: 'module'});

		estraverse.traverse(ast, {
			enter: (node, parent) => {
				if (node.type == 'ImportDeclaration') {
					importModules.push(node.source.value);
				}
			},

			leave: (node, parent) => {
			}
		});
	}

	// HTML ///////////////////////////////////////////////////////////////////
	else if (contentType.startsWith('text/html')) {
		const lines = source.split('\n');
		const importLines = lines.map(line => line.trim()).filter(line => line.startsWith('import '));

		importModules = importLines.map(line => {
			let module = line.replace(/import [^"']*/, '');

			for (const c of [';', "'", '"']) {
				module = module.replaceAll(c, '');
			}

			return module;
		});
	}

	// UNKNOWN ////////////////////////////////////////////////////////////////
	else {
		console.error(`Unsupported content type ${contentType} found for URL ${url}`);
		return;
	}
	
	// TREAT IMPORTS //////////////////////////////////////////////////////////
	importModules = [...new Set(importModules)];
	importModules.sort();

	visit(indent, url, source.length);

	for (let i=0; i<importModules.length; i++) {
		const module = importModules[i];

		let moduleUrl;

		if (module.startsWith('.')) {
			moduleUrl = new URL(`${url}/../${module}`);
		}
		else if(module.startsWith('/')) {
			const baseUrl = new URL(url);

			moduleUrl = new URL(`${baseUrl.protocol}//${baseUrl.host}${module}`);
		}
		else {
			moduleUrl = new URL(module);
		}

		await visitImportTree(moduleUrl.toString(), jsessionid, visit, indent+1);
	}
}

function indentLog(indent, ...things) {
	for(let i=0; i<indent; i++) {
		process.stdout.write('  ');//'| ');
	}

	console.log(...things);
}

