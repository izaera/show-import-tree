main(process.argv).catch(console.error);

async function main(argv) {
	if (argv.length < 3) {
		console.error('Usage: show-import-tree <url> [-d]');
		process.exit(2);
	}

	const url = argv[2];
	const dedupe = !!argv.find(item => item === '-d');

	if (dedupe) {
		const modules = {};

		const progress = '||||||||////////--------\\\\\\\\\\\\\\\\';
		let i = 0;

		process.stderr.write('Working hard ⚒️  ' + progress[0] + ' ');

		await visitImportTree(url, (level, url, size) => {
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
					console.log(`[${level}] ${url} ${size}`);
					nothingFound = false;
				}
			}
		}
	}
	else {
		await visitImportTree(url, indentLog);
	}
}

async function visitImportTree(url, visit, indent=0) {
	const res = await fetch(url);
    const source = await res.text();
	console.log(source);
	const lines = source.split('\n');
	const importLines = lines.map(line => line.trim()).filter(line => line.startsWith('import '));

	let importModules = importLines.map(line => {
		let module = line.replace(/import [^"']*/, '');

		for (const c of [';', "'", '"']) {
			module = module.replaceAll(c, '');
		}

		return module;
	});

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

		await visitImportTree(moduleUrl.toString(), visit, indent+1);
	}
}

function indentLog(indent, ...things) {
	for(let i=0; i<indent; i++) {
		process.stdout.write('  ');//'| ');
	}

	console.log(...things);
}

